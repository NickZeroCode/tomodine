"""Shared validators — Bangladesh-aware phone numbers and misc."""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

# Bangladesh MSISDN: optional +880 / 880 prefix, then 1 followed by 9 digits.
_BD_PHONE_RE = re.compile(r"^(?:\+?880|0)?1[3-9]\d{8}$")


def validate_bd_phone(value: str) -> str:
    """Validate and normalize a Bangladeshi mobile number to E.164 (+880...)."""
    if not value:
        raise ValidationError(_("Phone number is required."))
    normalized = value.strip().replace(" ", "").replace("-", "")
    if not _BD_PHONE_RE.match(normalized):
        raise ValidationError(_("Enter a valid Bangladeshi mobile number."))
    digits = re.sub(r"\D", "", normalized)
    if digits.startswith("880"):
        local = digits[3:]
    elif digits.startswith("0"):
        local = digits[1:]
    else:
        local = digits
    return f"+880{local}"


def validate_non_negative(value: float) -> None:
    if value < 0:
        raise ValidationError(_("Value cannot be negative."))
