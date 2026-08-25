import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/imageCompression";
import { formatBDT, localized } from "@/lib/format";
import { useRestaurant } from "@/context/RestaurantContext";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/FormField";
import { useConfirm } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { DishDetailModal } from "@/components/DishDetailModal";
import { ModifierGroupsEditor } from "@/components/ModifierGroupsEditor";
import { VariantsEditor } from "@/components/VariantsEditor";
import type { ApiError, Dish, Menu, MenuCategory } from "@/types";

interface DishFormState {
  category: string;
  name_en: string;
  name_bn: string;
  description_en: string;
  description_bn: string;
  price: string;
  min_prep_time: string;
  max_prep_time: string;
  is_available: boolean;
  is_featured: boolean;
  is_vegetarian: boolean;
  is_spicy: boolean;
}

interface CategoryFormState {
  menu: string;
  name_en: string;
  name_bn: string;
}

interface MenuFormState {
  name_en: string;
  name_bn: string;
}

const EMPTY_DISH: DishFormState = {
  category: "",
  name_en: "",
  name_bn: "",
  description_en: "",
  description_bn: "",
  price: "",
  min_prep_time: "15",
  max_prep_time: "30",
  is_available: true,
  is_featured: false,
  is_vegetarian: false,
  is_spicy: false,
};

function dishToForm(dish: Dish): DishFormState {
  return {
    category: dish.category,
    name_en: dish.name_en,
    name_bn: dish.name_bn,
    description_en: dish.description_en,
    description_bn: dish.description_bn,
    price: dish.price,
    min_prep_time: String(dish.min_prep_time ?? 15),
    max_prep_time: String(dish.max_prep_time ?? 30),
    is_available: dish.is_available,
    is_featured: dish.is_featured,
    is_vegetarian: dish.is_vegetarian,
    is_spicy: dish.is_spicy,
  };
}

export function MenuPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [dishFormOpen, setDishFormOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [dishForm, setDishForm] = useState<DishFormState>(EMPTY_DISH);
  const [dishErrors, setDishErrors] = useState<Record<string, string[]>>({});
  const [dishImage, setDishImage] = useState<File | null>(null);
  const [removeDishImage, setRemoveDishImage] = useState(false);
  const [detailDish, setDetailDish] = useState<Dish | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null);
  const [catForm, setCatForm] = useState<CategoryFormState>({
    menu: "",
    name_en: "",
    name_bn: "",
  });
  const [catErrors, setCatErrors] = useState<Record<string, string[]>>({});

  const [menuFormOpen, setMenuFormOpen] = useState(false);
  const [menuForm, setMenuForm] = useState<MenuFormState>({ name_en: "", name_bn: "" });
  const [menuErrors, setMenuErrors] = useState<Record<string, string[]>>({});

  const menusKey = ["menus", restaurant?.slug];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: menusKey,
    queryFn: async () => {
      const res = await api.get("/menus/");
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as Menu[];
    },
    enabled: !!restaurant,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: menusKey });

  const onMutError =
    (setErrors: (e: Record<string, string[]>) => void) => (err: unknown) => {
      const apiErr = err as unknown as ApiError;
      const errors = apiErr.errors && Object.keys(apiErr.errors).length > 0
        ? apiErr.errors
        : { non_field_errors: [apiErr.message || "An unexpected error occurred."] };
      setErrors(errors);
    };

  const saveDish = useMutation({
    mutationFn: async (input: DishFormState) => {
      const fd = new FormData();
      fd.append("category", input.category);
      fd.append("name_en", input.name_en);
      fd.append("name_bn", input.name_bn);
      fd.append("description_en", input.description_en);
      fd.append("description_bn", input.description_bn);
      fd.append("price", input.price || "0");
      fd.append("is_available", String(input.is_available));
      fd.append("is_featured", String(input.is_featured));
      fd.append("is_vegetarian", String(input.is_vegetarian));
      fd.append("is_spicy", String(input.is_spicy));
      fd.append("min_prep_time", input.min_prep_time || "15");
      fd.append("max_prep_time", input.max_prep_time || "30");
      if (dishImage) fd.append("image", dishImage);
      else if (editingDish && removeDishImage) fd.append("image", "");

      if (editingDish) return api.patch(`/dishes/${editingDish.id}/`, fd);
      return api.post("/dishes/", fd);
    },
    onSuccess: () => {
      setDishFormOpen(false);
      setEditingDish(null);
      setDishForm(EMPTY_DISH);
      setDishErrors({});
      setDishImage(null);
      setRemoveDishImage(false);
      invalidate();
    },
    onError: onMutError(setDishErrors),
  });

  const removeDish = useMutation({
    mutationFn: async (id: string) => api.delete(`/dishes/${id}/`),
    onSuccess: invalidate,
  });

  const saveCategory = useMutation({
    mutationFn: async (input: CategoryFormState) => {
      if (editingCat) {
        return api.patch(`/menu-categories/${editingCat.id}/`, {
          name_en: input.name_en,
          name_bn: input.name_bn,
        });
      }
      return api.post("/menu-categories/", input);
    },
    onSuccess: () => {
      setCatFormOpen(false);
      setEditingCat(null);
      setCatForm({ menu: "", name_en: "", name_bn: "" });
      setCatErrors({});
      invalidate();
    },
    onError: onMutError(setCatErrors),
  });

  const removeCategory = useMutation({
    mutationFn: async (id: string) => api.delete(`/menu-categories/${id}/`),
    onSuccess: invalidate,
  });

  const saveMenu = useMutation({
    mutationFn: async (input: MenuFormState) => api.post("/menus/", input),
    onSuccess: () => {
      setMenuFormOpen(false);
      setMenuForm({ name_en: "", name_bn: "" });
      setMenuErrors({});
      invalidate();
    },
    onError: onMutError(setMenuErrors),
  });

  function openDishCreate(categoryId?: string) {
    setEditingDish(null);
    // Auto-select when there is exactly one category so the form is never
    // submitted with an empty category (which the API rejects as null).
    const auto =
      categoryId ?? (allCategories.length === 1 ? allCategories[0].id : "");
    setDishForm({ ...EMPTY_DISH, category: auto });
    setDishErrors({});
    setDishImage(null);
    setRemoveDishImage(false);
    setDishFormOpen(true);
  }

  function openDishEdit(dish: Dish) {
    setEditingDish(dish);
    setDishForm(dishToForm(dish));
    setDishErrors({});
    setDishImage(null);
    setRemoveDishImage(false);
    setDishFormOpen(true);
  }

  function openCategoryCreate(menuId: string) {
    setEditingCat(null);
    setCatForm({ menu: menuId, name_en: "", name_bn: "" });
    setCatErrors({});
    setCatFormOpen(true);
  }

  function openCategoryEdit(menuId: string, cat: MenuCategory) {
    setEditingCat(cat);
    setCatForm({ menu: menuId, name_en: cat.name_en, name_bn: cat.name_bn });
    setCatErrors({});
    setCatFormOpen(true);
  }

  if (!restaurant) return <EmptyState />;
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const menus = data ?? [];
  const allCategories = menus.flatMap((m) =>
    m.categories.map((c) => ({ id: c.id, label: localized(c, lang) }))
  );

  function formButtons(pending: boolean, onClose: () => void) {
    return (
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? t("common.loading") : t("common.save")}
        </button>
      </div>
    );
  }

  function nonFieldErrors(errors: Record<string, string[]>) {
    return errors.non_field_errors ? (
      <p className="text-sm text-red-600" role="alert">
        {errors.non_field_errors[0]}
      </p>
    ) : null;
  }

  function flagCheckbox(
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void
  ) {
    return (
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        {label}
      </label>
    );
  }

  return (
    <section aria-labelledby="menu-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="menu-heading" className="text-lg font-semibold text-ink-900">
          {t("menu.title")}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setMenuForm({ name_en: "", name_bn: "" });
              setMenuErrors({});
              setMenuFormOpen(true);
            }}
          >
            {t("menu.addMenu")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => openDishCreate()}
          >
            {t("menu.addDish")}
          </button>
        </div>
      </div>

      {menus.length === 0 ? (
        <EmptyState
          title={t("common.empty")}
          action={
            <button
              type="button"
              className="btn-primary"
              onClick={() => setMenuFormOpen(true)}
            >
              {t("menu.addMenu")}
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {menus.map((menu) => (
            <div key={menu.id} className="card p-4">
              <h3 className="mb-3 truncate text-base font-semibold text-ink-900">
                {localized(menu, lang)}
              </h3>
              {menu.categories.length === 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink-500">{t("common.empty")}</p>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => openCategoryCreate(menu.id)}
                  >
                    {t("menu.addCategory")}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {menu.categories.map((cat) => (
                    <div key={cat.id}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="min-w-0 truncate text-sm font-medium text-ink-700">
                          {localized(cat, lang)}
                        </h4>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() => openDishCreate(cat.id)}
                          >
                            {t("menu.addDish")}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() => openCategoryEdit(menu.id, cat)}
                          >
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs text-red-600"
                            disabled={removeCategory.isPending}
                            onClick={async () => {
                              const ok = await confirm(t("menu.deleteCategoryConfirm"));
                              if (ok) removeCategory.mutate(cat.id);
                            }}
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </div>
                      {cat.dishes.length === 0 ? (
                        <p className="text-sm text-ink-400">{t("common.empty")}</p>
                      ) : (
                        <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                          {cat.dishes.map((dish) => (
                            <div
                              key={dish.id}
                              className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lift"
                            >
                              {/* Dish image — large, prominent */}
                              <div className="relative h-52 w-full overflow-hidden bg-ink-50">
                                {dish.image ? (
                                  <img src={dish.image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Icon name="image" className="h-10 w-10 text-ink-200" />
                                  </div>
                                )}
                                {/* Status badges overlay */}
                                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                                  {dish.is_featured && (
                                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">{t("menu.featured")}</span>
                                  )}
                                  {!dish.is_available && (
                                    <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] font-semibold text-white">{t("menu.unavailable")}</span>
                                  )}
                                  {dish.variants && dish.variants.length > 0 && (
                                    <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                      {dish.variants.length} {lang === "bn" ? "সাইজ" : "sizes"}
                                    </span>
                                  )}
                                  {dish.modifier_groups && dish.modifier_groups.length > 0 && (
                                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                      {dish.modifier_groups.length} {lang === "bn" ? "গ্রুপ" : "groups"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Info */}
                              <div className="flex flex-1 flex-col p-3.5">
                                <p className="text-sm font-semibold text-ink-900">
                                  {localized(dish, lang)}
                                </p>
                                <div className="mt-1 flex items-center gap-1.5">
                                  {dish.is_vegetarian && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Icon name="vegetarian" className="h-3 w-3" /> {t("menu.vegetarian")}</span>}
                                  {dish.is_spicy && <span className="inline-flex items-center gap-1 text-xs text-red-500"><Icon name="spicy" className="h-3 w-3" /> {t("menu.spicy")}</span>}
                                </div>
                                <p className="mt-auto pt-3 text-base font-bold text-brand-700">{formatBDT(dish.price, lang)}</p>
                                <div className="mt-2 flex gap-1.5">
                                  <button
                                    type="button"
                                    className="btn-ghost px-2 py-1.5 text-xs"
                                    onClick={() => setDetailDish(dish)}
                                  >
                                    <Icon name="eye" className="mr-1 h-3.5 w-3.5" />{t("common.view")}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-ghost flex-1 px-2 py-1.5 text-xs"
                                    onClick={() => openDishEdit(dish)}
                                  >
                                    {t("common.edit")}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-ghost px-2 py-1.5 text-xs text-red-600"
                                    disabled={removeDish.isPending}
                                    onClick={async () => {
                                      const ok = await confirm(t("menu.deleteDishConfirm"));
                                      if (ok) removeDish.mutate(dish.id);
                                    }}
                                  >
                                    {t("common.delete")}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => openCategoryCreate(menu.id)}
                    >
                      {t("menu.addCategory")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {menuFormOpen && (
        <Modal title={t("menu.addMenu")} onClose={() => setMenuFormOpen(false)}>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              saveMenu.mutate(menuForm);
            }}
            className="space-y-4"
            noValidate
          >
            <TextField
              label={t("menu.nameEn")}
              value={menuForm.name_en}
              required
              error={menuErrors.name_en?.[0]}
              onChange={(v) => setMenuForm((f) => ({ ...f, name_en: v }))}
            />
            <TextField
              label={t("menu.nameBn")}
              value={menuForm.name_bn}
              required
              error={menuErrors.name_bn?.[0]}
              onChange={(v) => setMenuForm((f) => ({ ...f, name_bn: v }))}
            />
            {nonFieldErrors(menuErrors)}
            {formButtons(saveMenu.isPending, () => setMenuFormOpen(false))}
          </form>
        </Modal>
      )}

      {catFormOpen && (
        <Modal
          title={editingCat ? t("menu.editCategory") : t("menu.addCategory")}
          onClose={() => setCatFormOpen(false)}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              saveCategory.mutate(catForm);
            }}
            className="space-y-4"
            noValidate
          >
            <TextField
              label={t("menu.nameEn")}
              value={catForm.name_en}
              required
              error={catErrors.name_en?.[0]}
              onChange={(v) => setCatForm((f) => ({ ...f, name_en: v }))}
            />
            <TextField
              label={t("menu.nameBn")}
              value={catForm.name_bn}
              required
              error={catErrors.name_bn?.[0]}
              onChange={(v) => setCatForm((f) => ({ ...f, name_bn: v }))}
            />
            {nonFieldErrors(catErrors)}
            {formButtons(saveCategory.isPending, () => setCatFormOpen(false))}
          </form>
        </Modal>
      )}

      {dishFormOpen && (
        <Modal
          title={editingDish ? t("menu.editDish") : t("menu.addDish")}
          onClose={() => setDishFormOpen(false)}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              saveDish.mutate(dishForm);
            }}
            className="space-y-4"
            noValidate
          >
            <Field label={t("menu.category")} required error={dishErrors.category?.[0]}>
              {(id) => (
                <select
                  id={id}
                  className="input"
                  value={dishForm.category}
                  onChange={(e) =>
                    setDishForm((f) => ({ ...f, category: e.target.value }))
                  }
                  required
                >
                  <option value="">{t("menu.selectCategory")}</option>
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <TextField
              label={t("menu.nameEn")}
              value={dishForm.name_en}
              required
              error={dishErrors.name_en?.[0]}
              onChange={(v) => setDishForm((f) => ({ ...f, name_en: v }))}
            />
            <TextField
              label={t("menu.nameBn")}
              value={dishForm.name_bn}
              required
              error={dishErrors.name_bn?.[0]}
              onChange={(v) => setDishForm((f) => ({ ...f, name_bn: v }))}
            />
            <TextField
              label={t("menu.descriptionEn")}
              value={dishForm.description_en}
              error={dishErrors.description_en?.[0]}
              onChange={(v) => setDishForm((f) => ({ ...f, description_en: v }))}
            />
            <TextField
              label={t("menu.descriptionBn")}
              value={dishForm.description_bn}
              error={dishErrors.description_bn?.[0]}
              onChange={(v) => setDishForm((f) => ({ ...f, description_bn: v }))}
            />
            <Field label={t("menu.image")} error={dishErrors.image?.[0]}>
              {(id) => {
                const preview = dishImage
                  ? URL.createObjectURL(dishImage)
                  : !removeDishImage && editingDish?.image
                    ? editingDish.image
                    : null;
                return (
                  <div className="flex items-center gap-3">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-ink-100 bg-ink-50">
                      {preview ? (
                        <img
                          src={preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6 text-ink-300" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l4-4a2 2 0 0 1 3 0l4 4m-2-2 2-2a2 2 0 0 1 3 0l2 2M5 20h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0">
                      <input
                        id={id}
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (file) {
                            // Compress in-browser so uploads stay fast.
                            const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.8 });
                            setDishImage(compressed);
                            setRemoveDishImage(false);
                          } else {
                            setDishImage(null);
                          }
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => imageInputRef.current?.click()}
                        >
                          {preview ? t("menu.changeImage") : t("menu.image")}
                        </button>
                        {preview && (
                          <button
                            type="button"
                            className="btn-ghost px-3 py-1.5 text-xs text-red-600"
                            onClick={() => {
                              setDishImage(null);
                              setRemoveDishImage(true);
                              if (imageInputRef.current) imageInputRef.current.value = "";
                            }}
                          >
                            {t("menu.removeImage")}
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-ink-400">{t("menu.imageHint")}</p>
                    </div>
                  </div>
                );
              }}
            </Field>
            <TextField
              label={t("menu.price")}
              type="number"
              value={dishForm.price}
              required
              error={dishErrors.price?.[0]}
              onChange={(v) => setDishForm((f) => ({ ...f, price: v }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label={t("menu.minPrepTime")}
                type="number"
                value={dishForm.min_prep_time}
                error={dishErrors.min_prep_time?.[0]}
                onChange={(v) => setDishForm((f) => ({ ...f, min_prep_time: v }))}
              />
              <TextField
                label={t("menu.maxPrepTime")}
                type="number"
                value={dishForm.max_prep_time}
                error={dishErrors.max_prep_time?.[0]}
                onChange={(v) => setDishForm((f) => ({ ...f, max_prep_time: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {flagCheckbox(t("menu.available"), dishForm.is_available, (v) =>
                setDishForm((f) => ({ ...f, is_available: v }))
              )}
              {flagCheckbox(t("menu.featured"), dishForm.is_featured, (v) =>
                setDishForm((f) => ({ ...f, is_featured: v }))
              )}
              {flagCheckbox(t("menu.vegetarian"), dishForm.is_vegetarian, (v) =>
                setDishForm((f) => ({ ...f, is_vegetarian: v }))
              )}
              {flagCheckbox(t("menu.spicy"), dishForm.is_spicy, (v) =>
                setDishForm((f) => ({ ...f, is_spicy: v }))
              )}
            </div>

            {/* Variants — only visible when editing an existing dish */}
            {editingDish && (
              <div className="border-t border-ink-100 pt-4">
                <VariantsEditor
                  dishId={editingDish.id}
                  initialVariants={editingDish.variants ?? []}
                />
              </div>
            )}

            {/* Modifier Groups — only visible when editing an existing dish */}
            {editingDish && (
              <div className="border-t border-ink-100 pt-4">
                <ModifierGroupsEditor
                  dishId={editingDish.id}
                  initialGroups={editingDish.modifier_groups ?? []}
                />
              </div>
            )}

            {nonFieldErrors(dishErrors)}
            {formButtons(saveDish.isPending, () => setDishFormOpen(false))}
          </form>
        </Modal>
      )}

      {/* Dish detail modal */}
      {detailDish && (
        <DishDetailModal
          dish={detailDish}
          lang={lang}
          onClose={() => setDetailDish(null)}
          showAddButton={false}
        />
      )}

      {confirmDialog}
    </section>
  );
}
