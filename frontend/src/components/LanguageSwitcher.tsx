import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/i18n";

/** Compact language toggle used across dashboard, customer, and landing UIs. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const current = i18n.language as LanguageCode;

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-ink-100 bg-white p-0.5 text-xs font-medium"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => i18n.changeLanguage(lang.code)}
          aria-pressed={current === lang.code}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            current === lang.code
              ? "bg-brand-600 text-white"
              : "text-ink-500 hover:text-ink-900"
          } ${lang.code === "bn" ? "font-bangla" : ""}`}
        >
          {compact && lang.code === "en" ? "EN" : lang.label}
        </button>
      ))}
    </div>
  );
}
