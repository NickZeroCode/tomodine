from django.contrib import admin

from .models import Dish, DishModifier, DishVariant, Menu, MenuCategory


class CategoryInline(admin.TabularInline):
    model = MenuCategory
    extra = 0


@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    list_display = ("name_en", "restaurant", "is_active", "display_order")
    list_filter = ("is_active",)
    search_fields = ("name_en", "restaurant__name")
    inlines = (CategoryInline,)


@admin.register(MenuCategory)
class MenuCategoryAdmin(admin.ModelAdmin):
    list_display = ("name_en", "restaurant", "menu", "is_active", "display_order")
    list_filter = ("is_active",)
    search_fields = ("name_en", "name_bn")


class VariantInline(admin.TabularInline):
    model = DishVariant
    extra = 0


class ModifierInline(admin.TabularInline):
    model = DishModifier
    extra = 0


@admin.register(Dish)
class DishAdmin(admin.ModelAdmin):
    list_display = ("name_en", "restaurant", "category", "price", "is_available")
    list_filter = ("is_available", "is_featured", "is_vegetarian")
    search_fields = ("name_en", "name_bn")
    inlines = (VariantInline, ModifierInline)
