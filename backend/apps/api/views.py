"""API viewsets enforcing tenant isolation and RBAC."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.db import models
from django.db.models import Case, Count, F, IntegerField, Q, Sum, Value, When
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.analytics import services as analytics_services
from apps.api import serializers as api_serializers
from apps.billing.models import BillingRecord, Offer, Subscription, SubscriptionPlan
from apps.core.permissions import HasRestaurantPermission, IsRestaurantMember
from apps.menus.models import Dish, DishModifier, DishVariant, Menu, MenuCategory, ModifierGroup
from apps.notifications.models import Notification
from apps.notifications.services import broadcast_to_restaurant
from apps.ordering.models import Order, OrderStatusHistory
from apps.ordering.services import transition_order_status
from apps.restaurants.models import Restaurant, RestaurantMembership
from apps.tables.models import QRCode, Table


class PlanLimitReached(ValidationError):
    """A plan's resource limit blocks this request (HTTP 400).

    ``api_exception_handler`` builds the envelope's top-level ``code`` from
    ``exc.default_code``.  A plain ``ValidationError`` always reports
    ``"invalid"`` — the ``code=`` kwarg is only attached to the inner
    ``ErrorDetail`` — which the frontend cannot distinguish.  Subclassing
    preserves the machine-readable ``plan_limit_reached`` contract that
    ``BranchesPage`` (trial branch limit) relies on.
    """

    default_code = "plan_limit_reached"
    default_detail = (
        "Free trial is limited to 1 branch. "
        "Upgrade your subscription to add more branches."
    )

    def __init__(self, detail=None, code=None):
        if detail is None:
            # Dict form: the handler only unwraps a ``detail`` key from dict
            # payloads, so the message reaches the client verbatim.
            detail = {"detail": self.default_detail}
        super().__init__(detail, code)


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
        # Enforce branch limit: free trial = 1 branch.
        from apps.billing.entitlements import (
            resolve_subscription_for_user,
            subscription_scope,
        )
        from apps.billing.models import Subscription

        existing_branches = Restaurant.objects.filter(
            memberships__user=self.request.user,
            memberships__is_owner=True,
            memberships__is_active=True,
        ).count()

        # Check if the restaurant's effective subscription is still a trial.
        # Resolved across ALL of the owner's subscriptions so a stale
        # per-branch trial row (from before subscriptions were shared
        # restaurant-wide) can never lock a paid restaurant out of branches.
        sub = resolve_subscription_for_user(self.request.user)

        if (
            sub is not None
            and sub.status == Subscription.Status.TRIALING
            and existing_branches >= 1
        ):
            raise PlanLimitReached()

        # Every branch belongs to the owner's organization so billing,
        # settings, and membership are shared restaurant-wide.
        from apps.organizations.models import Organization

        org = getattr(self.request, "organization", None)
        if org is None:
            org = (
                Organization.objects.filter(owner=self.request.user)
                .order_by("created_at", "id")
                .first()
            )
        if org is None:
            org = Organization.objects.create(
                owner=self.request.user,
                name=(
                    self.request.user.full_name
                    or (self.request.user.email or "").split("@")[0]
                    or "My Restaurant"
                ),
            )

        restaurant = serializer.save(owner=self.request.user, organization=org)
        RestaurantMembership.objects.get_or_create(
            restaurant=restaurant,
            user=self.request.user,
            defaults={"is_owner": True},
        )
        # A brand-new branch starts on the trial plan ONLY when its restaurant
        # has no subscription yet, so it is immediately entitled to create
        # tables/menu and accept orders. A restaurant that already has a
        # subscription (trial or paid) shares it with every new branch —
        # never mint a second, branch-local subscription.
        from datetime import timedelta

        from django.utils import timezone

        from apps.billing.models import Subscription, SubscriptionPlan

        plan = (
            SubscriptionPlan.objects.filter(code="trial", is_active=True).first()
            or SubscriptionPlan.objects.filter(is_active=True).order_by("display_order").first()
        )
        if (
            plan is not None
            and not Subscription.objects.filter(subscription_scope(restaurant)).exists()
        ):
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
        import logging as _logging
        _log = _logging.getLogger("apps")

        # ALWAYS use the URL's restaurant (get_object), NOT the middleware-
        # resolved request.restaurant.  The middleware resolves the active
        # branch from X-Branch-ID, but the invite target is in the URL.
        restaurant = self.get_object()
        actor = self._get_actor_membership(request, restaurant)

        _log.info(
            "add_member: url_restaurant=%s actor_found=%s actor_is_owner=%s "
            "actor_role=%s user=%s",
            str(restaurant.pk)[:8],
            actor is not None,
            getattr(actor, "is_owner", None),
            getattr(getattr(actor, "role", None), "name_en", None),
            request.user.email if request.user.is_authenticated else "anonymous",
        )

        if not self._actor_can_manage_staff(actor):
            _log.warning(
                "add_member DENIED: actor=%s can_manage=%s",
                str(actor.pk)[:8] if actor else "None",
                self._actor_can_manage_staff(actor),
            )
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
                _log.warning(
                    "add_member BLOCKED by plan limit: %s (restaurant=%s)",
                    str(exc), str(restaurant.pk)[:8],
                )
                return Response(
                    {
                        "code": "plan_limit_reached",
                        "detail": _(
                            "You've reached the maximum number of staff for your current plan. "
                            "Upgrade your subscription to invite more team members."
                        ),
                    },
                    status=status.HTTP_403_FORBIDDEN,
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

        data = api_serializers.MembershipSerializer(membership).data

        # Generate a signed invite link for users who haven't claimed their
        # account yet (placeholder users have an unusable password).
        needs_claim = not user.has_usable_password() or (
            user.password.startswith("!") or user.password == ""
        )
        if needs_claim:
            from django.conf import settings
            from django.core import signing

            token = signing.dumps(
                {"email": email, "restaurant": str(restaurant.pk)},
                salt="staff-invite",
            )
            base = getattr(settings, "CUSTOMER_APP_BASE_URL", "")
            # Invite links live on the dashboard origin (same site in prod).
            invite_base = settings.CSRF_TRUSTED_ORIGINS[0] if settings.CSRF_TRUSTED_ORIGINS else base
            data["invite_url"] = f"{invite_base}/invite/accept?token={token}"

        return Response(
            data,
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

    @action(
        detail=True,
        methods=["post"],
        url_path=r"members/(?P<member_id>[^/.]+)/transfer",
    )
    def transfer_member(self, request, slug=None, member_id=None):
        """Transfer a staff member to another branch within the same org.

        Payload: ``{"target_branch_id": "<uuid>"}``
        Only owners/managers can transfer.  The target branch must belong
        to the same organization.
        """
        restaurant = self.get_object()
        actor = self._get_actor_membership(request, restaurant)
        if not self._actor_can_manage_staff(actor):
            return Response(
                {"detail": "You do not have permission to manage staff."},
                status=status.HTTP_403_FORBIDDEN,
            )

        membership = get_object_or_404(
            RestaurantMembership.objects.select_related("role", "user", "restaurant__organization"),
            restaurant=restaurant,
            pk=member_id,
        )
        if membership.is_owner:
            return Response(
                {"detail": "The owner cannot be transferred."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_branch_id = request.data.get("target_branch_id")
        if not target_branch_id:
            return Response(
                {"target_branch_id": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.restaurants.models import Restaurant

        target = Restaurant.objects.filter(pk=target_branch_id).first()
        if target is None:
            return Response(
                {"target_branch_id": ["Branch not found."]},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Enforce same organization. Fail closed: when the source branch has
        # no organization, cross-branch transfer is not permitted at all.
        source_org = restaurant.organization_id
        if source_org is None or target.organization_id != source_org:
            return Response(
                {"target_branch_id": ["Target branch must be in the same organization."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if user already has a membership at the target branch.
        existing = RestaurantMembership.objects.filter(
            restaurant=target, user=membership.user
        ).first()
        if existing:
            if existing.is_active:
                return Response(
                    {"detail": "This staff member is already assigned to that branch."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Reactivate existing membership.
            existing.is_active = True
            existing.role = membership.role
            existing.save(update_fields=["is_active", "role", "updated_at"])
        else:
            # Create new membership at target branch.
            RestaurantMembership.objects.create(
                restaurant=target,
                user=membership.user,
                role=membership.role,
                is_owner=False,
                invited_email=membership.user.email,
            )

        # Deactivate at current branch.
        membership.is_active = False
        membership.save(update_fields=["is_active", "updated_at"])

        return Response(
            {"detail": f"Transferred to {target.name}."},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path=r"members/(?P<member_id>[^/.]+)/assign",
    )
    def assign_member(self, request, slug=None, member_id=None):
        """Assign a staff member to an additional branch (without removing from current).

        Payload: ``{"branch_id": "<uuid>"}``
        """
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

        branch_id = request.data.get("branch_id")
        if not branch_id:
            return Response(
                {"branch_id": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.restaurants.models import Restaurant

        target = Restaurant.objects.filter(pk=branch_id).first()
        if target is None:
            return Response(
                {"branch_id": ["Branch not found."]},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Fail closed: without a source organization, assignment to another
        # branch is not permitted (prevents cross-tenant escalation).
        source_org = restaurant.organization_id
        if source_org is None or target.organization_id != source_org:
            return Response(
                {"branch_id": ["Target branch must be in the same organization."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = RestaurantMembership.objects.filter(
            restaurant=target, user=membership.user
        ).first()
        if existing:
            if existing.is_active:
                return Response(
                    {"detail": "Already assigned to that branch."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            existing.is_active = True
            existing.role = membership.role
            existing.save(update_fields=["is_active", "role", "updated_at"])
        else:
            RestaurantMembership.objects.create(
                restaurant=target,
                user=membership.user,
                role=membership.role,
                is_owner=False,
                invited_email=membership.user.email,
            )

        return Response(
            {"detail": f"Assigned to {target.name}."},
            status=status.HTTP_200_OK,
        )


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
        # Distinct active diners across live sessions at this table —
        # drives the "chairs occupied" indicator on the floor map.
        guests=Count(
            "sessions",
            filter=Q(sessions__is_active=True),
            distinct=True,
        ),
        # Live unpaid total across open orders (for "awaiting payment" KPIs).
        total=Sum(
            "orders__total",
            filter=Q(orders__status__in=["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED"]),
        ),
    ).order_by("number")
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

    @action(detail=False, methods=["post"], url_path="layout", required_permission="tables.manage")
    def save_layout(self, request):
        """Persist floor-map positions in one atomic batch.

        Payload: ``{"layout": [{"id": "<uuid>", "x": 0, "y": 0, "w": 2, "h": 2}, …]}``
        Invalid ids are ignored; coordinates are clamped to sane bounds.
        """
        from django.db import transaction

        from apps.notifications.services import broadcast_to_restaurant

        layout = request.data.get("layout")
        if not isinstance(layout, list):
            raise ValidationError({"layout": ["Expected a list of table positions."]})

        restaurant = self.get_restaurant()
        by_id = {}
        for entry in layout:
            if not isinstance(entry, dict) or "id" not in entry:
                continue
            by_id[str(entry["id"])] = entry

        tables = list(
            Table.objects.filter(restaurant=restaurant, pk__in=by_id.keys())
        )
        if not tables:
            return Response({"updated": 0})

        def clamp(v, lo, hi):
            try:
                return max(lo, min(hi, int(v)))
            except (TypeError, ValueError):
                return None

        with transaction.atomic():
            for table in tables:
                entry = by_id[str(table.pk)]
                x = clamp(entry.get("x"), 0, 11)
                y = clamp(entry.get("y"), 0, 95)
                w = clamp(entry.get("w", table.grid_w), 1, 12)
                h = clamp(entry.get("h", table.grid_h), 1, 24)
                if x is not None:
                    table.grid_x = min(x, 12 - (w or 1))
                if y is not None:
                    table.grid_y = y
                if w:
                    table.grid_w = w
                if h:
                    table.grid_h = h
                table.bump_version()
            Table.objects.bulk_update(
                tables, ["grid_x", "grid_y", "grid_w", "grid_h", "version", "updated_at"]
            )

        try:
            broadcast_to_restaurant(
                restaurant.slug,
                "table.event",
                {"event": "layout_changed", "table_ids": [str(t.pk) for t in tables]},
            )
        except Exception:  # pragma: no cover
            pass
        return Response({"updated": len(tables)})

    @action(detail=False, methods=["get"], url_path="sync")
    def sync(self, request):
        """Version-based reconciliation endpoint.

        Clients send ``?since=<min known version>`` (or nothing for a full
        snapshot). Tables whose version is newer than ``since`` are returned;
        the client merges them without a full reload. This is the replay
        mechanism for dropped WebSocket connections.
        """
        restaurant = self.get_restaurant()
        qs = self.filter_queryset(self.get_queryset()).filter(restaurant=restaurant)

        since = request.query_params.get("since")
        if since is not None:
            try:
                qs = qs.filter(version__gt=int(since))
            except (TypeError, ValueError):
                raise ValidationError({"since": ["Must be an integer."]})

        return Response(api_serializers.TableSerializer(qs, many=True).data)


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
    queryset = Menu.objects.prefetch_related("categories__dishes__modifier_groups__options", "categories__dishes__modifiers", "categories__dishes__variants")
    required_permission = "menu.manage"


class MenuCategoryViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.MenuCategorySerializer
    queryset = MenuCategory.objects.prefetch_related("dishes__modifier_groups__options", "dishes__modifiers", "dishes__variants")
    required_permission = "menu.manage"


class DishViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.DishSerializer
    queryset = Dish.objects.prefetch_related("variants", "modifiers", "modifier_groups")
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


class ModifierGroupViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.ModifierGroupSerializer
    queryset = ModifierGroup.objects.prefetch_related("options")
    required_permission = "menu.manage"
    filterset_fields = ("dish", "is_active")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return api_serializers.ModifierGroupWriteSerializer
        return super().get_serializer_class()


class DishModifierViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.DishModifierSerializer
    queryset = DishModifier.objects.all()
    required_permission = "menu.manage"
    filterset_fields = ("dish", "group", "is_available")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return api_serializers.DishModifierWriteSerializer
        return super().get_serializer_class()


class DishVariantViewSet(TenantScopedViewSet):
    serializer_class = api_serializers.DishVariantSerializer
    queryset = DishVariant.objects.all()
    required_permission = "menu.manage"
    filterset_fields = ("dish", "is_default")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return api_serializers.DishVariantWriteSerializer
        return super().get_serializer_class()


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

    def get_queryset(self):
        """Every subscription shared by the active branch's restaurant.

        Billing is restaurant-wide, not branch-scoped: a subscription bought
        on one branch is returned for all of its sibling branches.  This is
        the deliberate deviation from ``TenantScopedViewSet``'s per-branch
        filter — the organization/owner IS the billing tenant.  Entitled rows
        sort first so clients reading ``results[0]`` always get the
        effective subscription.
        """
        from apps.billing.entitlements import subscription_scope

        restaurant = self.get_restaurant()
        now = timezone.now()
        # Mirrors Subscription.is_entitled in SQL: active (period open or
        # unlimited) or trialing (trial open, or trial unset with open period).
        entitled_rank = Case(
            When(
                Q(status=Subscription.Status.ACTIVE)
                & (
                    Q(current_period_end__isnull=True)
                    | Q(current_period_end__gte=now)
                ),
                then=Value(0),
            ),
            When(
                Q(status=Subscription.Status.TRIALING)
                & Q(trial_ends_at__isnull=True)
                & (
                    Q(current_period_end__isnull=True)
                    | Q(current_period_end__gte=now)
                ),
                then=Value(0),
            ),
            When(
                Q(status=Subscription.Status.TRIALING)
                & Q(trial_ends_at__gte=now),
                then=Value(0),
            ),
            default=Value(1),
            output_field=IntegerField(),
        )
        return (
            Subscription.objects.filter(subscription_scope(restaurant))
            .select_related("plan")
            .annotate(entitled_rank=entitled_rank)
            .order_by(
                "entitled_rank",
                F("current_period_end").desc(nulls_last=True),
                F("trial_ends_at").desc(nulls_last=True),
                "-started_at",
            )
        )

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

        from apps.billing.entitlements import resolve_subscription

        now = timezone.now()
        trial_days = plan.trial_days or 14
        defaults = {
            "plan": plan,
            "status": Subscription.Status.ACTIVE,
            "started_at": now,
            "trial_ends_at": now + timedelta(days=trial_days),
            "current_period_end": now + timedelta(days=30),
            "auto_renew": True,
            "cancelled_at": None,
        }
        # One subscription per restaurant: update the existing restaurant-wide
        # subscription (wherever a sibling branch created it) instead of
        # minting a second, branch-local row sibling branches would never see.
        subscription = resolve_subscription(restaurant)
        if subscription is None:
            subscription = Subscription.objects.create(
                restaurant=restaurant, **defaults
            )
            created = True
        else:
            for field, value in defaults.items():
                setattr(subscription, field, value)
            subscription.save()
            created = False
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

    # Heavy, non-real-time analytics are cached briefly per-restaurant. The
    # cache key includes the restaurant id and the endpoint name, so tenants
    # never see each other's data. 60s keeps the dashboard feeling fresh while
    # collapsing repeated expensive computations (12-100+ queries) per load.
    ANALYTICS_CACHE_TTL = 60

    def _cached(self, restaurant: Restaurant, name: str, compute, *args):
        from django.core.cache import cache

        key = f"analytics:{restaurant.id}:{name}"
        if args:
            key += ":" + ":".join(str(a) for a in args)
        result = cache.get(key)
        if result is None:
            result = compute(restaurant, *args)
            cache.set(key, result, self.ANALYTICS_CACHE_TTL)
        return result

    @action(detail=False, methods=["get"])
    def overview(self, request):
        return Response(analytics_services.overview(self._require_analytics(request)))

    @staticmethod
    def _days(request, default: int) -> int:
        """Parse and clamp the ``days`` query param to a sane 1–365 window."""
        try:
            days = int(request.query_params.get("days", default))
        except (TypeError, ValueError):
            return default
        return max(1, min(days, 365))

    @action(detail=False, methods=["get"])
    def orders_over_time(self, request):
        days = self._days(request, 14)
        return Response(analytics_services.orders_over_time(self._require_analytics(request), days))

    @action(detail=False, methods=["get"])
    def popular_dishes(self, request):
        return Response(analytics_services.popular_dishes(self._require_analytics(request)))

    @action(detail=False, methods=["get"])
    def peak_hours(self, request):
        days = self._days(request, 30)
        return Response(analytics_services.peak_hours(self._require_analytics(request), days))

    @action(detail=False, methods=["get"])
    def enhanced_overview(self, request):
        restaurant = self._require_analytics(request)
        return Response(self._cached(restaurant, "enhanced_overview", analytics_services.enhanced_overview))

    @action(detail=False, methods=["get"])
    def menu_engineering(self, request):
        restaurant = self._require_analytics(request)
        return Response(self._cached(restaurant, "menu_engineering", analytics_services.menu_engineering))

    @action(detail=False, methods=["get"])
    def table_intelligence(self, request):
        # Real-time: intentionally NOT cached.
        return Response(analytics_services.table_intelligence(self._require_analytics(request)))

    @action(detail=False, methods=["get"])
    def demand_forecast(self, request):
        restaurant = self._require_analytics(request)
        return Response(self._cached(restaurant, "demand_forecast", analytics_services.demand_forecast))

    @action(detail=False, methods=["get"])
    def ai_insights(self, request):
        restaurant = self._require_analytics(request)
        return Response(self._cached(restaurant, "ai_insights", analytics_services.ai_insights))
