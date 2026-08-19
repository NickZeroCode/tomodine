from django.contrib import admin

from .models import Permission, Role


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("codename", "name_en", "group")
    search_fields = ("codename", "name_en")
    list_filter = ("group",)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name_en", "slug", "restaurant", "is_system")
    search_fields = ("name_en", "slug")
    list_filter = ("is_system",)
    filter_horizontal = ("permissions",)
