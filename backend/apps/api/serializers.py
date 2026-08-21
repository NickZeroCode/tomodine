"""API serializers across domains.

Serializers never trust client-supplied restaurant identifiers; the
restaurant is injected from the request's resolved tenant context.
"""

from __future__ import annotations

import logging

from rest_framework import serializers

logger = logging.getLogger(__name__)

from apps.billing.models import BillingRecord, Offer, Subscription, SubscriptionPlan
from apps.menus.models import Dish, DishModifier, DishVariant, Menu, MenuCategory
from apps.notifications.models import Notification
from apps.ordering.models import CustomerSession, Order, OrderItem, OrderStatusHistory
from apps.rbac.models import Role
from apps.restaurants.models import Restaurant, RestaurantMembership
from apps.tables.models import QRCode, Table


# ---------------------------------------------------------------------------
# Restaurants
# ---------------------------------------------------------------------------
class RestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = (
            "id", "name", "slug", "description", "logo", "cover_image",
            "phone", "email", "website", "address_line", "area", "upazila",
            "district", "division", "currency", "default_language",
            "opening_time", "closing_time", "status", "created_at",
        )
        read_only_fields = ("id", "slug", "status", "created_at")

    def save(self, **kwargs):
        request = self.context.get("request")
        if request:
            files = {k: (v.name, v.size) for k, v in request.FILES.items()} if request.FILES else {}
            logger.info("RestaurantSerializer.save: data_keys=%s files=%s", list(request.data.keys()), files)
        return super().save(**kwargs)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        from django.conf import settings
        if getattr(settings, "AWS_STORAGE_BUCKET_NAME", None):
            return data
        for field_name in ("logo", "cover_image"):
            img = getattr(instance, field_name, None)
            if img and hasattr(img, "path"):
                try:
                    import base64, mimetypes
                    with open(img.path, "rb") as f:
                        encoded = base64.b64encode(f.read()).decode()
                    mime = mimetypes.guess_type(img.path)[0] or "image/png"
                    data[field_name] = f"data:{mime};base64,{encoded}"
                except (FileNotFoundError, OSError):
                    data[field_name] = None
        return data


class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    role_name = serializers.CharField(source="role.name_en", read_only=True)

    class Meta:
        model = RestaurantMembership
        fields = ("id", "user_email", "role", "role_name", "is_owner", "is_active", "created_at")
        read_only_fields = ("id", "created_at")


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "name_en", "name_bn", "slug", "is_system")
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Tables / QR
# ---------------------------------------------------------------------------
class TableSerializer(serializers.ModelSerializer):
    qr_code = serializers.SerializerMethodField()
    active_orders = serializers.IntegerField(read_only=True, default=0)
    has_new_orders = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Table
        fields = (
            "id", "number", "label", "seats", "floor", "status",
            "is_active", "qr_code", "active_orders", "has_new_orders", "created_at",
        )
        read_only_fields = ("id", "created_at")

    def get_qr_code(self, obj: Table):
        qr = getattr(obj, "qr_code", None)
        if qr is None or not qr.is_active:
            return None
        return QRCodeSerializer(qr, context=self.context).data


class QRCodeSerializer(serializers.ModelSerializer):
    order_url = serializers.SerializerMethodField()
    image_data_uri = serializers.SerializerMethodField()

    class Meta:
        model = QRCode
        fields = (
            "id", "table", "token", "is_active", "order_url",
            "image_data_uri", "created_at",
        )
        read_only_fields = ("id", "token", "created_at")

    def get_order_url(self, obj: QRCode) -> str:
        from django.conf import settings

        return f"{settings.CUSTOMER_APP_BASE_URL}/{obj.token}"

    def get_image_data_uri(self, obj: QRCode) -> str:
        """Render the QR PNG locally as a base64 data URI (no external API)."""
        import base64
        import io

        import qrcode

        url = self.get_order_url(obj)
        img = qrcode.make(url, box_size=10, border=2)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/png;base64,{encoded}"


# ---------------------------------------------------------------------------
# Menus
# ---------------------------------------------------------------------------
class DishVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = DishVariant
        fields = ("id", "name_en", "name_bn", "price_delta", "is_default", "display_order")
        read_only_fields = ("id",)


class DishModifierSerializer(serializers.ModelSerializer):
    class Meta:
        model = DishModifier
        fields = ("id", "name_en", "name_bn", "price_delta", "is_available")
        read_only_fields = ("id",)


class DishSerializer(serializers.ModelSerializer):
    variants = DishVariantSerializer(many=True, read_only=True)
    modifiers = DishModifierSerializer(many=True, read_only=True)

    class Meta:
        model = Dish
        fields = (
            "id", "category", "name_en", "name_bn", "description_en",
            "description_bn", "price", "image", "is_available", "is_featured",
            "is_vegetarian", "is_spicy", "min_prep_time", "max_prep_time",
            "display_order", "variants", "modifiers",
        )
        read_only_fields = ("id",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        restaurant = getattr(request, "restaurant", None) if request else None
        if restaurant is not None:
            self.fields["category"].queryset = MenuCategory.objects.filter(
                menu__restaurant=restaurant
            )

    def save(self, **kwargs):
        request = self.context.get("request")
        if request:
            files = {k: (v.name, v.size) for k, v in request.FILES.items()} if request.FILES else {}
            logger.info("DishSerializer.save: data_keys=%s files=%s", list(request.data.keys()), files)
        return super().save(**kwargs)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # If using S3 storage, ImageField URLs already work — no conversion needed.
        from django.conf import settings
        if getattr(settings, "AWS_STORAGE_BUCKET_NAME", None):
            return data
        # On serverless (Vercel) or local dev, file URLs may not work —
        # return inline base64 data URI instead.
        img = getattr(instance, "image", None)
        if img and hasattr(img, "path"):
            try:
                import base64, mimetypes
                with open(img.path, "rb") as f:
                    encoded = base64.b64encode(f.read()).decode()
                mime = mimetypes.guess_type(img.path)[0] or "image/png"
                data["image"] = f"data:{mime};base64,{encoded}"
            except (FileNotFoundError, OSError):
                data["image"] = None
        return data


class MenuCategorySerializer(serializers.ModelSerializer):
    dishes = DishSerializer(many=True, read_only=True)

    class Meta:
        model = MenuCategory
        fields = (
            "id", "menu", "name_en", "name_bn", "description_en",
            "description_bn", "display_order", "is_active", "dishes",
        )
        read_only_fields = ("id",)


class MenuSerializer(serializers.ModelSerializer):
    categories = MenuCategorySerializer(many=True, read_only=True)

    class Meta:
        model = Menu
        fields = (
            "id", "name_en", "name_bn", "description_en", "description_bn",
            "is_active", "display_order", "categories",
        )
        read_only_fields = ("id",)


# ---------------------------------------------------------------------------
# Ordering
# ---------------------------------------------------------------------------
class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            "id", "dish_name_en", "dish_name_bn", "dish_image", "min_prep_time",
            "max_prep_time", "variant_name", "quantity", "unit_price", "special_instructions",
        )
        read_only_fields = ("id",)


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    table_number = serializers.CharField(source="table.number", read_only=True)
    table_label = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id", "order_number", "status", "order_type", "table", "table_number", "table_label",
            "customer_note", "subtotal", "total", "items", "created_at",
        )
        read_only_fields = ("id", "order_number", "subtotal", "total", "created_at")

    def get_table_label(self, obj) -> str:
        table = obj.table
        if table is None:
            return ""
        return table.label or table.number


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ("id", "from_status", "to_status", "note", "created_at")
        read_only_fields = ("id", "created_at")


class CustomerSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerSession
        fields = ("id", "table", "language", "party_size", "is_active", "created_at")
        read_only_fields = ("id", "created_at")


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------
class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = (
            "id", "code", "name_en", "name_bn", "description_en",
            "description_bn", "price", "currency", "interval", "trial_days",
            "max_tables", "max_staff", "max_dishes", "has_analytics",
        )
        read_only_fields = ("id",)


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    is_entitled = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = (
            "id", "plan", "status", "started_at", "trial_ends_at",
            "current_period_end", "auto_renew", "cancelled_at", "is_entitled",
        )
        read_only_fields = ("id", "started_at", "cancelled_at")


class BillingRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingRecord
        fields = (
            "id", "amount", "currency", "status", "period_start",
            "period_end", "reference", "created_at",
        )
        read_only_fields = ("id", "created_at")


class OfferSerializer(serializers.ModelSerializer):
    dish_name = serializers.CharField(source="dish.name_en", read_only=True, default=None)
    dish_image = serializers.SerializerMethodField()
    dish_price = serializers.DecimalField(source="dish.price", max_digits=10, decimal_places=2, read_only=True, default=None)

    class Meta:
        model = Offer
        fields = (
            "id", "name_en", "name_bn", "description_en", "description_bn",
            "code", "discount_type", "discount_value", "min_order_amount",
            "dish", "dish_name", "dish_image", "dish_price",
            "start_date", "end_date", "is_active", "max_uses", "current_uses",
            "created_at",
        )
        read_only_fields = ("id", "current_uses", "created_at")

    def get_dish_image(self, obj):
        if obj.dish and obj.dish.image:
            return obj.dish.image.url
        return None


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id", "kind", "title_en", "title_bn", "body_en", "body_bn",
            "is_read", "metadata", "created_at",
        )
        read_only_fields = ("id", "created_at")
