import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/FormField";
import type { ApiError, Membership, Role } from "@/types";

export function StaffPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

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
      (await api.post<{ invite_url?: string }>(`/restaurants/${restaurant!.id}/members/`, {
        email,
        role: roleId || null,
      })).data,
    onSuccess: (data) => {
      setErrors({});
      // If the invited person hasn't claimed an account yet, show the
      // invite link so the owner can share it (WhatsApp/SMS).
      if (data?.invite_url) {
        setInviteUrl(data.invite_url);
        setInviteOpen(false);
        setEmail("");
        setRoleId("");
      } else {
        // Existing user — they'll see the restaurant on next login.
        setInviteOpen(false);
        setEmail("");
        setRoleId("");
        invalidate();
      }
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

  const transfer = useMutation({
    mutationFn: async (input: { memberId: string; targetBranchId: string }) =>
      api.post(`/restaurants/${restaurant!.id}/members/${input.memberId}/transfer/`, {
        target_branch_id: input.targetBranchId,
      }),
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

  const list = (members ?? []).filter((m) => m.is_active);

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

      {/* Invite link panel — shown after inviting a new user */}
      {inviteUrl && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-800">{t("staff.inviteLinkTitle")}</p>
              <p className="mt-1 text-xs text-brand-700">{t("staff.inviteLinkDesc")}</p>
              <p className="mt-2 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-ink-600">
                {inviteUrl}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs"
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
              >
                {t("common.copy")}
              </button>
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => setInviteUrl(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {m.role_name && (
                    <p className="text-xs text-ink-500">{m.role_name}</p>
                  )}
                  {m.branches.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.branches.map((b) => (
                        <span
                          key={b.id}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-medium ${
                            b.id === restaurant?.id
                              ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                              : "bg-ink-50 text-ink-500"
                          }`}
                        >
                          {b.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!m.is_owner && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                  {/* Transfer to another branch */}
                  <select
                    className="input w-auto px-2 py-1 text-xs"
                    value=""
                    disabled={transfer.isPending}
                    onChange={(e) => {
                      const targetId = e.target.value;
                      if (!targetId) return;
                      if (window.confirm(t("staff.transferConfirm")))
                        transfer.mutate({ memberId: m.id, targetBranchId: targetId });
                    }}
                    aria-label={t("staff.transfer")}
                  >
                    <option value="">{t("staff.transfer")}</option>
                    {/* Show other branches from JWT (excluding current) */}
                    {(() => {
                      try {
                        const token = localStorage.getItem("auth.access");
                        if (!token) return null;
                        const payload = JSON.parse(atob(token.split(".")[1]));
                        const branches = payload.branches as Array<{ id: string; display_name: string }> | undefined;
                        return (branches ?? [])
                          .filter((b) => b.id !== restaurant?.id)
                          .map((b) => (
                            <option key={b.id} value={b.id}>{b.display_name}</option>
                          ));
                      } catch {
                        return null;
                      }
                    })()}
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
