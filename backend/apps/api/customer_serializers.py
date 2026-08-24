"""Serializers for the public customer-facing ordering API.

Return localized, minimal payloads safe for anonymous consumption.
"""

from __future__ import annotations

from rest_framework import serializers

from apps.menus.models import Dish, DishModifier, DishVariant, Menu, MenuCategory
from apps.ordering.models import CustomerSession, Order, OrderItem


class PublicSessionSerializer(serializers.ModelSerializer):
    session_token = serializers.CharField(source="token", read_only=True)
    table_number = serializers.CharField(source="table.number", read_only=True)
    restaurant_slug = serializers.CharField(source="restaurant.slug", read_only=True)

    class Meta:
        model = CustomerSession
        fields = ("session_token", "table_number", "restaurant_slug", "language", "party_size")


class CustomerDishVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = DishVariant
        fields = ("id", "name_en", "name_bn", "price_delta", "is_default")


class CustomerDishModifierSerializer(serializers.ModelSerializer):
    class Meta:
        model = DishModifier
        fields = ("id", "name_en", "name_bn", "price_delta")


class CustomerDishSerializer(serializers.ModelSerializer):
    variants = CustomerDishVariantSerializer(many=True, read_only=True)
    modifiers = CustomerDishModifierSerializer(many=True, read_only=True)

    class Meta:
        model = Dish
        fields = (
            "id", "name_en", "name_bn", "description_en", "description_bn",
            "price", "image", "is_available", "is_featured", "is_vegetarian",
            "is_spicy", "min_prep_time", "max_prep_time", "variants", "modifiers",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        from django.conf import settings
        if getattr(settings, "AWS_STORAGE_BUCKET_NAME", None):
            return data
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


class CustomerCategorySerializer(serializers.ModelSerializer):
    dishes = serializers.SerializerMethodField()

    class Meta:
        model = MenuCategory
        fields = ("id", "name_en", "name_bn", "description_en", "description_bn", "dishes")

    def get_dishes(self, obj: MenuCategory):
        return CustomerDishSerializer(
            obj.dishes.order_by("display_order"), many=True
        ).data


class CustomerMenuSerializer(serializers.ModelSerializer):
    categories = serializers.SerializerMethodField()

    class Meta:
        model = Menu
        fields = ("id", "name_en", "name_bn", "description_en", "description_bn", "categories")

    def get_categories(self, obj: Menu):
        active = obj.categories.filter(is_active=True).order_by("display_order")
        return CustomerCategorySerializer(active, many=True).data


class AddCartItemSerializer(serializers.Serializer):
    session_token = serializers.CharField()
    dish_id = serializers.UUIDField()
    variant_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, max_value=99, default=1)
    special_instructions = serializers.CharField(
        required=False, allow_blank=True, max_length=500, default=""
    )

    def validate(self, attrs):
        from apps.ordering.models import CustomerSession

        try:
            session = CustomerSession.objects.select_related("restaurant").get(
                token=attrs["session_token"], is_active=True
            )
        except CustomerSession.DoesNotExist:
            raise serializers.ValidationError(_("Invalid or expired session."))

        dish = Dish.objects.filter(
            id=attrs["dish_id"], restaurant=session.restaurant, is_available=True
        ).first()
        if dish is None:
            raise serializers.ValidationError({"dish_id": _("Dish is unavailable.")})
        attrs["dish"] = dish

        variant = None
        if attrs.get("variant_id"):
            variant = DishVariant.objects.filter(
                id=attrs["variant_id"], dish=dish, restaurant=session.restaurant
            ).first()
            if variant is None:
                raise serializers.ValidationError({"variant_id": _("Invalid variant.")})
        attrs["variant"] = variant
        return attrs


class CustomerOrderItemSerializer(serializers.ModelSerializer):
    dish_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ("dish_name_en", "dish_name_bn", "dish_image", "min_prep_time", "max_prep_time", "variant_name", "quantity", "unit_price")

    def get_dish_image(self, obj: OrderItem) -> str:
        """Resolve dish image — base64 for local storage, URL for S3."""
        url = (obj.dish_image or "").strip()
        if not url:
            return ""
        if url.startswith(("http://", "https://", "data:")):
            return url

        from django.conf import settings

        # S3 configured — build full S3 URL.
        if getattr(settings, "AWS_STORAGE_BUCKET_NAME", None):
            name = url
            for prefix in ("/media/", "media/"):
                if name.startswith(prefix):
                    name = name[len(prefix):]
                    break
            name = name.lstrip("/")
            media_url = settings.MEDIA_URL or ""
            return f"{media_url.rstrip('/')}/{name}"

        # Local storage — try base64 data URI.
        import os
        media_root = settings.MEDIA_ROOT or ""
        full_path = os.path.join(media_root, url.lstrip("/"))
        try:
            import base64, mimetypes
            with open(full_path, "rb") as f:
                encoded = base64.b64encode(f.read()).decode()
            mime = mimetypes.guess_type(full_path)[0] or "image/png"
            return f"data:{mime};base64,{encoded}"
        except (FileNotFoundError, OSError):
            return ""


class CustomerOrderSerializer(serializers.ModelSerializer):
    items = CustomerOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ("id", "order_number", "status", "order_type", "total", "items", "created_at")
