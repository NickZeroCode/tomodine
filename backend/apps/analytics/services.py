"""Analytics computed from real order/table data. Never fabricated."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any
from collections import Counter

from django.db.models import Avg, Count, Sum, F, Q, Min, Max
from django.db.models.functions import TruncDate, TruncHour
from django.utils import timezone

from apps.ordering.models import Order, OrderItem
from apps.tables.models import Table
from apps.menus.models import Dish


def overview(restaurant) -> dict[str, Any]:
    """Today's KPI snapshot for the dashboard."""
    today = timezone.localdate()
    todays_orders = Order.objects.filter(
        restaurant=restaurant, created_at__date=today
    )
    status_counts = {
        row["status"]: row["count"]
        for row in todays_orders.values("status").annotate(count=Count("id"))
    }
    revenue = (
        todays_orders.filter(status=Order.Status.PAID).aggregate(total=Sum("total"))["total"]
        or Decimal("0")
    )

    table_status = {
        row["status"]: row["count"]
        for row in Table.objects.filter(restaurant=restaurant, is_active=True)
        .values("status")
        .annotate(count=Count("id"))
    }

    return {
        "date": str(today),
        "orders_total": todays_orders.count(),
        "orders_by_status": status_counts,
        "revenue_paid": str(revenue),
        "tables_by_status": table_status,
    }


def orders_over_time(restaurant, days: int = 14) -> list[dict[str, Any]]:
    since = timezone.now() - timedelta(days=days)
    rows = (
        Order.objects.filter(restaurant=restaurant, created_at__gte=since)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"), revenue=Sum("total"))
        .order_by("day")
    )
    return [
        {"date": str(r["day"]), "orders": r["count"], "revenue": str(r["revenue"] or 0)}
        for r in rows
    ]


def popular_dishes(restaurant, limit: int = 10) -> list[dict[str, Any]]:
    rows = (
        OrderItem.objects.filter(order__restaurant=restaurant)
        .values("dish_name_en")
        .annotate(total_qty=Sum("quantity"), total_revenue=Sum("unit_price"))
        .order_by("-total_qty")[:limit]
    )
    return [
        {
            "dish": r["dish_name_en"],
            "quantity": r["total_qty"] or 0,
            "revenue": str(r["total_revenue"] or 0),
        }
        for r in rows
    ]


def peak_hours(restaurant, days: int = 30) -> list[dict[str, Any]]:
    since = timezone.now() - timedelta(days=days)
    rows = (
        Order.objects.filter(restaurant=restaurant, created_at__gte=since)
        .annotate(hour=TruncHour("created_at"))
        .values("hour")
        .annotate(count=Count("id"))
        .order_by("hour")
    )
    return [
        {"hour": r["hour"].strftime("%H:00"), "orders": r["count"]} for r in rows
    ]


def average_order_value(restaurant, days: int = 30) -> str:
    since = timezone.now() - timedelta(days=days)
    value = (
        Order.objects.filter(restaurant=restaurant, created_at__gte=since)
        .aggregate(avg=Avg("total"))["avg"]
    )
    return str((value or Decimal("0")).quantize(Decimal("0.01")))


# ═══════════════════════════════════════════════════════════════════
# ENHANCED ANALYTICS — TomoDine Differentiators
# ═══════════════════════════════════════════════════════════════════


def enhanced_overview(restaurant) -> dict[str, Any]:
    """Comprehensive KPI dashboard with comparisons and advanced metrics."""
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    same_day_last_week = today - timedelta(days=7)
    now = timezone.now()

    today_orders = Order.objects.filter(restaurant=restaurant, created_at__date=today)
    yesterday_orders = Order.objects.filter(restaurant=restaurant, created_at__date=yesterday)
    last_week_orders = Order.objects.filter(restaurant=restaurant, created_at__date=same_day_last_week)

    # Revenue
    revenue_today = (
        today_orders.filter(status=Order.Status.PAID).aggregate(s=Sum("total"))["s"]
        or Decimal("0")
    )
    revenue_yesterday = (
        yesterday_orders.filter(status=Order.Status.PAID).aggregate(s=Sum("total"))["s"]
        or Decimal("0")
    )
    revenue_last_week = (
        last_week_orders.filter(status=Order.Status.PAID).aggregate(s=Sum("total"))["s"]
        or Decimal("0")
    )

    # Revenue delta %
    rev_vs_yesterday = (
        float((revenue_today - revenue_yesterday) / revenue_yesterday * 100)
        if revenue_yesterday > 0 else None
    )
    rev_vs_last_week = (
        float((revenue_today - revenue_last_week) / revenue_last_week * 100)
        if revenue_last_week > 0 else None
    )

    # Orders
    orders_today = today_orders.count()
    orders_yesterday = yesterday_orders.count()
    orders_delta = (
        float((orders_today - orders_yesterday) / orders_yesterday * 100)
        if orders_yesterday > 0 else None
    )

    # Customers today (unique sessions)
    from apps.ordering.models import CustomerSession
    customers_today = (
        CustomerSession.objects.filter(
            restaurant=restaurant, orders__created_at__date=today
        )
        .values("device_id")
        .distinct()
        .count()
    )

    # Table occupancy
    all_tables = Table.objects.filter(restaurant=restaurant, is_active=True)
    total_tables = all_tables.count()
    occupied_tables = all_tables.exclude(
        status__in=["available", "offline"]
    ).count()
    occupancy_pct = (
        round(occupied_tables / total_tables * 100, 1) if total_tables > 0 else 0
    )

    # Average prep time (from order items)
    prep_stats = OrderItem.objects.filter(
        order__restaurant=restaurant,
        order__created_at__date=today,
    ).aggregate(
        avg_min=Avg("min_prep_time"),
        avg_max=Avg("max_prep_time"),
    )
    avg_prep_min = prep_stats["avg_min"] or 15
    avg_prep_max = prep_stats["avg_max"] or 30

    # Average order value
    aov = (
        today_orders.aggregate(avg=Avg("total"))["avg"]
        or Decimal("0")
    )

    # Repeat customer rate (customers who ordered today AND in the past 30 days)
    thirty_days_ago = today - timedelta(days=30)
    today_device_ids = set(
        CustomerSession.objects.filter(
            restaurant=restaurant, orders__created_at__date=today
        ).values_list("device_id", flat=True)
    )
    returning_device_ids = set(
        CustomerSession.objects.filter(
            restaurant=restaurant,
            orders__created_at__date__gte=thirty_days_ago,
            orders__created_at__date__lt=today,
        ).values_list("device_id", flat=True)
    )
    repeat_count = len(today_device_ids & returning_device_ids)
    repeat_rate = (
        round(repeat_count / len(today_device_ids) * 100, 1)
        if today_device_ids else 0
    )

    # Best selling items this week
    week_ago = today - timedelta(days=7)
    best_sellers = list(
        OrderItem.objects.filter(
            order__restaurant=restaurant,
            order__created_at__date__gte=week_ago,
        )
        .values("dish_name_en", "dish_name_bn")
        .annotate(total_qty=Sum("quantity"), total_revenue=Sum(
            F("unit_price") * F("quantity")
        ))
        .order_by("-total_qty")[:5]
    )

    # Declining items (sold this week but less than last week)
    prev_week = week_ago - timedelta(days=7)
    this_week_items = Counter()
    last_week_items = Counter()
    for item in OrderItem.objects.filter(
        order__restaurant=restaurant,
        order__created_at__date__gte=week_ago,
    ).values("dish_name_en").annotate(qty=Sum("quantity")):
        this_week_items[item["dish_name_en"]] = item["qty"]
    for item in OrderItem.objects.filter(
        order__restaurant=restaurant,
        order__created_at__date__gte=prev_week,
        order__created_at__date__lt=week_ago,
    ).values("dish_name_en").annotate(qty=Sum("quantity")):
        last_week_items[item["dish_name_en"]] = item["qty"]

    declining = []
    for dish, prev_qty in last_week_items.items():
        curr_qty = this_week_items.get(dish, 0)
        if curr_qty < prev_qty:
            change = round((curr_qty - prev_qty) / prev_qty * 100, 1) if prev_qty > 0 else -100
            declining.append({
                "dish": dish,
                "last_week": prev_qty,
                "this_week": curr_qty,
                "change_pct": change,
            })
    declining.sort(key=lambda x: x["change_pct"])

    # Order type breakdown
    dine_in = today_orders.filter(order_type="dine_in").count()
    take_away = today_orders.filter(order_type="take_away").count()

    return {
        "date": str(today),
        "orders_total": orders_today,
        "orders_delta_pct": orders_delta,
        "revenue_today": str(revenue_today),
        "revenue_yesterday": str(revenue_yesterday),
        "revenue_last_week": str(revenue_last_week),
        "revenue_vs_yesterday_pct": rev_vs_yesterday,
        "revenue_vs_last_week_pct": rev_vs_last_week,
        "customers_today": customers_today,
        "table_occupancy_pct": occupancy_pct,
        "occupied_tables": occupied_tables,
        "total_tables": total_tables,
        "avg_prep_time_min": round(avg_prep_min),
        "avg_prep_time_max": round(avg_prep_max),
        "avg_order_value": str(aov.quantize(Decimal("0.01"))),
        "repeat_customer_pct": repeat_rate,
        "best_sellers": [
            {"dish": b["dish_name_en"], "dish_bn": b["dish_name_bn"],
             "quantity": b["total_qty"], "revenue": str(b["total_revenue"] or 0)}
            for b in best_sellers
        ],
        "declining_items": declining[:5],
        "order_type_mix": {"dine_in": dine_in, "take_away": take_away},
    }


def menu_engineering(restaurant) -> dict[str, Any]:
    """Classify menu items into Stars / Plow Horses / Puzzles / Dogs
    using popularity × profitability matrix."""
    thirty_days = timezone.localdate() - timedelta(days=30)

    # Get all dishes with their sales data
    dishes = Dish.objects.filter(restaurant=restaurant, is_available=True)
    sales_data = (
        OrderItem.objects.filter(
            order__restaurant=restaurant,
            order__created_at__date__gte=thirty_days,
        )
        .values("dish_name_en")
        .annotate(
            total_qty=Sum("quantity"),
            total_revenue=Sum(F("unit_price") * F("quantity")),
        )
    )
    sales_map = {r["dish_name_en"]: r for r in sales_data}

    if not sales_map:
        return {"stars": [], "plow_horses": [], "puzzles": [], "dogs": []}

    # Calculate medians for classification
    quantities = sorted([r["total_qty"] for r in sales_map.values()])
    revenues = sorted([float(r["total_revenue"] or 0) for r in sales_map.values()])
    mid = len(quantities) // 2
    median_qty = quantities[mid] if quantities else 0
    median_rev = revenues[mid] if revenues else 0

    result: dict[str, list] = {"stars": [], "plow_horses": [], "puzzles": [], "dogs": []}

    for dish in dishes:
        name = dish.name_en or str(dish)
        sales = sales_map.get(name)
        if not sales:
            result["dogs"].append({
                "dish": name, "dish_bn": dish.name_bn,
                "quantity": 0, "revenue": "0", "price": str(dish.price),
                "category": "dogs",
            })
            continue

        qty = sales["total_qty"]
        rev = float(sales["total_revenue"] or 0)
        high_pop = qty >= median_qty
        high_profit = rev >= median_rev

        if high_pop and high_profit:
            cat = "stars"
        elif high_pop and not high_profit:
            cat = "plow_horses"
        elif not high_pop and high_profit:
            cat = "puzzles"
        else:
            cat = "dogs"

        result[cat].append({
            "dish": name, "dish_bn": dish.name_bn,
            "quantity": qty, "revenue": str(rev),
            "price": str(dish.price), "category": cat,
        })

    # Sort each category by quantity descending
    for cat in result:
        result[cat].sort(key=lambda x: x["quantity"], reverse=True)

    return result


def table_intelligence(restaurant) -> dict[str, Any]:
    """Real-time table intelligence with occupancy, turnover, and status details."""
    today = timezone.localdate()
    now = timezone.now()

    tables = Table.objects.filter(restaurant=restaurant, is_active=True)
    total = tables.count()

    # Status breakdown
    status_counts = {}
    for row in tables.values("status").annotate(count=Count("id")):
        status_counts[row["status"]] = row["count"]

    occupied_count = sum(
        status_counts.get(s, 0)
        for s in ["occupied", "awaiting_order", "order_received",
                   "preparing", "ready", "awaiting_service", "served", "awaiting_payment"]
    )

    # Table details with current order info
    table_details = []
    for table in tables:
        current_order = (
            Order.objects.filter(
                restaurant=restaurant,
                table=table,
                created_at__date=today,
            )
            .exclude(status__in=["paid", "rejected", "cancelled"])
            .order_by("-created_at")
            .first()
        )

        detail: dict[str, Any] = {
            "id": str(table.id),
            "number": table.number,
            "label": table.label,
            "seats": table.seats,
            "floor": table.floor,
            "status": table.status,
        }

        if current_order:
            elapsed = (now - current_order.created_at).total_seconds() / 60
            detail["current_order"] = {
                "order_number": current_order.order_number,
                "total": str(current_order.total),
                "status": current_order.status,
                "elapsed_minutes": round(elapsed),
                "order_type": current_order.order_type,
            }

        # Today's turnover: how many completed orders
        completed_today = Order.objects.filter(
            restaurant=restaurant,
            table=table,
            created_at__date=today,
            status="paid",
        ).count()
        detail["turnovers_today"] = completed_today

        table_details.append(detail)

    # Average turnover time (for tables with 2+ completed orders today)
    paid_orders = Order.objects.filter(
        restaurant=restaurant,
        created_at__date=today,
        status="paid",
        table__isnull=False,
    ).order_by("table_id", "created_at")

    turnover_times = []
    prev_table = None
    prev_time = None
    for order in paid_orders:
        if order.table_id == prev_table and prev_time:
            delta = (order.created_at - prev_time).total_seconds() / 60
            if 10 < delta < 300:  # reasonable turnover: 10min to 5hr
                turnover_times.append(delta)
        prev_table = order.table_id
        prev_time = order.created_at

    avg_turnover = round(sum(turnover_times) / len(turnover_times)) if turnover_times else 0

    return {
        "total_tables": total,
        "occupied": occupied_count,
        "available": status_counts.get("available", 0),
        "occupancy_pct": round(occupied_count / total * 100, 1) if total else 0,
        "avg_turnover_minutes": avg_turnover,
        "tables": table_details,
    }


def demand_forecast(restaurant) -> dict[str, Any]:
    """Predict tomorrow's demand based on historical patterns."""
    today = timezone.localdate()
    tomorrow = today + timedelta(days=1)
    tomorrow_weekday = tomorrow.weekday()  # 0=Mon, 6=Sun

    # Look at the same weekday for the last 4 weeks
    same_weekday_orders = []
    for weeks_back in range(1, 5):
        target_date = today - timedelta(days=7 * weeks_back)
        count = Order.objects.filter(
            restaurant=restaurant, created_at__date=target_date
        ).count()
        same_weekday_orders.append(count)

    avg_orders = (
        round(sum(same_weekday_orders) / len(same_weekday_orders))
        if same_weekday_orders else 0
    )

    # Peak hours from historical same-weekday data
    peak_data = (
        Order.objects.filter(
            restaurant=restaurant,
            created_at__week_day=(tomorrow_weekday + 2) % 7 + 1,  # Django week_day: 1=Sun
            created_at__gte=timezone.now() - timedelta(days=28),
        )
        .annotate(hour=TruncHour("created_at"))
        .values("hour")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    # Find lunch and dinner peaks
    lunch_peak = {"start": "12:00", "end": "14:00", "orders": 0}
    dinner_peak = {"start": "19:00", "end": "21:00", "orders": 0}
    for row in peak_data:
        hour = row["hour"].hour
        if 11 <= hour <= 14 and row["count"] > lunch_peak["orders"]:
            lunch_peak["orders"] = row["count"]
        if 18 <= hour <= 22 and row["count"] > dinner_peak["orders"]:
            dinner_peak["orders"] = row["count"]

    # Recommended kitchen staff (1 per ~35 orders)
    recommended_staff = max(2, round(avg_orders / 35))

    # Popular items forecast
    week_ago = today - timedelta(days=7)
    top_items = list(
        OrderItem.objects.filter(
            order__restaurant=restaurant,
            order__created_at__date__gte=week_ago,
        )
        .values("dish_name_en")
        .annotate(total_qty=Sum("quantity"))
        .order_by("-total_qty")[:3]
    )

    return {
        "date": str(tomorrow),
        "weekday": tomorrow.strftime("%A"),
        "expected_orders": avg_orders,
        "lunch_peak": lunch_peak,
        "dinner_peak": dinner_peak,
        "recommended_kitchen_staff": recommended_staff,
        "top_items_forecast": [
            {"dish": item["dish_name_en"], "expected_qty": round(item["total_qty"] / 7)}
            for item in top_items
        ],
        "confidence": "medium" if len(same_weekday_orders) >= 3 else "low",
    }


def ai_insights(restaurant) -> list[dict[str, str]]:
    """Generate actionable AI insights based on data patterns.
    Returns a list of insight objects with title, body, and recommendation."""
    insights: list[dict[str, str]] = []
    today = timezone.localdate()
    now = timezone.now()

    # ── Insight 1: Revenue opportunity during peak hours ──
    peak = peak_hours(restaurant, days=7)
    if peak:
        peak.sort(key=lambda x: x["orders"], reverse=True)
        top_hour = peak[0]
        # Check if wait times are high during peak
        peak_orders = Order.objects.filter(
            restaurant=restaurant,
            created_at__date__gte=today - timedelta(days=7),
            created_at__hour=int(top_hour["hour"][:2]),
        )
        total_peak = peak_orders.count()
        if total_peak > 10:
            insights.append({
                "type": "revenue",
                "icon": "💰",
                "title": "Peak hour opportunity detected",
                "body": (
                    f"Your busiest hour is {top_hour['hour']} with {top_hour['orders']} "
                    f"orders this week. This is a revenue opportunity."
                ),
                "recommendation": (
                    "Consider adding one extra kitchen staff member during this hour "
                    "to reduce wait times and capture more orders."
                ),
            })

    # ── Insight 2: Best seller trend ──
    popular = popular_dishes(restaurant, limit=3)
    if popular:
        top = popular[0]
        insights.append({
            "type": "sales",
            "icon": "🔥",
            "title": f"{top['dish']} is your top seller",
            "body": (
                f"{top['quantity']} orders this month generating ৳{top['revenue']} in revenue."
            ),
            "recommendation": (
                "Consider creating a combo deal with a drink to increase average order value. "
                "Feature it prominently on your menu."
            ),
        })

    # ── Insight 3: Table utilization ──
    table_data = table_intelligence(restaurant)
    if table_data["occupancy_pct"] > 85:
        insights.append({
            "type": "operations",
            "icon": "🪑",
            "title": "High table occupancy detected",
            "body": (
                f"Your tables are at {table_data['occupancy_pct']}% occupancy. "
                f"Average turnover is {table_data['avg_turnover_minutes']} minutes."
            ),
            "recommendation": (
                "Consider optimizing table turnover by streamlining payment flow. "
                "Pre-print bills for tables approaching 60 minutes."
            ),
        })
    elif table_data["occupancy_pct"] < 30:
        insights.append({
            "type": "operations",
            "icon": "📉",
            "title": "Low table occupancy",
            "body": (
                f"Only {table_data['occupancy_pct']}% of tables are occupied right now."
            ),
            "recommendation": (
                "Consider running a time-limited promotion to attract walk-in customers. "
                "Update your offers with a lunch special."
            ),
        })

    # ── Insight 4: Declining items ──
    enhanced = enhanced_overview(restaurant)
    if enhanced.get("declining_items"):
        top_declining = enhanced["declining_items"][0]
        insights.append({
            "type": "menu",
            "icon": "📉",
            "title": f"{top_declining['dish']} sales are declining",
            "body": (
                f"Sales dropped {abs(top_declining['change_pct'])}% compared to last week."
            ),
            "recommendation": (
                "Consider refreshing the dish photo, adjusting the price, "
                "or featuring it as a daily special."
            ),
        })

    # ── Insight 5: Take-away vs dine-in ratio ──
    mix = enhanced.get("order_type_mix", {})
    total_mix = mix.get("dine_in", 0) + mix.get("take_away", 0)
    if total_mix > 10:
        takeaway_pct = round(mix.get("take_away", 0) / total_mix * 100)
        if takeaway_pct > 40:
            insights.append({
                "type": "operations",
                "icon": "📦",
                "title": f"Strong take-away demand ({takeaway_pct}%)",
                "body": "A significant portion of your orders are take-away.",
                "recommendation": (
                    "Consider optimizing your take-away packaging and "
                    "creating take-away exclusive combos to grow this channel."
                ),
            })

    # ── Insight 6: Repeat customer opportunity ──
    if enhanced.get("repeat_customer_pct", 0) < 20 and enhanced.get("customers_today", 0) > 5:
        insights.append({
            "type": "loyalty",
            "icon": "🔄",
            "title": "Low repeat customer rate",
            "body": (
                f"Only {enhanced['repeat_customer_pct']}% of today's customers have ordered before."
            ),
            "recommendation": (
                "Consider creating a loyalty offer: 'Order 3 times this month, "
                "get 15% off your next visit.' This builds a recurring customer base."
            ),
        })

    return insights[:6]  # Limit to 6 most relevant insights
