"""Authentication API views."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import RegisterSerializer, RestaurantTokenObtainPairSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"id": str(user.id), "email": user.email},
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = RestaurantTokenObtainPairSerializer
    permission_classes = (permissions.AllowAny,)


class RefreshView(TokenRefreshView):
    permission_classes = (permissions.AllowAny,)


class MeView(generics.RetrieveUpdateAPIView):
    """Retrieve or update the current authenticated user's profile."""

    class OutputSerializer(RegisterSerializer):
        avatar = serializers.ImageField(required=False, allow_null=True)
        # Password is optional on profile updates — only validate when provided.
        password = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)
        password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)

        class Meta(RegisterSerializer.Meta):
            fields = ("id", "email", "full_name", "phone", "preferred_language", "avatar")
            read_only_fields = ("id", "email")

        def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
            pw = attrs.get("password")
            if pw:
                # Only validate password when the user is changing it.
                from django.contrib.auth.password_validation import validate_password
                pw_confirm = attrs.pop("password_confirm", "")
                if pw != pw_confirm:
                    from django.utils.translation import gettext_lazy as _
                    raise serializers.ValidationError(
                        {"password_confirm": _("Passwords do not match.")}
                    )
                validate_password(pw)
            else:
                attrs.pop("password", None)
                attrs.pop("password_confirm", None)
            return attrs

        def validate_email(self, value: str) -> str:
            # Allow keeping the same email on profile update.
            if self.instance and self.instance.email.lower() == value.strip().lower():
                return value.strip().lower()
            return super().validate_email(value)

        def update(self, instance, validated_data):
            password = validated_data.pop("password", None)
            validated_data.pop("password_confirm", None)
            user = super().update(instance, validated_data)
            if password:
                user.set_password(password)
                user.save(update_fields=["password"])
            return user

    serializer_class = OutputSerializer

    def get_object(self):
        return self.request.user
