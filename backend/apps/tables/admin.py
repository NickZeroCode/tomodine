from django.contrib import admin

from .models import QRCode, Table


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ("number", "restaurant", "seats", "floor", "status", "is_active")
    list_filter = ("status", "is_active")
    search_fields = ("number", "restaurant__name")


@admin.register(QRCode)
class QRCodeAdmin(admin.ModelAdmin):
    list_display = ("table", "restaurant", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("table__number", "restaurant__name")
    readonly_fields = ("token",)
