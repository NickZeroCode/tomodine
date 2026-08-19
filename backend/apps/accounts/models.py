"""Custom user model.

Email is the primary login identifier. Phone numbers follow Bangladesh
normalization (+880...). A user may belong to many restaurants through
RestaurantMembership (see apps.rbac / apps.restaurants).
"""

from __future__ import annotations

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.core.validators import validate_bd_phone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser, TimeStampedModel):
    """Platform user. Username is unused; email is the login identifier."""

    username = None  # type: ignore[assignment]
    email = models.EmailField(_("email address"), unique=True, db_index=True)
    phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
        validators=[validate_bd_phone],
        help_text="Bangladeshi mobile number, normalized to +880...",
    )
    full_name = models.CharField(max_length=255, blank=True, default="")
    preferred_language = models.CharField(
        max_length=5,
        choices=(("en", "English"), ("bn", "বাংলা")),
        default="en",
    )
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        ordering = ("email",)
        indexes = [models.Index(fields=("email",))]

    def __str__(self) -> str:  # pragma: no cover - display helper
        return self.full_name or self.email
