import { useTranslation } from "react-i18next";

export function CustomersPage() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="customers-heading">
      <h2 id="customers-heading" className="text-lg font-semibold text-ink-900">
        {t("customers.title")}
      </h2>
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-8 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden="true">
            <circle cx="9" cy="7" r="4" />
            <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
            <circle cx="19" cy="8" r="3" />
            <path d="M19 13h2a3 3 0 0 1 3 3v2" />
          </svg>
        </div>
        <h3 className="mt-6 font-display text-xl font-bold text-ink-900">{t("customers.comingSoon")}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{t("customers.description")}</p>
      </div>
    </section>
  );
}
