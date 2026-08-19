"""Bangladesh localization utilities (currency, datetime)."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone

CURRENCY_SYMBOL = "৳"


def format_bdt(amount: Decimal | int | float) -> str:
    """Format a numeric amount as Bangladeshi Taka, e.g. ``৳ 450.00``."""
    quantized = Decimal(str(amount)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return f"{CURRENCY_SYMBOL} {quantized:,.2f}"


def now_dhaka():
    """Current time (timezone-aware, stored in UTC; Dhaka via TIME_ZONE)."""
    return timezone.now()
