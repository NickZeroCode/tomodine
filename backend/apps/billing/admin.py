from django.contrib import admin

from .models import BillingRecord, Subscription, SubscriptionPlan


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name_en", "code", "price", "currency", "interval", "is_active")
    list_filter = ("interval", "is_active")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "plan", "status", "trial_ends_at", "current_period_end", "auto_renew")
    list_filter = ("status", "auto_renew")


@admin.register(BillingRecord)
class BillingRecordAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "amount", "currency", "status", "created_at")
    list_filter = ("status", "currency")
