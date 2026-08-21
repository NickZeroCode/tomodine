import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { formatBDT, localized } from "@/lib/format";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { QrScannerModal } from "@/components/QrScannerModal";
import { TrustedMarquee } from "@/components/TrustedMarquee";
import { Reveal } from "@/components/Reveal";
import type { SubscriptionPlan } from "@/types";

/* ─── placeholder images (from TheFork — swap later) ─────── */
const IMG = {
  hero: "/images/dashboard-sophia-rms.png",
  software: "/images/TFM-EN-booking-service-management-floor-plan314d.png",
  community: "/images/TFM-attract-more-diner-international-audience-new9bf2.jpg",
  expertise: "/images/TFM-restaurant-groups-support-new5670.jpg",
  ctaBanner: "/images/ready-to-experience-picture.webp",
  testimonial: "/images/TFM-testimonial-buon-appetito-thumbnail.jpg",
  step1: "/images/order-steps/step-1.png",
  step2: "/images/order-steps/step-2.png",
  step3: "/images/order-steps/step-3.png",
  step4: "/images/order-steps/step-4.png",
} as const;

/* ─── tiny icons ──────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PlusMinus({ open }: { open: boolean }) {
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-lg font-light transition-colors ${open ? "border-brand-600 text-brand-700" : "border-ink-200 text-ink-500"}`} aria-hidden="true">
      {open ? "−" : "+"}
    </span>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-amber-400" aria-hidden="true">
      <path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

/* ─── feature / step icons (24×24, stroke style) ──────────── */

function IconUser({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 12 0v1" />
    </svg>
  );
}
function IconStore({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 9l1.5-5.5A1 1 0 0 1 5.46 3h13.08a1 1 0 0 1 .96.5L21 9" /><path d="M3 9h18v2a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3h0a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3h0a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3Z" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}
function IconCreditCard({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="3" /><line x1="1" y1="10" x2="23" y2="10" /><line x1="5" y1="15" x2="9" y2="15" />
    </svg>
  );
}
function IconRocket({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}
function IconPhone({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="3" /><line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="2.5" />
    </svg>
  );
}
function IconEye({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconBell({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconHandWave({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 11V6a2 2 0 0 0-4 0v1" /><path d="M14 10V4a2 2 0 0 0-4 0v2" /><path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}
function IconChatBot({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="14" rx="3" /><path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth="2.5" /><path d="M7 18v2m10-2v2" />
    </svg>
  );
}
function IconDashboard({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function IconTable({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="7" width="20" height="3" rx="1.5" /><path d="M4 10v8M20 10v8M9 10v8M15 10v8" />
    </svg>
  );
}
function IconClipboard({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 2h6v3H9Z" /><line x1="9" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="13" y2="14" />
    </svg>
  );
}
function IconTag({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" />
    </svg>
  );
}
function IconTrendingUp({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
function IconPlate({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8Z" /><path d="M12 6v4" /><path d="M10 8h4" />
    </svg>
  );
}
function IconBriefcase({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="2" y1="13" x2="22" y2="13" />
    </svg>
  );
}

/* ─── sliding testimonials section ────────────────────────── */

const TESTI_INTERVAL = 4500;

function TestimonialSlider() {
  const { t } = useTranslation();
  const [startIdx, setStartIdx] = useState(0);

  const items = [
    { quote: t("landing.testimonial1Q"), author: t("landing.testimonial1A"), role: t("landing.testimonial1R") },
    { quote: t("landing.testimonial2Q"), author: t("landing.testimonial2A"), role: t("landing.testimonial2R") },
    { quote: t("landing.testimonial3Q"), author: t("landing.testimonial3A"), role: t("landing.testimonial3R") },
    { quote: t("landing.testimonial4Q"), author: t("landing.testimonial4A"), role: t("landing.testimonial4R") },
    { quote: t("landing.testimonial5Q"), author: t("landing.testimonial5A"), role: t("landing.testimonial5R") },
    { quote: t("landing.testimonial6Q"), author: t("landing.testimonial6A"), role: t("landing.testimonial6R") },
  ];

  // Show 3 at a time on desktop, 1 on mobile
  const [visibleCount, setVisibleCount] = useState(
    typeof window !== "undefined" && window.innerWidth >= 1024 ? 3 : 1
  );

  useEffect(() => {
    const onResize = () => setVisibleCount(window.innerWidth >= 1024 ? 3 : 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setStartIdx((p) => (p + visibleCount) % items.length), TESTI_INTERVAL);
    return () => clearInterval(id);
  }, [items.length, visibleCount]);

  // Build the visible slice (wraps around)
  const visible = Array.from({ length: Math.min(visibleCount, items.length) }, (_, i) =>
    items[(startIdx + i) % items.length]
  );

  return (
    <section className="py-16" style={{ background: "#f0faf7" }}>
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{t("landing.testimonialsLabel")}</p>
        </Reveal>

        {/* Grid of visible testimonials — 1 col mobile, 3 cols desktop */}
        <div className="mx-auto mt-8 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item, i) => (
            <div
              key={`${item.author}-${i}`}
              className="flex flex-col items-center justify-between rounded-2xl border border-ink-100 bg-white p-6 shadow-sm transition-all duration-700 ease-in-out"
            >
              <div className="w-full">
                {/* Stars */}
                <div className="mb-3 flex justify-center gap-1" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <StarIcon key={s} />
                  ))}
                </div>
                <p className="text-base font-medium italic leading-relaxed text-ink-700">"{item.quote}"</p>
              </div>
              <div className="mt-5 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {item.author.charAt(0)}
                </span>
                <div className="text-left">
                  <p className="text-sm font-semibold text-ink-800">{item.author}</p>
                  <p className="text-xs text-ink-400">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dots — one page per dot */}
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: Math.ceil(items.length / visibleCount) }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStartIdx(i * visibleCount)}
              aria-label={`Testimonials page ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                startIdx === i * visibleCount ? "w-7 bg-brand-600" : "w-2 bg-ink-200 hover:bg-ink-300"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── owner steps ─────────────────────────────────────────── */

function OwnerSteps() {
  const { t } = useTranslation();
  const steps = [
    { num: "01", icon: <IconUser className="h-6 w-6 text-brand-600" />, title: t("landing.ownerStep1Title"), desc: t("landing.ownerStep1Desc") },
    { num: "02", icon: <IconCreditCard className="h-6 w-6 text-brand-600" />, title: t("landing.ownerStep2Title"), desc: t("landing.ownerStep2Desc") },
    { num: "03", icon: <IconStore className="h-6 w-6 text-brand-600" />, title: t("landing.ownerStep3Title"), desc: t("landing.ownerStep3Desc") },
    { num: "04", icon: <IconRocket className="h-6 w-6 text-brand-600" />, title: t("landing.ownerStep4Title"), desc: t("landing.ownerStep4Desc") },
  ];

  return (
    <div className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <Reveal key={i} delay={i * 100}>
          <div className="relative flex flex-col items-center text-center">
            {/* Connector line (hidden on last) */}
            {i < steps.length - 1 && (
              <div className="absolute right-0 top-8 hidden h-px w-1/2 bg-ink-200 lg:block" aria-hidden="true" />
            )}
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
              {s.icon}
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {s.num}
              </span>
            </div>
            <h3 className="mt-4 font-display text-base font-bold text-ink-900">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.desc}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ─── features section ────────────────────────────────────── */

function FeaturesSection() {
  const { t } = useTranslation();

  const customerFeatures = [
    { icon: <IconPhone className="h-5 w-5 text-brand-600" />, title: t("landing.featNoAppTitle"), desc: t("landing.featNoAppDesc") },
    { icon: <IconEye className="h-5 w-5 text-brand-600" />, title: t("landing.featLiveStatusTitle"), desc: t("landing.featLiveStatusDesc") },
    { icon: <IconBell className="h-5 w-5 text-brand-600" />, title: t("landing.featNotifTitle"), desc: t("landing.featNotifDesc") },
    { icon: <IconHandWave className="h-5 w-5 text-brand-600" />, title: t("landing.featPingWaiterTitle"), desc: t("landing.featPingWaiterDesc") },
    { icon: <IconChatBot className="h-5 w-5 text-brand-600" />, title: t("landing.featChatbotTitle"), desc: t("landing.featChatbotDesc") },
  ];

  const ownerFeatures = [
    { icon: <IconDashboard className="h-5 w-5 text-brand-600" />, title: t("landing.featDashboardTitle"), desc: t("landing.featDashboardDesc") },
    { icon: <IconBell className="h-5 w-5 text-brand-600" />, title: t("landing.featOwnerNotifTitle"), desc: t("landing.featOwnerNotifDesc") },
    { icon: <IconTable className="h-5 w-5 text-brand-600" />, title: t("landing.featTableMgmtTitle"), desc: t("landing.featTableMgmtDesc") },
    { icon: <IconClipboard className="h-5 w-5 text-brand-600" />, title: t("landing.featMenuMgmtTitle"), desc: t("landing.featMenuMgmtDesc") },
    { icon: <IconTag className="h-5 w-5 text-brand-600" />, title: t("landing.featPromoTitle"), desc: t("landing.featPromoDesc") },
    { icon: <IconTrendingUp className="h-5 w-5 text-brand-600" />, title: t("landing.featAnalyticsTitle"), desc: t("landing.featAnalyticsDesc") },
  ];

  return (
    <section id="features" className="py-20" style={{ background: "#EDF6F5" }}>
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{t("landing.featuresTitle")}</h2>
          <p className="mt-4 text-ink-600">{t("landing.featuresIntro")}</p>
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-2">
          {/* Customer features */}
          <Reveal>
            <div className="rounded-2xl bg-white p-8 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100"><IconPlate className="h-5 w-5 text-brand-700" /></span>
                <h3 className="font-display text-xl font-bold text-ink-900">{t("landing.featuresCustomerTitle")}</h3>
              </div>
              <div className="mt-8 space-y-5">
                {customerFeatures.map((f) => (
                  <div key={f.title} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">{f.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{f.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Owner features */}
          <Reveal delay={150}>
            <div className="rounded-2xl bg-white p-8 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100"><IconBriefcase className="h-5 w-5 text-brand-700" /></span>
                <h3 className="font-display text-xl font-bold text-ink-900">{t("landing.featuresOwnerTitle")}</h3>
              </div>
              <div className="mt-8 space-y-5">
                {ownerFeatures.map((f) => (
                  <div key={f.title} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">{f.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{f.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── step slider (pause-and-slide with bare images) ────── */

const STEP_PAUSE = 3500; // ms to linger on each step
const STEP_SLIDE = 600;  // ms slide transition

function StepText({ num, title, desc }: { num: string; title: string; desc: string }) {
  const { t } = useTranslation();
  return (
    <>
      <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
        {t("landing.howItWorks")} · {num}
      </span>
      <h3 className="mt-3 font-display text-2xl font-bold text-ink-900 sm:text-3xl">{title}</h3>
      <p className="mt-3 text-base leading-relaxed text-ink-500">{desc}</p>
    </>
  );
}

function StepSlider() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const steps = [
    { img: IMG.step1, num: "01", title: t("landing.step1Title"), desc: t("landing.step1Desc") },
    { img: IMG.step2, num: "02", title: t("landing.step2Title"), desc: t("landing.step2Desc") },
    { img: IMG.step3, num: "03", title: t("landing.step3Title"), desc: t("landing.step3Desc") },
    { img: IMG.step4, num: "04", title: t("landing.step4Title"), desc: t("landing.step4Desc") },
  ];

  const go = useCallback((idx: number) => setCurrent(((idx % steps.length) + steps.length) % steps.length), [steps.length]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => go(current + 1), STEP_PAUSE + STEP_SLIDE);
    return () => clearInterval(id);
  }, [current, paused, go]);

  return (
    <div
      className="relative mt-12 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Track — 4 slides side-by-side, only one visible */}
      <div
        className="flex"
        style={{
          transition: `transform ${STEP_SLIDE}ms cubic-bezier(.4,0,.2,1)`,
          transform: `translateX(-${current * 100}%)`,
        }}
      >
        {steps.map((s, i) => (
          <div key={i} className="flex w-full shrink-0 flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-14">
            {/* Mobile: text always first (top). Desktop: alternate sides. */}
            {i % 2 === 0 ? (
              <div className="max-w-md text-center lg:w-1/3 lg:text-right">
                <StepText num={s.num} title={s.title} desc={s.desc} />
              </div>
            ) : (
              <>
                {/* Mobile text block for odd steps — shown above image */}
                <div className="max-w-md text-center lg:hidden">
                  <StepText num={s.num} title={s.title} desc={s.desc} />
                </div>
                {/* Desktop left spacer for odd steps */}
                <div className="hidden lg:block lg:w-1/3" aria-hidden="true" />
              </>
            )}

            {/* Image CENTER */}
            <div className="relative w-full max-w-xl shrink-0 lg:w-1/3">
              <div className="flex h-80 items-center justify-center sm:h-96 lg:h-[28rem]">
                <img
                  src={s.img}
                  alt={s.title}
                  className="max-h-full w-full object-contain"
                  loading={i === 0 ? "eager" : "lazy"}
                  draggable={false}
                />
              </div>
              {/* Step badge */}
              <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-soft">
                {s.num}
              </span>
            </div>

            {/* Desktop right column: text for odd steps, spacer for even */}
            {i % 2 === 1 ? (
              <div className="hidden max-w-md text-center lg:block lg:w-1/3 lg:text-left">
                <StepText num={s.num} title={s.title} desc={s.desc} />
              </div>
            ) : (
              <div className="hidden lg:block lg:w-1/3" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="mt-10 flex items-center justify-center gap-3">
        {steps.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              i === current ? "w-8 bg-brand-600" : "w-2.5 bg-ink-200 hover:bg-ink-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────────── */

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";

  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data } = await axios.get("/api/v1/subscription-plans/");
      const list = Array.isArray(data) ? data : data.results;
      return list as SubscriptionPlan[];
    },
  });
  const plans = plansQuery.data ?? [];
  const popularIndex = plans.length > 1 ? Math.min(1, plans.length - 1) : -1;

  // Interactive state
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  /* ─── data (mirrors TheFork index copy, adapted to our brand) ─── */

  // Stats band (dark) — like TheFork's numbers grid.
  const stats = [
    { value: t("landing.stat1Value"), label: t("landing.stat1Label") },
    { value: t("landing.stat2Value"), label: t("landing.stat2Label") },
    { value: t("landing.stat3Value"), label: t("landing.stat3Label") },
  ];

  // FAQ — 6 questions, like TheFork.
  const faqs = [
    { q: t("landing.faq1Q"), a: t("landing.faq1A") },
    { q: t("landing.faq2Q"), a: t("landing.faq2A") },
    { q: t("landing.faq3Q"), a: t("landing.faq3A") },
    { q: t("landing.faq4Q"), a: t("landing.faq4A") },
    { q: t("landing.faq5Q"), a: t("landing.faq5A") },
    { q: t("landing.faq6Q"), a: t("landing.faq6A") },
  ];

  const footerCols = [
    { heading: t("landing.footerSolution"), links: [
      { label: t("landing.featuresCustomerTitle"), href: "#features" },
      { label: t("landing.featuresOwnerTitle"), href: "#features" },
      { label: t("landing.howItWorksClients"), href: "#solution" },
      { label: t("landing.howItWorksOwners"), href: "#owners" },
    ]},
    { heading: t("landing.footerSupport"), links: [
      { label: t("landing.pricingTitle"), href: "#pricing" },
      { label: t("landing.faqTitle"), href: "#faq" },
      { label: t("landing.howItWorks"), href: "#solution" },
      { label: t("landing.contactUs"), href: "/register" },
    ]},
    { heading: t("landing.footerCompany"), links: [
      { label: t("landing.pricingTitle"), href: "#pricing" },
      { label: t("landing.faqTitle"), href: "#faq" },
      { label: t("landing.contactUs"), href: "/register" },
    ]},
    { heading: t("landing.footerAccount"), links: [
      { label: t("auth.login"), href: "/login" },
      { label: t("auth.register"), href: "/register" },
    ]},
  ];

  /* ─── render ─── */

  return (
    <div className="min-h-screen bg-white">
      {/* 1 ══ HEADER ══ */}
      <header className="sticky top-0 z-30 border-b border-ink-100/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-soft">
              ভ
            </span>
            <span className="hidden text-base font-semibold text-ink-900 sm:inline">{t("common.appName")}</span>
          </Link>
          <nav className="hidden items-center gap-7 lg:flex">
            <a href="#solution" className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900">{t("landing.navSolution")}</a>
            <a href="#features" className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900">{t("landing.navFeatures")}</a>
            <a href="#pricing" className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900">{t("landing.navPlans")}</a>
            <a href="#faq" className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900">{t("landing.navResources")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Link to="/login" className="btn-ghost hidden text-sm sm:inline-flex">{t("auth.login")}</Link>
            <Link to="/register" className="btn-primary hidden text-sm sm:inline-flex">{t("landing.getStarted")}</Link>
            {/* Mobile donut menu */}
            <button
              type="button"
              onClick={() => setMobileMenu((v) => !v)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition-colors hover:bg-ink-50 lg:hidden"
              aria-label="Menu"
              aria-expanded={mobileMenu}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
                {mobileMenu ? (
                  <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                ) : (
                  <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-in sidebar — MUST live outside <header> because the
          header's backdrop-filter creates a containing block that breaks
          position:fixed children. Slides in from the RIGHT like iOS/Android
          drawer menus triggered by a right-side hamburger. */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink-900/60 transition-opacity duration-300 lg:hidden ${
          mobileMenu ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileMenu(false)}
        aria-hidden="true"
      />
      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[300px] max-w-[85vw] flex-col bg-white shadow-lift transition-transform duration-300 ease-out lg:hidden ${
          mobileMenu ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-soft">
              ভ
            </span>
            <span className="text-base font-semibold text-ink-900">{t("common.appName")}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenu(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-50"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Sidebar links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {[{ href: "#solution", label: t("landing.navSolution") },
            { href: "#features", label: t("landing.navFeatures") },
            { href: "#pricing", label: t("landing.navPlans") },
            { href: "#faq", label: t("landing.navResources") },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenu(false)}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50 active:bg-ink-100"
            >
              {link.label}
            </a>
          ))}

          {/* Scan menu — opens the QR scanner */}
          <button
            type="button"
            onClick={() => {
              setMobileMenu(false);
              setScannerOpen(true);
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 active:bg-brand-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            {t("landing.scanMenu")}
          </button>
        </nav>

        {/* Sidebar footer actions */}
        <div className="space-y-2 border-t border-ink-100 px-4 py-4">
          <Link to="/login" className="btn-ghost w-full justify-center text-sm">{t("auth.login")}</Link>
          <Link to="/register" className="btn-primary w-full justify-center text-sm">{t("landing.getStarted")}</Link>
        </div>
      </aside>

      <main>
        {/* 2 ══ HERO — title, subtitle, CTA, image ══ */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50/60 via-white to-white" />
          <div className="relative mx-auto max-w-3xl px-4 pt-12 text-center sm:px-6 sm:pt-20">
            <Reveal>
              <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-5xl">
                {t("landing.heroTitle")}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base text-ink-600 sm:text-lg">
                {t("landing.heroSubtitle")}
              </p>
            </Reveal>

            <Reveal delay={100}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link to="/register" className="btn-primary px-7 py-3.5 text-base shadow-soft">
                  {t("landing.getStarted")}
                </Link>
                <a href="#pricing" className="btn-secondary inline-flex items-center gap-2 px-7 py-3.5 text-base">
                  {t("landing.findPlan")} <ArrowIcon />
                </a>
              </div>
            </Reveal>
          </div>
          {/* Hero image */}
          <Reveal delay={200}>
            <div className="relative mx-auto mt-10 max-w-6xl px-4 pb-14 sm:px-6 sm:pb-16">
              <img
                src={IMG.hero}
                alt={t("landing.heroTitle")}
                className="block w-full rounded-2xl object-cover shadow-lift"
                loading="eager"
              />
            </div>
          </Reveal>
        </section>

        {/* 3 ══ TRUST LOGOS (restaurants that already trust us) ══ */}
        <TrustedMarquee />

        {/* 4 ══ HOW IT WORKS — FOR CLIENTS ══ */}
        <section id="solution" className="py-20" style={{ background: "#EDF6F5" }}>
          <div className="mx-auto max-w-7xl px-6">
            <Reveal className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{t("landing.howItWorksClients")}</h2>
              <p className="mt-4 text-ink-600">{t("landing.howItWorksClientsIntro")}</p>
            </Reveal>

            <StepSlider />
          </div>
        </section>

        {/* 4b ══ HOW IT WORKS — FOR RESTAURANT OWNERS ══ */}
        <section id="owners" className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{t("landing.howItWorksOwners")}</h2>
              <p className="mt-4 text-ink-600">{t("landing.howItWorksOwnersIntro")}</p>
            </Reveal>
            <OwnerSteps />
          </div>
        </section>

        {/* 5 ══ FEATURES — customer vs owner ══ */}
        <FeaturesSection />

        {/* 6 ══ STATS BAND — dark green (TheFork: module-tfm-video-numbers, #00665A) ══ */}
        <section className="py-16" style={{ background: "#00665A" }}>
          <div className="mx-auto max-w-7xl px-6">
            <Reveal className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">{t("landing.statsTitle")}</h2>
            </Reveal>
            <div className="mt-12 grid gap-10 text-center sm:grid-cols-3">
              {stats.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 120}>
                  <p className="text-5xl font-bold tracking-tight text-white">{stat.value}</p>
                  <p className="mt-3 text-sm text-white/70">{stat.label}</p>
                </Reveal>
              ))}
            </div>
            <Reveal delay={360}>
              <div className="mt-12 text-center">
                <Link to="/register" className="inline-flex rounded-card bg-white px-8 py-3.5 text-base font-semibold text-brand-800 shadow-soft transition-colors hover:bg-brand-50">
                  {t("landing.joinClub")}
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 6 ══ CTA BANNER CARD (TheFork: module-card-cta) ══ */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl shadow-lift">
              <img src={IMG.ctaBanner} alt="" className="h-64 w-full object-cover sm:h-80" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
              <div className="absolute inset-0 flex items-center px-8 sm:px-14">
                <div className="max-w-lg">
                  <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t("landing.ctaTitle")}</h2>
                  <p className="mt-3 text-white/80">{t("landing.ctaBody")}</p>
                  <Link to="/register" className="mt-6 inline-flex rounded-card bg-white px-7 py-3 text-sm font-semibold text-brand-700 shadow-soft transition-colors hover:bg-brand-50">
                    {t("landing.contactUs")}
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* 6b ══ SLIDING TESTIMONIALS ══ */}
        <TestimonialSlider />

        {/* 7 ══ PRICING ══ */}
        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">{t("landing.pricingTitle")}</h2>
            </Reveal>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan, i) => {
                const isPopular = i === popularIndex;
                return (
                  <Reveal key={plan.id} delay={i * 100}>
                    <div className={`card relative flex h-full flex-col p-7 ${isPopular ? "shadow-lift ring-2 ring-brand-500" : ""}`}>
                      {isPopular && (
                        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white shadow-soft">
                          {t("landing.popular")}
                        </span>
                      )}
                      <h3 className="text-lg font-semibold text-ink-900">{localized(plan, lang)}</h3>
                      <p className="mt-4 text-4xl font-bold text-ink-900">
                        {formatBDT(plan.price, lang)}
                        <span className="text-sm font-normal text-ink-500">{t("landing.perMonth")}</span>
                      </p>
                      {plan.trial_days > 0 && (
                        <p className="mt-1.5 text-xs font-medium text-brand-700">{plan.trial_days} {t("landing.trial")}</p>
                      )}
                      <ul className="mt-5 space-y-2.5 text-sm text-ink-600">
                        <li className="flex items-center gap-2.5"><CheckIcon />{t("tables.title")}: {plan.max_tables}</li>
                        <li className="flex items-center gap-2.5"><CheckIcon />{t("nav.staff")}: {plan.max_staff}</li>
                        <li className="flex items-center gap-2.5"><CheckIcon />{t("menu.title")}: {plan.max_dishes}</li>
                      </ul>
                      <Link to="/register" className={`mt-7 w-full text-center ${isPopular ? "btn-primary shadow-soft" : "btn-secondary"}`}>
                        {t("landing.getStarted")}
                      </Link>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* 9 ══ FAQ — left "FAQs" title, right accordion (TheFork: module-faq) ══ */}
        <section id="faq" className="py-20" style={{ background: "#EDF6F5" }}>
          <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-12">
            <Reveal className="lg:col-span-4">
              <h2 className="font-display text-4xl font-bold tracking-tight text-ink-900 lg:sticky lg:top-24">
                {t("landing.faqTitle")}
              </h2>
            </Reveal>
            <div className="space-y-3 lg:col-span-7 lg:col-start-6">
              {faqs.map((faq, i) => {
                const open = openFaq === i;
                return (
                  <div key={faq.q} className="overflow-hidden rounded-card border border-ink-100 bg-white">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="text-sm font-semibold text-ink-900">{faq.q}</span>
                      <PlusMinus open={open} />
                    </button>
                    {open && (
                      <div className="border-t border-ink-100 px-6 pb-5 pt-4">
                        <p className="text-sm leading-relaxed text-ink-600">{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* QR scanner modal (opened from mobile sidebar) */}
      <QrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} />

      {/* 10 ══ FOOTER — dark (TheFork: footer.theme-dark, 4 columns + ratings + legal) ══ */}
      <footer className="bg-ink-900 text-white" style={{ background: "#0b3a33" }}>
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 lg:grid-cols-12">
            {/* Brand + ratings */}
            <div className="lg:col-span-4">
              <span className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">ভ</span>
                <span className="text-base font-semibold">{t("common.appName")}</span>
              </span>
              <p className="mt-4 max-w-xs text-sm text-white/60">{t("landing.footerTagline")}</p>
            </div>
            {/* 4 link columns */}
            {footerCols.map((col) => (
              <div key={col.heading} className="lg:col-span-2">
                <h3 className="text-sm font-semibold">{col.heading}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-white/60">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("/") ? (
                        <Link to={link.href} className="transition-colors hover:text-white">{link.label}</Link>
                      ) : (
                        <a href={link.href} className="transition-colors hover:text-white">{link.label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* Legal */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row">
            <div className="flex gap-5">
              <span>{t("landing.legalTerms")}</span>
              <span>{t("landing.legalPrivacy")}</span>
              <span>{t("landing.legalCookies")}</span>
            </div>
            <p>© 2026 {t("common.appName")}. {t("landing.rights")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
