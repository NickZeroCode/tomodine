from django.contrib import admin

from .models import Cart, CartItem, CustomerSession, Order, OrderItem, OrderStatusHistory


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


class HistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ("from_status", "to_status", "changed_by", "note", "created_at")
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "restaurant", "table", "status", "total", "created_at")
    list_filter = ("status",)
    search_fields = ("order_number", "restaurant__name")
    inlines = (OrderItemInline, HistoryInline)
    readonly_fields = ("subtotal", "total")


@admin.register(CustomerSession)
class CustomerSessionAdmin(admin.ModelAdmin):
    list_display = ("token", "restaurant", "table", "language", "is_active")
    list_filter = ("is_active", "language")


admin.site.register(Cart)
admin.site.register(CartItem)
