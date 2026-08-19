"""API v1 URL routing."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import LoginView, MeView, RefreshView, RegisterView

from .customer_views import CustomerOrderingViewSet
from .views import (
    AnalyticsViewSet,
    BillingRecordViewSet,
    DishViewSet,
    MenuCategoryViewSet,
    MenuViewSet,
    NotificationViewSet,
    OfferViewSet,
    OrderViewSet,
    QRCodeViewSet,
    RestaurantViewSet,
    SubscriptionPlanViewSet,
    SubscriptionViewSet,
    TableViewSet,
)

router = DefaultRouter()
router.register("restaurants", RestaurantViewSet, basename="restaurant")
router.register("tables", TableViewSet, basename="table")
router.register("qr-codes", QRCodeViewSet, basename="qrcode")
router.register("menus", MenuViewSet, basename="menu")
router.register("menu-categories", MenuCategoryViewSet, basename="menu-category")
router.register("dishes", DishViewSet, basename="dish")
router.register("orders", OrderViewSet, basename="order")
router.register("subscription-plans", SubscriptionPlanViewSet, basename="subscription-plan")
router.register("subscriptions", SubscriptionViewSet, basename="subscription")
router.register("billing-records", BillingRecordViewSet, basename="billing-record")
router.register("offers", OfferViewSet, basename="offer")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("analytics", AnalyticsViewSet, basename="analytics")
router.register("public", CustomerOrderingViewSet, basename="public")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("", include(router.urls)),
]
