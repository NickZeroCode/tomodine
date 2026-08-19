from django.contrib import admin

from .models import Restaurant, RestaurantMembership


class MembershipInline(admin.TabularInline):
    model = RestaurantMembership
    extra = 0
    autocomplete_fields = ("user", "role")


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "owner", "status", "currency", "created_at")
    search_fields = ("name", "slug", "phone")
    list_filter = ("status", "currency", "division")
    prepopulated_fields = {"slug": ("name",)}
    inlines = (MembershipInline,)


@admin.register(RestaurantMembership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "restaurant", "role", "is_owner", "is_active")
    list_filter = ("is_owner", "is_active")
    search_fields = ("user__email", "restaurant__name")
