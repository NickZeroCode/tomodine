"""Celery tasks for the menus app.

Computes frequently-bought-together associations using Apriori at k=2.
Runs periodically via Celery Beat.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

try:
    from celery import shared_task
except ImportError:
    def shared_task(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator


@shared_task(ignore_result=True)
def compute_frequently_bought_together():
    """Compute dish co-occurrence associations for all active restaurants.

    Uses Apriori at k=2: counts how often each pair of dishes appears
    in the same order, then computes confidence and lift scores.

    Runs as a single SQL query per restaurant — no ORM loops, no memory issues.
    """
    from django.db import connection

    from apps.restaurants.models import Restaurant

    restaurants = Restaurant.objects.filter(status="active").values_list("id", flat=True)
    total_pairs = 0

    for restaurant_id in restaurants:
        try:
            count = _compute_for_restaurant(restaurant_id)
            total_pairs += count
        except Exception:
            logger.exception("Failed to compute associations for restaurant %s", restaurant_id)

    logger.info("Association computation complete: %d total pairs across all restaurants", total_pairs)


def _compute_for_restaurant(restaurant_id: str) -> int:
    """Run the Apriori k=2 SQL for a single restaurant.

    Returns the number of associations created/updated.
    """
    from django.db import connection

    with connection.cursor() as cur:
        # Step 1: Get order-level dish counts for confidence denominator.
        # Step 2: Count co-occurrences.
        # Step 3: Compute confidence = support / count_a, lift = confidence / (count_b / total_orders).
        # Step 4: Upsert into DishAssociation.
        cur.execute("""
            WITH
            -- Total distinct orders for this restaurant in last 90 days
            total_orders AS (
                SELECT COUNT(DISTINCT id) AS n
                FROM ordering_order
                WHERE restaurant_id = %(rid)s
                  AND created_at >= NOW() - INTERVAL '90 days'
                  AND status NOT IN ('rejected', 'cancelled')
            ),
            -- Per-dish order counts (how many orders contain each dish)
            dish_counts AS (
                SELECT oi.dish_name_en, COUNT(DISTINCT oi.order_id) AS order_count
                FROM ordering_orderitem oi
                JOIN ordering_order o ON o.id = oi.order_id
                WHERE o.restaurant_id = %(rid)s
                  AND o.created_at >= NOW() - INTERVAL '90 days'
                  AND o.status NOT IN ('rejected', 'cancelled')
                GROUP BY oi.dish_name_en
            ),
            -- Co-occurrence pairs
            pairs AS (
                SELECT
                    LEAST(oi_a.dish_name_en, oi_b.dish_name_en) AS name_a,
                    GREATEST(oi_a.dish_name_en, oi_b.dish_name_en) AS name_b,
                    COUNT(DISTINCT oi_a.order_id) AS support
                FROM ordering_orderitem oi_a
                JOIN ordering_orderitem oi_b
                  ON oi_a.order_id = oi_b.order_id
                 AND oi_a.dish_name_en < oi_b.dish_name_en
                JOIN ordering_order o ON o.id = oi_a.order_id
                WHERE o.restaurant_id = %(rid)s
                  AND o.created_at >= NOW() - INTERVAL '90 days'
                  AND o.status NOT IN ('rejected', 'cancelled')
                GROUP BY name_a, name_b
                HAVING COUNT(DISTINCT oi_a.order_id) >= 2
            ),
            -- Scored pairs with confidence and lift
            scored AS (
                SELECT
                    p.name_a,
                    p.name_b,
                    p.support,
                    -- confidence = P(b | a) = support / orders_containing_a
                    ROUND(p.support::numeric / NULLIF(dca.order_count, 0), 3) AS confidence,
                    -- lift = confidence / P(b) = confidence / (orders_containing_b / total_orders)
                    ROUND(
                        (p.support::numeric / NULLIF(dca.order_count, 0))
                        / NULLIF(dcb.order_count::numeric / NULLIF((SELECT n FROM total_orders), 0), 0),
                        2
                    ) AS lift
                FROM pairs p
                JOIN dish_counts dca ON dca.dish_name_en = p.name_a
                JOIN dish_counts dcb ON dcb.dish_name_en = p.name_b
                WHERE (SELECT n FROM total_orders) > 0
            )
            INSERT INTO menus_dishassociation (
                restaurant_id, dish_a_id, dish_b_id, support, confidence, lift, created_at, updated_at
            )
            SELECT
                %(rid)s::uuid,
                da.id,
                db.id,
                s.support,
                s.confidence,
                COALESCE(s.lift, 1),
                NOW(),
                NOW()
            FROM scored s
            JOIN menus_dish da ON da.restaurant_id = %(rid)s AND da.name_en = s.name_a
            JOIN menus_dish db ON db.restaurant_id = %(rid)s AND db.name_en = s.name_b
            WHERE s.confidence >= 0.15 AND COALESCE(s.lift, 0) > 1
            ON CONFLICT (restaurant_id, dish_a_id, dish_b_id)
            DO UPDATE SET
                support = EXCLUDED.support,
                confidence = EXCLUDED.confidence,
                lift = EXCLUDED.lift,
                updated_at = NOW()
        """, {"rid": str(restaurant_id)})

        row_count = cur.rowcount

        # Prune stale associations (no longer relevant).
        cur.execute("""
            DELETE FROM menus_dishassociation
            WHERE restaurant_id = %(rid)s
              AND updated_at < NOW() - INTERVAL '7 days'
        """, {"rid": str(restaurant_id)})

        logger.info("Restaurant %s: %d associations updated", restaurant_id, row_count)
        return row_count
