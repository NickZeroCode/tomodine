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

        class Meta(RegisterSerializer.Meta):
            fields = ("id", "email", "full_name", "phone", "preferred_language", "avatar")
            read_only_fields = ("id", "email")

    serializer_class = OutputSerializer

    def get_object(self):
        return self.request.user
