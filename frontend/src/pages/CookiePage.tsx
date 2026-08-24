/**
 * CookiePage — Cookie Settings & Consent Management for TomoDine.
 *
 * Bilingual (English / Bengali) page explaining what cookies TomoDine uses,
 * letting users manage their preferences, and exporting a lightweight
 * CookieConsentBanner component for the landing page.
 *
 * Follows the TomoDine Design System.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/* ── Cookie category definitions ───────────────────────────── */

interface CookieCategory {
  id: "essential" | "functional" | "analytics" | "advertising";
  en: { name: string; description: string; cookies: string[] };
  bn: { name: string; description: string; cookies: string[] };
  canToggle: boolean;
  defaultOn: boolean;
  currentlyUsed: boolean;
}

const CATEGORIES: CookieCategory[] = [
  {
    id: "essential",
    en: {
      name: "Essential Cookies",
      description:
        "These cookies are strictly necessary for TomoDine to function. They handle authentication, session management, branch selection, and device identification for QR ordering. Without them, the platform cannot operate.",
      cookies: [
        "auth.access — JWT access token for API authentication",
        "auth.refresh — JWT refresh token for session renewal",
        "active.branch.id — currently selected restaurant branch",
        "tenant.slug — restaurant identifier / subdomain slug",
        "bhojon.device_id — unique device ID for QR code ordering",
      ],
    },
    bn: {
      name: "অত্যাবশ্যক কুকি",
      description:
        "এই কুকিগুলো TomoDine পরিচালনার জন্য কড়াকড়িভাবে প্রয়োজনীয়। এগুলো প্রমাণীকরণ, সেশন ব্যবস্থাপনা, শাখা নির্বাচন এবং QR অর্ডারিংয়ের জন্য ডিভাইস সনাক্তকরণ পরিচালনা করে। এগুলো ছাড়া প্ল্যাটফর্ম কাজ করতে পারে না।",
      cookies: [
        "auth.access — API প্রমাণীকরণের জন্য JWT অ্যাক্সেস টোকেন",
        "auth.refresh — সেশন নবায়নের জন্য JWT রিফ্রেশ টোকেন",
        "active.branch.id — বর্তমানে নির্বাচিত রেস্তোরাঁ শাখা",
        "tenant.slug — রেস্তোরাঁ আইডেন্টিফায়ার / সাবডোমেইন স্লাগ",
        "bhojon.device_id — QR কোড অর্ডারিংয়ের জন্য অনন্য ডিভাইস আইডি",
      ],
    },
    canToggle: false,
    defaultOn: true,
    currentlyUsed: true,
  },
  {
    id: "functional",
    en: {
      name: "Functional Cookies",
      description:
        "These cookies remember your preferences — such as your preferred language and display theme — to provide a personalised experience each time you visit.",
      cookies: [
        "i18next.lng — your selected language preference (English / বাংলা)",
        "theme — dark or light mode preference (if applicable)",
      ],
    },
    bn: {
      name: "কার্যকরী কুকি",
      description:
        "এই কুকিগুলো আপনার পছন্দ মনে রাখে — যেমন আপনার পছন্দের ভাষা এবং ডিসপ্লে থিম — প্রতিবার আপনি দর্শন করলে একটি ব্যক্তিগতকৃত অভিজ্ঞতা প্রদান করতে।",
      cookies: [
        "i18next.lng — আপনার নির্বাচিত ভাষা পছন্দ (English / বাংলা)",
        "theme — ডার্ক বা লাইট মোড পছন্দ (যদি প্রযোজ্য হয়)",
      ],
    },
    canToggle: true,
    defaultOn: true,
    currentlyUsed: true,
  },
  {
    id: "analytics",
    en: {
      name: "Analytics Cookies",
      description:
        "These cookies help us understand how visitors use TomoDine so we can improve the platform. We do not currently use any analytics or tracking cookies.",
      cookies: [],
    },
    bn: {
      name: "বিশ্লেষণ কুকি",
      description:
        "এই কুকিগুলো আমাদের বুঝতে সাহায্য করে যে দর্শনার্থীরা কীভাবে TomoDine ব্যবহার করে যাতে আমরা প্ল্যাটফর্ম উন্নত করতে পারি। আমরা বর্তমানে কোনো বিশ্লেষণ বা ট্র্যাকিং কুকি ব্যবহার করি না।",
      cookies: [],
    },
    canToggle: false,
    defaultOn: false,
    currentlyUsed: false,
  },
  {
    id: "advertising",
    en: {
      name: "Advertising Cookies",
      description:
        "These cookies would be used to deliver relevant advertisements. TomoDine does not currently use any advertising cookies.",
      cookies: [],
    },
    bn: {
      name: "বিজ্ঞাপন কুকি",
      description:
        "এই কুকিগুলো প্রাসঙ্গিক বিজ্ঞাপন দেওয়ার জন্য ব্যবহৃত হতো। TomoDine বর্তমানে কোনো বিজ্ঞাপন কুকি ব্যবহার করে না।",
      cookies: [],
    },
    canToggle: false,
    defaultOn: false,
    currentlyUsed: false,
  },
];

/* ── localStorage helpers ──────────────────────────────────── */

const LS_CONSENT = "cookie_consent";
const LS_PREFS = "cookie_preferences";

function loadPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LS_PREFS);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { essential: true, functional: true, analytics: false, advertising: false };
}

function savePrefs(
  prefs: Record<string, boolean>,
  consent: "all" | "essential" | "custom",
) {
  localStorage.setItem(LS_CONSENT, consent);
  localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
}

/* ── Toggle switch ─────────────────────────────────────────── */

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        disabled
          ? "cursor-not-allowed bg-ink-200"
          : checked
            ? "bg-brand-600"
            : "bg-ink-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/* ── CookiePage component ──────────────────────────────────── */

export function CookiePage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";

  const [prefs, setPrefs] = useState<Record<string, boolean>>(loadPrefs);
  const [saved, setSaved] = useState(false);

  /* reset the "saved" badge after 3 seconds */
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(id);
  }, [saved]);

  const handleToggle = (id: string, value: boolean) => {
    setPrefs((p) => ({ ...p, [id]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    savePrefs(prefs, "custom");
    setSaved(true);
  };

  const handleAcceptAll = () => {
    const all: Record<string, boolean> = {};
    CATEGORIES.forEach((c) => (all[c.id] = true));
    setPrefs(all);
    savePrefs(all, "all");
    setSaved(true);
  };

  const handleRejectNonEssential = () => {
    const essential: Record<string, boolean> = {};
    CATEGORIES.forEach((c) => (essential[c.id] = c.id === "essential"));
    setPrefs(essential);
    savePrefs(essential, "essential");
    setSaved(true);
  };

  return (
    <section
      aria-labelledby="cookie-heading"
      className="mx-auto max-w-3xl space-y-6 p-4 md:p-6"
    >
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-brand-600"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M19 12H5m6-6-6 6 6 6" />
        </svg>
        {lang === "bn" ? "হোমপেজে ফিরে যান" : "Back to Home"}
      </Link>

      {/* Header */}
      <div>
        <h1
          id="cookie-heading"
          className="text-lg font-semibold text-ink-900"
        >
          {lang === "bn" ? "কুকি সেটিংস" : "Cookie Settings"}
        </h1>
        <p className="mt-1 text-xs text-ink-400">
          {lang === "bn"
            ? "সর্বশেষ আপডেট: ২৪ আগস্ট, ২০২৬"
            : "Last updated: August 24, 2026"}
        </p>
      </div>

      {/* What are cookies? */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-900">
          {lang === "bn" ? "কুকি কী?" : "What Are Cookies?"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          {lang === "bn"
            ? "কুকি হল ছোট টেক্সট ফাইল যা আপনি একটি ওয়েবসাইট দর্শন করলে আপনার ডিভাইসে (কম্পিউটার, ট্যাবলেট বা ফোন) সংরক্ষিত হয়। এগুলো ওয়েবসাইটকে আপনার কার্যকলাপ এবং পছন্দ মনে রাখতে সাহায্য করে, যাতে আপনাকে প্রতিবার একই তথ্য দিতে না হয়। TomoDine কুকি ব্যবহার করে আপনার অ্যাকাউন্ট লগইন রাখতে, আপনার পছন্দ মনে রাখতে এবং প্ল্যাটফর্ম সঠিকভাবে কাজ করাতে।"
            : "Cookies are small text files stored on your device (computer, tablet, or phone) when you visit a website. They help the site remember your activity and preferences so you don't have to enter the same information each time. TomoDine uses cookies to keep you logged in, remember your preferences, and ensure the platform works correctly."}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          {lang === "bn"
            ? "আপনি নীচে প্রতিটি কুকি বিভাগের বিবরণ এবং সেটিংস দেখতে পাবেন। অত্যাবশ্যক কুকি সবসময় সক্রিয় থাকে কারণ এগুলো ছাড়া প্ল্যাটফর্ম কাজ করে না। আপনি অন্যান্য কুকি চালু বা বন্ধ করতে পারেন।"
            : "Below you can see the details and settings for each cookie category. Essential cookies are always active because the platform cannot function without them. You can turn other cookies on or off."}
        </p>
      </div>

      {/* Cookie categories */}
      {CATEGORIES.map((cat) => {
        const s = cat[lang];
        const isOn = prefs[cat.id] ?? cat.defaultOn;

        return (
          <div key={cat.id} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink-900">
                  {s.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  {s.description}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <Toggle
                  checked={isOn}
                  disabled={!cat.canToggle}
                  onChange={(v) => handleToggle(cat.id, v)}
                  label={s.name}
                />
                {!cat.canToggle && (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
                    {lang === "bn" ? "সবসময় চালু" : "Always On"}
                  </span>
                )}
              </div>
            </div>

            {cat.currentlyUsed && s.cookies.length > 0 ? (
              <ul className="mt-4 space-y-1.5 text-xs text-ink-500">
                {s.cookies.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : !cat.currentlyUsed ? (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1 text-xs font-medium text-ink-400">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6M9 9l6 6" />
                </svg>
                {lang === "bn"
                  ? "বর্তমানে ব্যবহৃত হয় না"
                  : "Not currently used"}
              </p>
            ) : null}
          </div>
        );
      })}

      {/* Action buttons */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            {lang === "bn" ? "পছন্দ সংরক্ষণ করুন" : "Save Preferences"}
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="rounded-lg border border-brand-600 px-5 py-2.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
          >
            {lang === "bn" ? "সব গ্রহণ করুন" : "Accept All"}
          </button>
          <button
            type="button"
            onClick={handleRejectNonEssential}
            className="rounded-lg border border-ink-200 px-5 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50"
          >
            {lang === "bn" ? "অপ্রয়োজনীয় প্রত্যাখ্যান করুন" : "Reject Non-Essential"}
          </button>
        </div>

        {saved && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {lang === "bn"
              ? "আপনার পছন্দ সফলভাবে সংরক্ষিত হয়েছে।"
              : "Your preferences have been saved."}
          </p>
        )}
      </div>

      {/* Related pages */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-900">
          {lang === "bn" ? "সম্পর্কিত পৃষ্ঠা" : "Related Pages"}
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            to="/privacy"
            className="rounded-lg border border-ink-100 bg-ink-25 px-4 py-2 text-sm text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-600"
          >
            {lang === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy"}
          </Link>
          <Link
            to="/terms"
            className="rounded-lg border border-ink-100 bg-ink-25 px-4 py-2 text-sm text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-600"
          >
            {lang === "bn" ? "ব্যবহারের শর্তাবলী" : "Terms of Use"}
          </Link>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs leading-relaxed text-amber-800">
          {lang === "bn"
            ? "দাবিত্যাগ: এই পৃষ্ঠাটি শুধুমাত্র তথ্যগত উদ্দেশ্যে প্রদান করা হয়েছে। কুকি সংক্রান্ত আইনি পরামর্শের জন্য অনুগ্রহ করে একজন যোগ্য আইনজীবীর সাথে পরামর্শ করুন।"
            : "Disclaimer: This page is provided for informational purposes only. For legal advice regarding cookies, please consult a qualified legal professional."}
        </p>
      </div>
    </section>
  );
}

/* ── Cookie Consent Banner (for landing page) ──────────────── */

export function CookieConsentBanner() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(LS_CONSENT);
    if (!consent) setVisible(true);
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    const all: Record<string, boolean> = {};
    CATEGORIES.forEach((c) => (all[c.id] = true));
    savePrefs(all, "all");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-ink-100 bg-white shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-sm leading-relaxed text-ink-600 sm:flex-1">
          {lang === "bn"
            ? "আমরা আপনার অভিজ্ঞতা উন্নত করতে কুকি ব্যবহার করি। আমাদের ওয়েবসাইট ব্যবহার চালিয়ে যাওয়ার মাধ্যমে আপনি আমাদের"
            : "We use cookies to improve your experience. By continuing to use our website, you agree to our"}
          {" "}
          <Link
            to="/cookies"
            className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
          >
            {lang === "bn" ? "কুকি নীতি" : "Cookie Policy"}
          </Link>
          {lang === "bn" ? " গ্রহণ করেন।" : "."}
        </p>

        <div className="flex shrink-0 gap-2.5">
          <Link
            to="/cookies"
            className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50"
          >
            {lang === "bn" ? "পছন্দ পরিচালনা করুন" : "Manage Preferences"}
          </Link>
          <button
            type="button"
            onClick={handleAccept}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            {lang === "bn" ? "সব গ্রহণ করুন" : "Accept All"}
          </button>
        </div>
      </div>
    </div>
  );
}
