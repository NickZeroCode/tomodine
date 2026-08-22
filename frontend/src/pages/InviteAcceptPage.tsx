import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { tokenStore } from "@/lib/api";

/**
 * Staff invitation acceptance page.
 *
 * Flow: pre-flight token check (GET) → form → claim (POST) → auto-login.
 * Every failure path renders an explicit message; nothing crashes silently.
 */

interface Preflight {
  checking: boolean;
  valid: boolean;
  email?: string;
  restaurant?: string;
  detail?: string;
}

export function InviteAcceptPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [preflight, setPreflight] = useState<Preflight>({ checking: !!token, valid: false });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  // Pre-flight: validate the token before showing the form at all.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPreflight({ checking: true, valid: false });
    axios
      .get<{ valid: boolean; email: string; restaurant: string }>(
        "/api/v1/auth/invite/claim/",
        { params: { token }, validateStatus: () => true }
      )
      .then((res) => {
        if (cancelled) return;
        const body = res.data as { valid?: boolean; email?: string; restaurant?: string; detail?: string } | null;
        if (res.status === 200 && body?.valid) {
          setPreflight({
            checking: false,
            valid: true,
            email: body.email,
            restaurant: body.restaurant,
          });
        } else {
          setPreflight({
            checking: false,
            valid: false,
            detail: body?.detail ?? t("invite.invalidDesc"),
          });
        }
      })
      .catch(() => {
        if (!cancelled)
          setPreflight({ checking: false, valid: false, detail: t("invite.networkError") });
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    if (password !== passwordConfirm) {
      setErrors({ password_confirm: [t("invite.passwordMismatch")] });
      return;
    }
    setSubmitting(true);
    try {
      // Claim the invitation — server returns the account's email.
      const claimResp = await axios.post<{ email: string }>(
        "/api/v1/auth/invite/claim/",
        { token, full_name: fullName, phone, password, password_confirm: passwordConfirm },
        { validateStatus: () => true }
      );
      if (claimResp.status !== 200) {
        const data = claimResp.data as unknown as Record<string, unknown>;
        // Normalize all possible error shapes into field-level strings.
        const normalized: Record<string, string[]> = {};
        if (data && typeof data === "object") {
          for (const [key, val] of Object.entries(data)) {
            if (Array.isArray(val)) {
              normalized[key] = val.map(String);
            } else if (typeof val === "string") {
              normalized[key] = [val];
            }
          }
        }
        // DRF non-field errors land under "errors" or "detail" — display
        // them under "detail" so the UI always shows something.
        if (normalized.errors && !normalized.detail) {
          normalized.detail = normalized.errors;
          delete normalized.errors;
        }
        setErrors(
          Object.keys(normalized).length ? normalized : { detail: [t("invite.genericError")] }
        );
        return;
      }

      // Auto-login with the freshly claimed credentials.
      const loginResp = await axios.post<{ access: string; refresh: string }>(
        "/api/v1/auth/login/",
        { email: claimResp.data.email, password },
        { validateStatus: () => true }
      );

      if (loginResp.status === 200 && loginResp.data?.access) {
        tokenStore.set(loginResp.data.access, loginResp.data.refresh);
        navigate("/dashboard");
      } else {
        // Claim succeeded but auto-login failed — send to manual login.
        navigate("/login");
      }
    } catch {
      setErrors({ detail: [t("invite.networkError")] });
    } finally {
      setSubmitting(false);
    }
  }

  /* ── States ── */

  if (!token || preflight.checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-ink-100 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-sm">
            ভ
          </span>
          <p className="mt-4 text-sm text-ink-500">
            {!token ? t("invite.invalidTitle") : t("common.loading")}
          </p>
          {!token && (
            <Link to="/login" className="btn-primary mt-6 w-full justify-center">
              {t("auth.login")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!preflight.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-ink-100 bg-white p-8 text-center shadow-sm">
          <h1 className="font-display text-xl font-bold text-ink-900">{t("invite.invalidTitle")}</h1>
          <p className="mt-2 text-sm text-ink-500">{preflight.detail ?? t("invite.invalidDesc")}</p>
          <Link to="/login" className="btn-primary mt-6 w-full justify-center">
            {t("auth.login")}
          </Link>
        </div>
      </div>
    );
  }

  /* ── Valid invitation → form ── */

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-sm">
            ভ
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">{t("invite.title")}</h1>
          <p className="mt-1 text-sm text-ink-500">{t("invite.subtitle")}</p>
          {preflight.restaurant && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {preflight.restaurant}
            </p>
          )}
          {preflight.email && <p className="mt-1.5 text-xs text-ink-400">{preflight.email}</p>}
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-ink-100 bg-white p-6 shadow-sm"
          noValidate
        >
          <div>
            <label htmlFor="invite-name" className="label">{t("invite.fullName")}</label>
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
            <label htmlFor="invite-phone" className="label">{t("invite.phone")}</label>
            <input
              id="invite-phone"
              type="tel"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+8801XXXXXXXXX"
              autoComplete="tel"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone[0]}</p>}
          </div>

          <div>
            <label htmlFor="invite-password" className="label">{t("invite.password")}</label>
            <input
              id="invite-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
            <p className="mt-1 text-[0.65rem] text-ink-400">{t("invite.passwordHint")}</p>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password[0]}</p>}
          </div>

          <div>
            <label htmlFor="invite-password-confirm" className="label">
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
