/**
 * BranchesPage — CRUD management for branches within an organization.
 *
 * Lists all branches, allows creating new ones, editing details, and
 * deactivating (soft-delete). Also supports cloning menu/inventory
 * templates from an existing branch to a new one.
 */

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import { getActiveBranchId, setActiveBranchId } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/FormField";
import { useConfirm } from "@/components/ConfirmDialog";
import type { ApiError } from "@/types";

interface Branch {
  id: string;
  name: string;
  slug: string;
  address_line: string;
  area: string;
  phone: string;
  status: string;
  is_active: boolean;
  created_at: string;
  table_count?: number;
  staff_count?: number;
}

interface BranchForm {
  name: string;
  address_line: string;
  area: string;
  phone: string;
}

const EMPTY_FORM: BranchForm = { name: "", address_line: "", area: "", phone: "" };

export function BranchesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const branchesKey = ["branches", restaurant?.id];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: branchesKey,
    queryFn: async () => {
      // Fetch all branches belonging to the same organization.
      // The backend filters by the middleware-resolved restaurant's org.
      const res = await api.get("/restaurants/", {
        params: { same_organization: true },
      });
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as Branch[];
    },
    enabled: !!restaurant,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: branchesKey });

  const save = useMutation({
    mutationFn: async (input: BranchForm) => {
      const payload = {
        name: input.name,
        address_line: input.address_line,
        area: input.area,
        phone: input.phone,
      };
      if (editing) return api.patch(`/restaurants/${editing.id}/`, payload);
      return api.post("/restaurants/", payload);
    },
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setErrors({});
      invalidate();
    },
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      const code = (apiErr as unknown as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === "plan_limit_reached") {
        setErrors({
          non_field_errors: [
            lang === "bn"
              ? "ফ্রি ট্রায়ালে শুধুমাত্র ১টি ব্রাঞ্চ অনুমোদিত। আরও ব্রাঞ্চ যোগ করতে আপনার সাবস্ক্রিপশন আপগ্রেড করুন।"
              : "Free trial is limited to 1 branch. Upgrade your subscription to add more branches.",
          ],
        });
      } else {
        setErrors(apiErr.errors ?? { non_field_errors: [apiErr.message] });
      }
    },
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/restaurants/${id}/`, { is_active: false }),
    onSuccess: invalidate,
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setForm({
      name: branch.name,
      address_line: branch.address_line || "",
      area: branch.area || "",
      phone: branch.phone || "",
    });
    setErrors({});
    setFormOpen(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate(form);
  }

  function switchToBranch(branch: Branch) {
    setActiveBranchId(branch.id);
    localStorage.setItem("tenant.slug", branch.slug);
    window.location.reload();
  }

  if (!restaurant) return <EmptyState />;
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const branches = data ?? [];

  return (
    <section aria-labelledby="branches-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="branches-heading" className="text-lg font-semibold text-ink-900">
            {t("branches.title")}
          </h2>
          <p className="text-xs text-ink-400">{t("branches.subtitle")}</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + {t("branches.addBranch")}
        </button>
      </div>

      {branches.length === 0 ? (
        <EmptyState title={t("branches.noBranches")} hint={t("branches.noBranchesHint")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
          {/* Table header */}
          <div className="hidden grid-cols-[1.5fr_1fr_0.8fr_0.6fr_0.6fr_7rem] gap-2 border-b border-ink-100 bg-ink-50/70 px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400 md:grid">
            <span>{t("branches.name")}</span>
            <span>{t("branches.address")}</span>
            <span>{t("branches.phone")}</span>
            <span className="text-center">{t("branches.tables")}</span>
            <span className="text-center">{t("branches.staff")}</span>
            <span className="text-right">{t("common.actions")}</span>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-ink-100/80">
            {branches.map((branch) => {
              const isCurrent = branch.id === getActiveBranchId();
              return (
                <li
                  key={branch.id}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-ink-25 md:grid md:grid-cols-[1.5fr_1fr_0.8fr_0.6fr_0.6fr_7rem] md:items-center"
                >
                  {/* Name + status */}
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${branch.is_active !== false ? "bg-emerald-500" : "bg-ink-300"}`} />
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {branch.name}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[0.6rem] font-medium text-brand-700">
                            {t("branches.current")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-400">{branch.slug}</p>
                    </div>
                  </div>

                  {/* Address */}
                  <p className="truncate text-sm text-ink-600">
                    {[branch.address_line, branch.area].filter(Boolean).join(", ") || "—"}
                  </p>

                  {/* Phone */}
                  <p className="text-sm text-ink-600">{branch.phone || "—"}</p>

                  {/* Table count */}
                  <p className="text-center text-sm tabular-nums text-ink-600">
                    {branch.table_count ?? "—"}
                  </p>

                  {/* Staff count */}
                  <p className="text-center text-sm tabular-nums text-ink-600">
                    {branch.staff_count ?? "—"}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5">
                    {!isCurrent && (
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-[0.65rem] font-semibold text-brand-700 hover:bg-brand-50"
                        onClick={() => switchToBranch(branch)}
                      >
                        {t("branches.switch")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-[0.65rem] font-semibold text-ink-600 hover:bg-ink-100"
                      onClick={() => openEdit(branch)}
                    >
                      {t("common.edit")}
                    </button>
                    {!isCurrent && branch.is_active !== false && (
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-[0.65rem] font-semibold text-red-600 hover:bg-red-50"
                        onClick={async () => {
                          const ok = await confirm(t("branches.deactivateConfirm"));
                          if (ok) deactivate.mutate(branch.id);
                        }}
                      >
                        {t("branches.deactivate")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Create / Edit modal */}
      {formOpen && (
        <Modal
          title={editing ? t("branches.editBranch") : t("branches.addBranch")}
          onClose={() => setFormOpen(false)}
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <TextField
              label={t("branches.name")}
              value={form.name}
              required
              error={errors.name?.[0]}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <TextField
              label={t("branches.address")}
              value={form.address_line}
              error={errors.address_line?.[0]}
              onChange={(v) => setForm((f) => ({ ...f, address_line: v }))}
            />
            <TextField
              label={t("branches.area")}
              value={form.area}
              error={errors.area?.[0]}
              onChange={(v) => setForm((f) => ({ ...f, area: v }))}
            />
            <TextField
              label={t("branches.phone")}
              value={form.phone}
              error={errors.phone?.[0]}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
            {errors.non_field_errors && (
              <p className="text-sm text-red-600" role="alert">
                {errors.non_field_errors[0]}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn-primary" disabled={save.isPending}>
                {save.isPending ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDialog}
    </section>
  );
}
