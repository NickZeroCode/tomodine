import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { FloatInput } from "@/components/ui/FloatInput";
import type { ApiError } from "@/types";

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    organization_name: "",
    branch_name: "",
    password: "",
    password_confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        organization_name: form.organization_name.trim() || form.full_name,
        branch_name: form.branch_name.trim() || "",
        password: form.password,
        password_confirm: form.password_confirm,
      });
      // Backend auto-creates Organization + Branch + Membership.
      await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      navigate("/dashboard");
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors(apiErr.errors ?? { non_field_errors: [apiErr.message] });
    } finally {
      setIsSubmitting(false);
    }
  }

  const fields: Array<{ name: keyof typeof form; type: string; label: string; autoComplete?: string; icon: React.ReactNode }> = [
    { name: "full_name", type: "text", label: t("auth.fullName"), autoComplete: "name",
      icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><circle cx="10" cy="7" r="3.5" /><path d="M3 17v-1a4.5 4.5 0 0 1 9 0v1" /></svg> },
    { name: "organization_name", type: "text", label: t("auth.organizationName"), autoComplete: "organization",
      icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path d="M3 8l1.5-5A1 1 0 0 1 5.46 2h9.08a1 1 0 0 1 .96.5L17 8" /><path d="M3 8h14v1.5a2.5 2.5 0 0 1-2.5 2.5h0a2.5 2.5 0 0 1-2.5-2.5h0a2.5 2.5 0 0 1-2.5 2.5h0a2.5 2.5 0 0 1-2.5-2.5h0A2.5 2.5 0 0 1 3 9.5Z" /><path d="M4.5 12v5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-5" /></svg> },
    { name: "email", type: "email", label: t("auth.email"), autoComplete: "email",
      icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><rect x="2" y="4" width="16" height="12" rx="2" /><path d="m2 6 8 5 8-5" /></svg> },
    { name: "phone", type: "tel", label: t("auth.phone"), autoComplete: "tel",
      icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><rect x="5" y="1" width="10" height="18" rx="2" /><line x1="10" y1="15" x2="10" y2="15.01" strokeWidth="2" /></svg> },
    { name: "password", type: "password", label: t("auth.password"), autoComplete: "new-password",
      icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><rect x="4" y="9" width="12" height="9" rx="2" /><path d="M7 9V6a3 3 0 0 1 6 0v3" /></svg> },
    { name: "password_confirm", type: "password", label: t("auth.confirmPassword"), autoComplete: "new-password",
      icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><rect x="4" y="9" width="12" height="9" rx="2" /><path d="M7 9V6a3 3 0 0 1 6 0v3" /><path d="M10 13v2" /></svg> },
  ];

  return (
    <div className="flex">
      {/* Left brand panel */}
      <div className="fixed left-0 top-0 hidden h-full w-1/2 lg:flex lg:flex-col lg:justify-between lg:p-12" style={{ background: "#1d6a4e" }}>
        {/* Blended background image */}
        <img
          src="/images/login-form-pic.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 w-3/4 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.18]"
        />
        <Link to="/" className="relative flex items-center gap-3">
          <img src="/images/logos/tomodine-logo-desk.jpg" alt="TomoDine" className="h-10 object-contain" />
        </Link>
        <div className="relative space-y-6">
          <h1 className="font-display text-3xl font-bold leading-snug text-white xl:text-4xl">
            {t("auth.registerSubtitle")}
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-white/70">
            QR ordering, a live kitchen board, and clean billing — set up in minutes, ready for your first table today.
          </p>
        </div>
        <p className="relative text-sm text-white/30">© 2026 {t("common.appName")}</p>
      </div>

      {/* Right form panel */}
      <div className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-ink-50/50 px-6 py-10 sm:px-12 lg:ml-[50%] lg:px-16">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/images/logos/tomodine-logo-mobile.jpg" alt="TomoDine" className="h-9 w-9 rounded-lg object-contain" />
            <span className="text-lg font-semibold text-ink-900">{t("common.appName")}</span>
          </Link>

          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">{t("auth.register")}</h2>
            <LanguageSwitcher compact />
          </div>
          <p className="mt-1.5 text-sm text-ink-500">{t("auth.registerTitle")}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {errors.non_field_errors && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {errors.non_field_errors.map((m) => (<p key={m}>{m}</p>))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.slice(0, 2).map((f) => (
                <FloatInput
                  key={f.name}
                  id={f.name}
                  type={f.type}
                  value={form[f.name]}
                  onChange={(v) => setForm((prev) => ({ ...prev, [f.name]: v }))}
                  label={f.label}
                  autoComplete={f.autoComplete}
                  required
                  icon={f.icon}
                  error={errors[f.name]?.[0]}
                />
              ))}
            </div>

            {fields.slice(2).map((f) => (
              <FloatInput
                key={f.name}
                id={f.name}
                type={f.type}
                value={form[f.name]}
                onChange={(v) => setForm((prev) => ({ ...prev, [f.name]: v }))}
                label={f.label}
                autoComplete={f.autoComplete}
                required={f.name !== "phone"}
                icon={f.icon}
                error={errors[f.name]?.[0]}
              />
            ))}

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(29,106,78,0.35)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(29,106,78,0.45)] hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              <span className="relative z-10">{isSubmitting ? t("common.loading") : t("auth.register")}</span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            {t("auth.hasAccount")}{" "}
            <Link to="/login" className="font-semibold text-brand-700 transition-colors hover:text-brand-900">{t("auth.login")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
