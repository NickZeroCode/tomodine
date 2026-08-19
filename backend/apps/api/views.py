"""API viewsets enforcing tenant isolation and RBAC."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.analytics import services as analytics_services
from apps.api import serializers as api_serializers
from apps.billing.models import BillingRecord, Offer, Subscription, SubscriptionPlan
from apps.core.permissions import HasRestaurantPermission, IsRestaurantMember
from apps.menus.models import Dish, Menu, MenuCategory
from apps.notifications.models import Notification
from apps.notifications.services import broadcast_to_restaurant
from apps.ordering.models import Order, OrderStatusHistory
from apps.ordering.services import transition_order_status
from apps.restaurants.models import Restaurant, RestaurantMembership
from apps.tables.models import QRCode, Table


class TenantScopedViewSet(viewsets.ModelViewSet):
    """Base viewset that always scopes queries to ``request.restaurant``.

    Subclasses must not override ``get_queryset`` without calling super and
    retaining the restaurant filter.
    """

    permission_classes = (IsRestaurantMember, HasRestaurantPermission)
    required_permission: str | None = None

    def get_restaurant(self) -> Restaurant:
        restaurant = getattr(self.request, "restaurant", None)
        if restaurant is None:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("A valid restaurant context is required.")
        return restaurant

    def get_queryset(self):
        return self.queryset.filter(restaurant=self.get_restaurant())

    def perform_create(self, serializer):
        serializer.save(restaurant=self.get_restaurant())


# ---------------------------------------------------------------------------
# Restaurants & membership
# ---------------------------------------------------------------------------
class RestaurantViewSet(viewsets.ModelViewSet):
    serializer_class = api_serializers.RestaurantSerializer
    permission_classes = (permissions.IsAuthenticated,)
    # Support both PK and slug lookups so tests use UUIDs while the
    # frontend can use the human-readable slug.
    lookup_field = "slug"
    slug_field = "slug"

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field)
        # Try slug first (most common from frontend), then fall back to PK.
        queryset = self.filter_queryset(self.get_queryset())
        try:
            from uuid import UUID
            UUID(str(lookup))
        except (ValueError, AttributeError):
            # Not a UUID — treat as slug.
            obj = queryset.filter(slug=lookup).first()
        else:
            # Looks like a UUID — try PK then slug.
            obj = queryset.filter(pk=lookup).first() or queryset.filter(slug=lookup).first()
        if obj is None:
            from rest_framework.exceptions import NotFound
            raise NotFound()
        self.check_object_permissions(self.request, obj)
        return obj

    def get_queryset(self):
        return Restaurant.objects.filter(
            memberships__user=self.request.user, memberships__is_active=True
        ).distinct()

    def perform_create(self, serializer):
        restaurant = serializer.save(owner=self.request.user)
        RestaurantMembership.objects.get_or_create(
            restaurant=restaurant,
            user=self.request.user,
            defaults={"is_owner": True},
        )
        # Every new restaurant starts on the trial plan so it is immediately
        # entitled to create tables/menu and accept orders.
        from datetime import timedelta

        from django.utils import timezone

        from apps.billing.models import Subscription, SubscriptionPlan

        plan = (
            SubscriptionPlan.objects.filter(code="trial", is_active=True).first()
            or SubscriptionPlan.objects.filter(is_active=True).order_by("display_order").first()
        )
        if plan is not None:
            trial_days = plan.trial_days or 0
            Subscription.objects.get_or_create(
                restaurant=restaurant,
                defaults={
                    "plan": plan,
                    "status": Subscription.Status.TRIALING,
                    "trial_ends_at": timezone.now() + timedelta(days=trial_days),
                },
            )

    @action(detail=True, methods=["get"], url_path="members-list")
    def members(self, request, slug=None):
        restaurant = self.get_object()
        members = RestaurantMembership.objects.filter(restaurant=restaurant).select_related(
            "user", "role"
        )
        return Response(api_serializers.MembershipSerializer(members, many=True).data)

    @action(detail=True, methods=["get"])
    def roles(self, request, slug=None):
        """List system roles plus roles custom to this restaurant."""
        restaurant = self.get_object()
        from apps.rbac.models import Role

        roles = Role.objects.filter(
            models.Q(restaurant__isnull=True) | models.Q(restaurant=restaurant)
        ).order_by("is_system", "name_en")
        return Response(api_serializers.RoleSerializer(roles, many=True).data)

    def _get_actor_membership(self, request, restaurant):
        return RestaurantMembership.objects.filter(
            restaurant=restaurant, user=request.user, is_active=True
        ).first()

    def _actor_can_manage_staff(self, membership) -> bool:
        if membership is None:
            return False
        if membership.is_owner:
            return True
        role = membership.role
        return bool(role and role.permissions.filter(codename="staff.manage").exists())

    @staticmethod
    def _resolve_role(restaurant, role_id):
        """Return the role scoped to this restaurant, or None if invalid."""
        import uuid

        from apps.rbac.models import Role

        try:
            role_uuid = uuid.UUID(str(role_id))
        except (ValueError, TypeError, AttributeError):
            return None
        return Role.objects.filter(
            models.Q(restaurant__isnull=True) | models.Q(restaurant=restaurant),
            pk=role_uuid,
        ).first()

    @action(detail=True, methods=["post"], url_path="members")
    def add_member(self, request, slug=None):
        """Invite/add a staff member by email with a role.

        If no account exists for the email, a placeholder user is created and
        the email is recorded on the membership for future claiming.
        """
        restaurant = self.get_object()
        actor = self._get_actor_membership(request, restaurant)
        if not self._actor_can_manage_staff(actor):
            return Response(
                {"detail": "You do not have permission to manage staff."},
                status=status.HTTP_403_FORBIDDEN,
            )

        email = (request.data.get("email") or "").strip().lower()
        role_id = request.data.get("role")
        if not email:
            return Response(
                {"email": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.contrib.auth import get_user_model
        from apps.rbac.models import Role

        role = None
        if role_id:
            role = self._resolve_role(restaurant, role_id)
            if role is None:
                return Response(
                    {"role": ["Invalid role."]}, status=status.HTTP_400_BAD_REQUEST
                )

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()

        from apps.billing import entitlements

        is_new_member = user is None or not RestaurantMembership.objects.filter(
            restaurant=restaurant, user=user, is_active=True
        ).exists()
        if is_new_member:
            try:
                entitlements.check_staff_limit(restaurant)
            except entitlements.PlanLimitExceeded as exc:
                return Response(
                    {"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN
                )

        if user is None:
            user = User.objects.create_user(email=email)

        membership, created = RestaurantMembership.objects.get_or_create(
            restaurant=restaurant,
            user=user,
            defaults={"role": role, "invited_email": email},
        )
        if not created:
            membership.role = role
            membership.is_active = True
            membership.save(update_fields=["role", "is_active", "updated_at"])
        return Response(
            api_serializers.MembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"members/(?P<member_id>[^/.]+)",
    )
    def member_detail(self, request, slug=None, member_id=None):
        """Update a member's role/active flag or deactivate (remove) them."""
        restaurant = self.get_object()
        actor = self._get_actor_membership(request, restaurant)
        if not self._actor_can_manage_staff(actor):
            return Response(
                {"detail": "You do not have permission to manage staff."},
                status=status.HTTP_403_FORBIDDEN,
            )

        membership = get_object_or_404(
            RestaurantMembership.objects.select_related("role", "user"),
            restaurant=restaurant,
            pk=member_id,
        )
        if membership.is_owner:
            return Response(
                {"detail": "The owner cannot be modified or removed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.method == "DELETE":
            membership.is_active = False
            membership.save(update_fields=["is_active", "updated_at"])
            return Response(status=status.HTTP_204_NO_CONTENT)

        role_id = request.data.get("role", None)
        if role_id is not None:
            role = self._resolve_role(restaurant, role_id)
            if role is None:
                return Response(
                    {"role": ["Invalid role."]}, status=status.HTTP_400_BAD_REQUEST
                )
            membership.role = role
        if "is_active" in request.data:
            membership.is_active = bool(request.data.get("is_active"))
        membership.save()
        return Response(api_serializers.MembershipSerializer(membership).data)


# ---------------------------------------------------------------------------
# Tables / QR
# ---------------------------------------------------------------------------
class TableViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.TableSerializer
    queryset = Table.objects.annotate(
        active_orders=Count(
            "orders",
            filter=Q(orders__status__in=["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED"]),
        ),
        has_new_orders=Count(
            "orders",
            filter=Q(orders__status="NEW"),
        ),
    )
    required_permission = "tables.manage"

    def perform_create(self, serializer):
        from apps.billing import entitlements

        try:
            entitlements.check_table_limit(self.get_restaurant())
        except entitlements.PlanLimitExceeded as exc:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(str(exc))
        super().perform_create(serializer)

    @action(detail=True, methods=["post"], required_permission="tables.manage")
    def generate_qr(self, request, pk=None):
        table = self.get_object()
        qr, _ = QRCode.objects.get_or_create(
            restaurant=self.get_restaurant(), table=table
        )
        return Response(api_serializers.QRCodeSerializer(qr).data)

    @action(detail=True, methods=["post"], required_permission="tables.manage")
    def regenerate_qr(self, request, pk=None):
        table = self.get_object()
        qr = get_object_or_404(QRCode, restaurant=self.get_restaurant(), table=table)
        qr.regenerate_token()
        return Response(api_serializers.QRCodeSerializer(qr).data)


class QRCodeViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.QRCodeSerializer
    queryset = QRCode.objects.all()
    required_permission = "tables.manage"
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]


# ---------------------------------------------------------------------------
# Menus
# ---------------------------------------------------------------------------
class MenuViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.MenuSerializer
    queryset = Menu.objects.prefetch_related("categories__dishes")
    required_permission = "menu.manage"


class MenuCategoryViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.MenuCategorySerializer
    queryset = MenuCategory.objects.prefetch_related("dishes")
    required_permission = "menu.manage"


class DishViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.DishSerializer
    queryset = Dish.objects.prefetch_related("variants", "modifiers")
    required_permission = "menu.manage"
    filterset_fields = ("category", "is_available", "is_featured")
    search_fields = ("name_en", "name_bn", "description_en", "description_bn")

    def perform_create(self, serializer):
        from apps.billing import entitlements
        import logging
        from rest_framework.exceptions import PermissionDenied

        logger = logging.getLogger("apps")
        restaurant = self.get_restaurant()
        logger.info("Dish create: restaurant=%s", restaurant.slug)
        try:
            entitlements.check_dish_limit(restaurant)
        except entitlements.PlanLimitExceeded as exc:
            logger.warning("Dish limit exceeded: %s", exc)
            raise PermissionDenied(str(exc))
        super().perform_create(serializer)


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
class OrderViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.OrderSerializer
    queryset = Order.objects.prefetch_related("items").select_related("table")
    required_permission = "orders.view"
    filterset_fields = ("status", "table")
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        created_after = self.request.query_params.get("created_after")
        if created_after:
            qs = qs.filter(created_at__date__gte=created_after)
        return qs

    @action(detail=True, methods=["post"], required_permission="orders.manage")
    def transition(self, request, pk=None):
        order = self.get_object()
        to_status = request.data.get("to_status") or request.data.get("status")
        note = request.data.get("note", "")
        try:
            order = transition_order_status(
                order=order, to_status=to_status, changed_by=request.user, note=note
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        broadcast_to_restaurant(
            order.restaurant.slug,
            "order.event",
            {
                "order_id": str(order.id),
                "order_number": order.order_number,
                "status": order.status,
            },
        )
        from apps.notifications.models import Notification
        from apps.notifications.services import notify_restaurant

        notify_restaurant(
            order.restaurant,
            kind=Notification.Kind.ORDER_STATUS,
            title_en=f"Order #{order.order_number} → {order.status}",
            title_bn=f"অর্ডার #{order.order_number} → {order.status}",
            metadata={"order_id": str(order.id), "status": order.status},
        )
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        order = self.get_object()
        history = OrderStatusHistory.objects.filter(order=order)
        return Response(
            api_serializers.OrderStatusHistorySerializer(history, many=True).data
        )


# ---------------------------------------------------------------------------
# Billing / subscriptions
# ---------------------------------------------------------------------------
class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = api_serializers.SubscriptionPlanSerializer
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    permission_classes = (permissions.AllowAny,)


class SubscriptionViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.SubscriptionSerializer
    queryset = Subscription.objects.select_related("plan")
    required_permission = "billing.view"
    http_method_names = ["get", "post", "patch", "head", "options"]

    @action(detail=False, methods=["post"], url_path="subscribe")
    def subscribe(self, request):
        """Subscribe the current restaurant to a plan (simulated payment)."""
        plan_id = request.data.get("plan_id")
        if not plan_id:
            return Response(
                {"detail": "plan_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            plan = SubscriptionPlan.objects.get(pk=plan_id, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response(
                {"detail": "Invalid or inactive plan."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        restaurant = self.get_restaurant()
        from datetime import timedelta
        from django.utils import timezone

        trial_days = plan.trial_days or 14
        subscription, created = Subscription.objects.update_or_create(
            restaurant=restaurant,
            defaults={
                "plan": plan,
                "status": Subscription.Status.ACTIVE,
                "started_at": timezone.now(),
                "trial_ends_at": timezone.now() + timedelta(days=trial_days),
                "current_period_end": timezone.now() + timedelta(days=30),
                "auto_renew": True,
                "cancelled_at": None,
            },
        )
        return Response(
            self.get_serializer(subscription).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class BillingRecordViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.BillingRecordSerializer
    queryset = BillingRecord.objects.all()
    required_permission = "billing.view"
    http_method_names = ["get", "head", "options"]


class OfferViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.OfferSerializer
    queryset = Offer.objects.all()
    required_permission = "billing.manage"
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filterset_fields = ("is_active", "discount_type")


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.NotificationSerializer
    queryset = Notification.objects.all()
    required_permission = "orders.view"
    http_method_names = ["get", "post", "patch", "head", "options"]

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=("is_read", "updated_at"))
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"marked": updated})


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
class AnalyticsViewSet(viewsets.ViewSet):
    permission_classes = (IsRestaurantMember, HasRestaurantPermission)
    required_permission = "analytics.view"

    def _restaurant(self, request) -> Restaurant:
        restaurant = getattr(request, "restaurant", None)
        if restaurant is None:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("A valid restaurant context is required.")
        return restaurant

    def _require_analytics(self, request) -> Restaurant:
        from apps.billing.entitlements import get_entitlements
        from rest_framework.exceptions import PermissionDenied

        restaurant = self._restaurant(request)
        if not get_entitlements(restaurant).has_analytics:
            exc = PermissionDenied(
                "Analytics is not available on your current plan. "
                "Upgrade to access reports and insights."
            )
            exc.plan_gate = True
            raise exc
        return restaurant

    @action(detail=False, methods=["get"])
    def overview(self, request):
        return Response(analytics_services.overview(self._require_analytics(request)))

    @action(detail=False, methods=["get"])
    def orders_over_time(self, request):
        days = int(request.query_params.get("days", 14))
        return Response(analytics_services.orders_over_time(self._require_analytics(request), days))

    @action(detail=False, methods=["get"])
    def popular_dishes(self, request):
        return Response(analytics_services.popular_dishes(self._require_analytics(request)))

    @action(detail=False, methods=["get"])
    def peak_hours(self, request):
        days = int(request.query_params.get("days", 30))
        return Response(analytics_services.peak_hours(self._require_analytics(request), days))

    @action(detail=False, methods=["get"])
    def enhanced_overview(self, request):
        return Response(analytics_services.enhanced_overview(self._require_analytics(request)))

    @action(detail=False, methods=["get"])
    def menu_engineering(self, request):
        return Response(analytics_services.menu_engineering(self._require_analytics(request)))

    @action(detail=False, methods=["get"])
    def table_intelligence(self, request):
        return Response(analytics_services.table_intelligence(self._require_analytics(request)))

    @action(detail=False, methods=["get"])
    def demand_forecast(self, request):
        return Response(analytics_services.demand_forecast(self._require_analytics(request)))

    @action(detail=False, methods=["get"])
    def ai_insights(self, request):
        return Response(analytics_services.ai_insights(self._require_analytics(request)))
