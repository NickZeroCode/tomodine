import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import { useAuth } from "@/context/AuthContext";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/FormField";
import type { ApiError, Membership, Role } from "@/types";

export function StaffPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const membersKey = ["staff", restaurant?.id];
  const rolesKey = ["roles", restaurant?.id];

  const {
    data: members,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: membersKey,
    queryFn: async () =>
      (await api.get<Membership[]>(`/restaurants/${restaurant!.id}/members-list/`)).data,
    enabled: !!restaurant,
  });

  const { data: roles } = useQuery({
    queryKey: rolesKey,
    queryFn: async () =>
      (await api.get<Role[]>(`/restaurants/${restaurant!.id}/roles/`)).data,
    enabled: !!restaurant,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: membersKey });

  const invite = useMutation({
    mutationFn: async () =>
      api.post(`/restaurants/${restaurant!.id}/members/`, {
        email,
        role: roleId || null,
      }),
    onSuccess: () => {
      setInviteOpen(false);
      setEmail("");
      setRoleId("");
      setErrors({});
      invalidate();
    },
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      setErrors(apiErr.errors ?? { non_field_errors: [apiErr.message] });
    },
  });

  const changeRole = useMutation({
    mutationFn: async (input: { id: string; role: string | null }) =>
      api.patch(`/restaurants/${restaurant!.id}/members/${input.id}/`, {
        role: input.role,
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      api.delete(`/restaurants/${restaurant!.id}/members/${id}/`),
    onSuccess: invalidate,
  });

  function onInvite(e: FormEvent) {
    e.preventDefault();
    invite.mutate();
  }

  function roleLabel(role: Role): string {
    return lang === "bn" && role.name_bn ? role.name_bn : role.name_en;
  }

  if (!restaurant) return <EmptyState />;
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const list = members ?? [];

  return (
    <section aria-labelledby="staff-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="staff-heading" className="text-lg font-semibold text-ink-900">
          {t("staff.title")}
        </h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setErrors({});
            setInviteOpen(true);
          }}
        >
          {t("staff.invite")}
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState title={t("staff.noStaff")} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map((m) => (
            <li
              key={m.id}
              className="card flex flex-wrap items-center justify-between gap-3 p-4 transition-shadow hover:shadow-lift"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
                  {m.user_email.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {m.user_email}
                    {m.is_owner && (
                      <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {t("staff.owner")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-500">
                    <span
                      className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                        m.is_active ? "bg-emerald-500" : "bg-ink-300"
                      }`}
                      aria-hidden="true"
                    />
                    {m.is_active ? t("staff.active") : t("staff.inactive")}
                    {m.user_email === user?.email && ` · ${t("staff.owner")}`}
                  </p>
                </div>
              </div>
              {!m.is_owner && (
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    className="input w-auto px-2 py-1 text-xs"
                    value={m.role ?? ""}
                    disabled={changeRole.isPending}
                    onChange={(e) =>
                      changeRole.mutate({ id: m.id, role: e.target.value || null })
                    }
                    aria-label={t("staff.role")}
                  >
                    <option value="">{t("staff.selectRole")}</option>
                    {(roles ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs text-red-600"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(t("staff.removeConfirm"))) remove.mutate(m.id);
                    }}
                  >
                    {t("staff.remove")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {inviteOpen && (
        <Modal title={t("staff.invite")} onClose={() => setInviteOpen(false)}>
          <form onSubmit={onInvite} className="space-y-4" noValidate>
            <TextField
              label={t("staff.inviteEmail")}
              type="email"
              value={email}
              required
              error={errors.email?.[0]}
              onChange={setEmail}
            />
            <Field label={t("staff.role")} error={errors.role?.[0]}>
              {(id) => (
                <select
                  id={id}
                  className="input"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                >
                  <option value="">{t("staff.selectRole")}</option>
                  {(roles ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {errors.non_field_errors && (
              <p className="text-sm text-red-600" role="alert">
                {errors.non_field_errors[0]}
              </p>
            )}
            {errors.detail && (
              <p className="text-sm text-red-600" role="alert">
                {errors.detail[0]}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setInviteOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn-primary" disabled={invite.isPending}>
                {invite.isPending ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
