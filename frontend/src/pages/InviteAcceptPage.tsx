import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { tokenStore } from "@/lib/api";

/**
 * Staff invitation acceptance page.
 *
 * Invited staff land here from the link generated when the owner invites
 * them (`/invite/accept?token=...`). They set their name + password and are
 * logged straight into the dashboard.
 */
export function InviteAcceptPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      // Claim the invitation — server returns the account's email.
      const claimResp = await axios.post<{ email: string }>("/api/v1/auth/invite/claim/", {
        token,
        full_name: fullName,
        phone,
        password,
        password_confirm: passwordConfirm,
      });
      // Auto-login: fetch JWTs for the now-claimed account.
      const { data } = await axios.post("/api/v1/auth/login/", {
        email: claimResp.data.email,
        password,
      });
      if (data?.access) {
        tokenStore.set(data.access, data.refresh);
        navigate("/dashboard");
      }
    } catch (err) {
      const resp = err as { response?: { data?: Record<string, string[]>; status?: number } };
      if (resp.response?.status === 401) {
        // Login failed (e.g. email unknown client-side) — still show success
        // for the claim; user can log in manually.
        navigate("/login");
        return;
      }
      setErrors(resp.response?.data ?? { detail: ["Something went wrong. Please try again."] });
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-sm">
          <h1 className="font-display text-xl font-bold text-ink-900">{t("invite.invalidTitle")}</h1>
          <p className="mt-2 text-sm text-ink-500">{t("invite.invalidDesc")}</p>
          <Link to="/login" className="btn-primary mt-6 w-full justify-center">
            {t("auth.login")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-soft">
            ভ
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">{t("invite.title")}</h1>
          <p className="mt-1 text-sm text-ink-500">{t("invite.subtitle")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm" noValidate>
          <div>
            <label htmlFor="invite-name" className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("invite.fullName")}
            </label>
            <input
              id="invite-name"
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
            {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name[0]}</p>}
          </div>

          <div>
            <label htmlFor="invite-phone" className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("invite.phone")}
            </label>
            <input
              id="invite-phone"
              type="tel"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone[0]}</p>}
          </div>

          <div>
            <label htmlFor="invite-password" className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("invite.password")}
            </label>
            <input
              id="invite-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password[0]}</p>}
          </div>

          <div>
            <label htmlFor="invite-password-confirm" className="mb-1.5 block text-sm font-medium text-ink-700">
              {t("invite.passwordConfirm")}
            </label>
            <input
              id="invite-password-confirm"
              type="password"
              className="input"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            {errors.password_confirm && (
              <p className="mt-1 text-xs text-red-600">{errors.password_confirm[0]}</p>
            )}
          </div>

          {(errors.token || errors.detail) && (
            <p className="text-sm text-red-600" role="alert">
              {(errors.token ?? errors.detail)![0]}
            </p>
          )}

          <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
            {submitting ? t("common.loading") : t("invite.accept")}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-400">
          {t("invite.existingAccount")}{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
