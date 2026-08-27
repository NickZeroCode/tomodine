import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { FloatInput } from "@/components/ui/FloatInput";
import { StyledCheckbox } from "@/components/ui/StyledCheckbox";
import type { ApiError } from "@/types";

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError((err as ApiError).message ?? t("common.error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex">
      {/* Left brand panel */}
      <div className="fixed left-0 top-0 hidden h-full w-1/2 lg:flex lg:flex-col lg:justify-between lg:p-12" style={{ background: "#1d6a4e" }}>
        <img
          src="/images/login-form-pic.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 w-3/4 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.18]"
        />
        <Link to="/" className="relative flex items-center gap-3">
          <img src="/images/logos/tomodine-logo-desk-auth-screens.png" alt="TomoDine" className="h-14 object-contain" />
        </Link>
        <div className="relative space-y-6">
          <h1 className="font-display text-3xl font-bold leading-snug text-white xl:text-4xl">{t("auth.loginSubtitle")}</h1>
          <p className="max-w-sm text-base leading-relaxed text-white/70">QR ordering, a live kitchen board, and clean billing in Taka. One friendly system your whole team will use.</p>
          <div className="flex items-center gap-4 pt-2">
            {[{ value: "1,000+", label: "restaurants" }, { value: "120k+", label: "orders / mo" }, { value: "4.8★", label: "rating" }].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/10 px-5 py-3 backdrop-blur-sm">
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-sm text-white/30">© 2026 {t("common.appName")}</p>
      </div>

      {/* Right form panel */}
      <div className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-ink-50/50 px-6 py-12 sm:px-12 lg:ml-[50%] lg:px-16">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
              <img src="/images/logos/tomodine-logo-mobile.jpg" alt="TomoDine" className="h-9 w-9 rounded-lg object-contain" />
          </Link>

          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">{t("auth.welcome")}</h2>
            <LanguageSwitcher compact />
          </div>
          <p className="mt-1.5 text-sm text-ink-500">{t("auth.loginTitle")}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>
            )}

            <FloatInput
              id="email"
              type="email"
              value={email}
              onChange={setEmail}
              label={t("auth.email")}
              autoComplete="email"
              required
              icon={
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><rect x="2" y="4" width="16" height="12" rx="2" /><path d="m2 6 8 5 8-5" /></svg>
              }
            />

            <FloatInput
              id="password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={setPassword}
              label={t("auth.password")}
              autoComplete="current-password"
              required
              icon={
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><rect x="4" y="9" width="12" height="9" rx="2" /><path d="M7 9V6a3 3 0 0 1 6 0v3" /></svg>
              }
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-slate-400 transition-colors hover:text-ink-600"
                  tabIndex={-1}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path d="M2 10s3.5-6 8-6 8 6 8 6-3.5 6-8 6-8-6-8-6Z" /><circle cx="10" cy="10" r="3" /></svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path d="M3 3l14 14" /><path d="M2 10s3.5-6 8-6c1.3 0 2.5.3 3.5.8M17.5 12.5C18.3 11.4 18 10 18 10s-3.5-6-8-6" /><circle cx="10" cy="10" r="3" /></svg>
                  )}
                </button>
              }
            />

            <div className="flex items-center justify-between">
              <StyledCheckbox checked={remember} onChange={setRemember} label={t("auth.rememberMe")} />
              <button type="button" className="text-xs font-semibold text-brand-600 transition-colors hover:text-brand-800">
                {t("auth.forgotPassword")}
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(29,106,78,0.35)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(29,106,78,0.45)] hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              <span className="relative z-10">{isSubmitting ? t("common.loading") : t("auth.login")}</span>
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-ink-500">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="font-semibold text-brand-700 transition-colors hover:text-brand-900">{t("auth.register")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
