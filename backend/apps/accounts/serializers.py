"""Authentication serializers: registration and JWT obtain with claims."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    # Organization/branch setup fields (optional — backward compatible).
    organization_name = serializers.CharField(
        required=False, allow_blank=True, default="",
        help_text="Business/organization name. Creates an Organization record.",
    )
    branch_name = serializers.CharField(
        required=False, allow_blank=True, default="",
        help_text="First branch name. Defaults to 'Main Location'.",
    )

    class Meta:
        model = User
        fields = (
            "email", "full_name", "phone", "preferred_language",
            "password", "password_confirm",
            "organization_name", "branch_name",
        )

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(_("A user with this email already exists."))
        return email

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        pw = attrs.get("password")
        if not pw:
            # Profile update without password change — skip password validation.
            attrs.pop("password", None)
            attrs.pop("password_confirm", None)
            return attrs
        pw_confirm = attrs.pop("password_confirm", "")
        if pw != pw_confirm:
            raise serializers.ValidationError({"password_confirm": _("Passwords do not match.")})
        validate_password(pw)
        return attrs

    def create(self, validated_data: dict[str, Any]) -> User:
        from datetime import timedelta

        from django.utils import timezone

        from apps.billing.models import Subscription, SubscriptionPlan
        from apps.organizations.models import Organization
        from apps.restaurants.models import Restaurant, RestaurantMembership

        password = validated_data.pop("password")
        org_name = validated_data.pop("organization_name", "") or ""
        branch_name = validated_data.pop("branch_name", "") or ""

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Create Organization + default Branch.
        org_name = org_name or (user.full_name or user.email.split("@")[0]).strip() or "My Restaurant"
        org = Organization.objects.create(owner=user, name=org_name)

        branch = Restaurant.objects.create(
            organization=org,
            owner=user,
            name=branch_name or "Main Location",
        )
        RestaurantMembership.objects.create(
            restaurant=branch,
            user=user,
            is_owner=True,
        )

        # Assign trial subscription (same logic as RestaurantViewSet.perform_create).
        plan = (
            SubscriptionPlan.objects.filter(code="trial", is_active=True).first()
            or SubscriptionPlan.objects.filter(is_active=True).order_by("display_order").first()
        )
        if plan is not None:
            trial_days = plan.trial_days or 14
            Subscription.objects.get_or_create(
                restaurant=branch,
                defaults={
                    "plan": plan,
                    "status": Subscription.Status.TRIALING,
                    "trial_ends_at": timezone.now() + timedelta(days=trial_days),
                },
            )

        return user


class InviteClaimSerializer(serializers.Serializer):
    """Accept a staff invitation: validate signed token, set credentials."""

    token = serializers.CharField()
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_token(self, value: str) -> str:
        """Decode the signed token once and stash the payload on self."""
        from django.core import signing

        try:
            self._token_data = signing.loads(
                value, max_age=60 * 60 * 24 * 7, salt="staff-invite"
            )
        except signing.SignatureExpired:
            raise serializers.ValidationError(_("This invitation link has expired."))
        except (signing.BadSignature, ValueError, TypeError):
            raise serializers.ValidationError(_("This invitation link is invalid."))
        if "email" not in self._token_data or "restaurant" not in self._token_data:
            raise serializers.ValidationError(_("This invitation link is invalid."))
        # Field validators must return the cleaned *field value* (the raw
        # token string); the decoded payload lives on ``self._token_data``.
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": _("Passwords do not match.")})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data: dict[str, Any]):
        from django.contrib.auth import get_user_model
        from apps.restaurants.models import Restaurant, RestaurantMembership

        User = get_user_model()
        token_data = getattr(self, "_token_data", None)
        if token_data is None:
            # Defensive: validate_token always runs before create in DRF.
            raise serializers.ValidationError({"token": [_("This invitation link is invalid.")]})

        email = token_data["email"]
        restaurant_id = token_data["restaurant"]

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise serializers.ValidationError({"token": [_("No pending invitation for this email.")]})

        # Placeholder users have an unusable password — only allow claiming once.
        if user.has_usable_password():
            raise serializers.ValidationError(
                {"token": [_("This account has already been set up. Please log in instead.")]}
            )

        restaurant = Restaurant.objects.filter(pk=restaurant_id).first()
        if restaurant is None:
            raise serializers.ValidationError({"token": [_("This invitation is no longer valid.")]})

        membership = RestaurantMembership.objects.filter(
            restaurant=restaurant, user=user, is_active=True
        ).first()
        if membership is None:
            raise serializers.ValidationError({"token": [_("This invitation has been revoked.")]})

        user.full_name = validated_data.get("full_name") or user.full_name
        user.phone = validated_data.get("phone") or user.phone
        user.set_password(validated_data["password"])
        user.save(update_fields=["password", "full_name", "phone"])
        return user, membership


class RestaurantTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT with lightweight, non-sensitive claims including org/branch context."""

    @classmethod
    def get_token(cls, user: User):
        token = super().get_token(user)
        token["email"] = user.email
        token["preferred_language"] = user.preferred_language

        # Attach the user's accessible branches for the frontend branch
        # switcher.  The client stores these and sends X-Branch-ID with
        # every request.
        from apps.restaurants.models import Restaurant, RestaurantMembership

        memberships = (
            RestaurantMembership.objects.filter(user=user, is_active=True)
            .select_related("restaurant", "restaurant__organization")
        )
        branches = []
        for m in memberships:
            r = m.restaurant
            branches.append({
                "id": str(r.id),
                "name": r.name,
                "slug": r.slug,
                "is_owner": m.is_owner,
                "organization_id": str(r.organization_id) if r.organization_id else None,
                "organization_name": r.organization.name if r.organization else None,
            })
        token["branches"] = branches
        # Default active branch: first owned, then first accessible.
        active = next((b for b in branches if b["is_owner"]), branches[0] if branches else None)
        token["active_branch_id"] = active["id"] if active else None

        return token
