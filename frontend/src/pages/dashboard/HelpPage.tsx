/**
 * HelpPage — Help & Support dashboard screen.
 *
 * Sections: Getting Started, FAQ, Contact Support, Documentation.
 * Follows the TomoDine Design System (KPI cards, card layout, typography).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useRestaurant } from "@/context/RestaurantContext";

/* ── FAQ data ────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: "How do I add dishes to my menu?",
    qBn: "আমি কিভাবে মেনুতে ডিশ যোগ করব?",
    a: "Go to Dashboard → Menu → click '+ Add Dish'. Fill in the name, price, category, and upload an image. The dish will appear on your customers' QR menu instantly.",
    aBn: "ড্যাশবোর্ড → মেনু → '+ ডিশ যোগ করুন' এ যান। নাম, মূল্য, ক্যাটাগরি পূরণ করুন এবং ছবি আপলোড করুন। ডিশ তৎক্ষণাত আপনার গ্রাহকদের QR মেনুতে দেখা যাবে।",
  },
  {
    q: "How do I generate QR codes for my tables?",
    qBn: "আমি কিভাবে আমার টেবিলের জন্য QR কোড তৈরি করব?",
    a: "Go to Dashboard → Tables → click on a table → 'Generate QR'. You can download, print, or copy the order link. Customers scan this QR to browse and order.",
    aBn: "ড্যাশবোর্ড → টেবিল → একটি টেবিলে ক্লিক করুন → 'QR তৈরি করুন'। আপনি অর্ডার লিঙ্ক ডাউনলোড, প্রিন্ট বা কপি করতে পারেন। গ্রাহকরা এই QR স্ক্যান করে ব্রাউজ এবং অর্ডার করে।",
  },
  {
    q: "How do I track orders in real-time?",
    qBn: "আমি কিভাবে রিয়েল-টাইমে অর্ডার ট্র্যাক করব?",
    a: "The Orders page shows all live orders with status badges (New, Preparing, Ready, Served). The Tables page shows a Kanban view by urgency. You'll also get real-time notifications when new orders arrive.",
    aBn: "অর্ডার পৃষ্ঠায় সমস্ত লাইভ অর্ডার স্ট্যাটাস ব্যাজ সহ দেখায় (নতুন, প্রস্তুত হচ্ছে, প্রস্তুত, পরিবেশিত)। টেবিল পৃষ্ঠায় জরুরতা অনুযায়ী কানবান ভিউ দেখায়।",
  },
  {
    q: "How does the AI Concierge (chatbot) work?",
    qBn: "AI কনসিয়ার্জ (চ্যাটবট) কিভাবে কাজ করে?",
    a: "The AI Concierge appears as a floating button on your customers' ordering screen. It can search the menu, recommend dishes, add items to orders, check order status, and call a waiter — all via natural conversation.",
    aBn: "AI কনসিয়ার্জ আপনার গ্রাহকদের অর্ডারিং স্ক্রিনে একটি ভাসমান বোতাম হিসাবে দেখা যায়। এটি মেনু অনুসন্ধান, ডিশ সুপারিশ, অর্ডারে আইটেম যোগ, অর্ডার স্ট্যাটাস চেক এবং ওয়েটার কল করতে পারে।",
  },
  {
    q: "How do I manage my staff and permissions?",
    qBn: "আমি কিভাবে আমার কর্মী এবং অনুমতি পরিচালনা করব?",
    a: "Go to Dashboard → Staff. You can invite team members by email, assign roles (Owner, Manager, Kitchen, Waiter), and each role has specific permissions. You can also transfer members between branches.",
    aBn: "ড্যাশবোর্ড → কর্মী এ যান। আপনি ইমেইল দ্বারা টিম সদস্যদের আমন্ত্রণ জানাতে, ভূমিকা নির্ধারণ করতে এবং শাখার মধ্যে সদস্যদের স্থানান্তর করতে পারেন।",
  },
  {
    q: "How do I view reports and analytics?",
    qBn: "আমি কিভাবে রিপোর্ট এবং বিশ্লেষণ দেখব?",
    a: "Go to Dashboard → Reports. You'll see revenue trends, top dishes, peak hours, and order volume. The Overview page also shows live KPIs like today's orders, revenue, and active tables.",
    aBn: "ড্যাশবোর্ড → রিপোর্ট এ যান। আপনি আয়ের প্রবণতা, শীর্ষ ডিশ, পিক আওয়ার এবং অর্ডার পরিমাণ দেখতে পাবেন।",
  },
  {
    q: "How do I manage inventory and track costs?",
    qBn: "আমি কিভাবে ইনভেন্টরি পরিচালনা এবং খরচ ট্র্যাক করব?",
    a: "Go to Dashboard → Inventory. Add your raw ingredients, set stock levels, and create recipes (BOM) linking ingredients to dishes. The system tracks COGS automatically and alerts you when stock is low.",
    aBn: "ড্যাশবোর্ড → ইনভেন্টরি এ যান। আপনার কাঁচামাল যোগ করুন, স্টক লেভেল সেট করুন এবং ডিশের সাথে উপাদান সংযুক্ত করে রেসিপি তৈরি করুন।",
  },
  {
    q: "What happens when my free trial ends?",
    qBn: "আমার ফ্রি ট্রায়াল শেষ হলে কী হয়?",
    a: "When your 14-day free trial ends, you'll be prompted to choose a paid plan. Your data and settings are preserved — you just need to subscribe to continue accepting orders. Plans start from ৳999/month.",
    aBn: "আপনার ১৪ দিনের ফ্রি ট্রায়াল শেষ হলে, আপনাকে একটি পেইড প্ল্যান বেছে নিতে বলা হবে। আপনার ডেটা এবং সেটিংস সংরক্ষিত থাকে।",
  },
];

/* ── Quick links ─────────────────────────────────────────────── */

const QUICK_LINKS = [
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M3 7h14M7 3v14" />
      </svg>
    ),
    title: "Dashboard Guide",
    titleBn: "ড্যাশবোর্ড গাইড",
    desc: "Learn how to navigate your restaurant dashboard",
    descBn: "আপনার রেস্তোরাঁ ড্যাশবোর্ড নেভিগেট করতে শিখুন",
    href: "#getting-started",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M4 4h12v12H4z" /><path d="M8 8h4M8 12h2" />
      </svg>
    ),
    title: "Menu Management",
    titleBn: "মেনু ব্যবস্থাপনা",
    desc: "Add dishes, categories, and manage your QR menu",
    descBn: "ডিশ, ক্যাটাগরি যোগ করুন এবং আপনার QR মেনু পরিচালনা করুন",
    href: "#faq",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" />
      </svg>
    ),
    title: "Order Tracking",
    titleBn: "অর্ডার ট্র্যাকিং",
    desc: "Real-time order management and kitchen display",
    descBn: "রিয়েল-টাইম অর্ডার ব্যবস্থাপনা এবং কিচেন ডিসপ্লে",
    href: "#faq",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <circle cx="10" cy="6" r="3" /><path d="M4 18v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
      </svg>
    ),
    title: "Staff & Roles",
    titleBn: "কর্মী ও ভূমিকা",
    desc: "Invite team members and manage permissions",
    descBn: "টিম সদস্যদের আমন্ত্রণ জানান এবং অনুমতি পরিচালনা করুন",
    href: "#faq",
  },
];

/* ── Component ───────────────────────────────────────────────── */

export function HelpPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";
  const { user } = useAuth();
  const { restaurant } = useRestaurant();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section aria-labelledby="help-heading" className="space-y-6">
      {/* Header */}
      <div>
        <h2 id="help-heading" className="text-lg font-semibold text-ink-900">
          {lang === "bn" ? "সাহায্য ও সহায়তা" : "Help & Support"}
        </h2>
        <p className="text-xs text-ink-400">
          {lang === "bn"
            ? "আপনার রেস্তোরাঁ ব্যবস্থাপনায় সাহায্য পান"
            : "Get help managing your restaurant with TomoDine"}
        </p>
      </div>

      {/* ── Quick Links ── */}
      <div id="getting-started" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((link) => (
          <a
            key={link.title}
            href={link.href}
            className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-lift"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              {link.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">
                {lang === "bn" ? link.titleBn : link.title}
              </p>
              <p className="mt-0.5 text-xs text-ink-400">
                {lang === "bn" ? link.descBn : link.desc}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* ── Getting Started ── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-900">
          {lang === "bn" ? "শুরু করুন" : "Getting Started"}
        </h3>
        <div className="mt-4 space-y-4">
          {[
            {
              step: "1",
              title: lang === "bn" ? "আপনার মেনু সেট আপ করুন" : "Set up your menu",
              desc: lang === "bn"
                ? "ড্যাশবোর্ড → মেনু তে যান। ক্যাটাগরি তৈরি করুন (যেমন: স্টার্টার, মেইন, ডেজার্ট) এবং আপনার ডিশ যোগ করুন।"
                : "Go to Dashboard → Menu. Create categories (e.g., Starters, Mains, Desserts) and add your dishes with names, prices, and images.",
            },
            {
              step: "2",
              title: lang === "bn" ? "টেবিল এবং QR কোড তৈরি করুন" : "Create tables & QR codes",
              desc: lang === "bn"
                ? "ড্যাশবোর্ড → টেবিল এ যান। আপনার টেবিল যোগ করুন এবং প্রতিটির জন্য QR কোড তৈরি করুন। প্রিন্ট করুন এবং টেবিলে রাখুন।"
                : "Go to Dashboard → Tables. Add your tables and generate QR codes for each. Print and place them on tables.",
            },
            {
              step: "3",
              title: lang === "bn" ? "আপনার টিম আমন্ত্রণ জানান" : "Invite your team",
              desc: lang === "bn"
                ? "ড্যাশবোর্ড → কর্মী এ যান। আপনার সহকর্মীদের ইমেইল দ্বারা আমন্ত্রণ জানান এবং তাদের ভূমিকা নির্ধারণ করুন।"
                : "Go to Dashboard → Staff. Invite your team members by email and assign roles (Manager, Kitchen, Waiter).",
            },
            {
              step: "4",
              title: lang === "bn" ? "অর্ডার গ্রহণ শুরু করুন" : "Start accepting orders",
              desc: lang === "bn"
                ? "গ্রাহকরা QR কোড স্ক্যান করে অর্ডার দেবে। আপনি ড্যাশবোর্ডে রিয়েল-টাইমে অর্ডার দেখতে পাবেন।"
                : "Customers scan the QR code to order. You'll see orders appear in real-time on your dashboard.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {item.step}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-ink-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div id="faq" className="card p-5">
        <h3 className="text-sm font-semibold text-ink-900">
          {lang === "bn" ? "সচরাচর জিজ্ঞাসা" : "Frequently Asked Questions"}
        </h3>
        <div className="mt-4 space-y-2">
          {FAQ_ITEMS.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} className="overflow-hidden rounded-lg border border-ink-100">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-25"
                >
                  <span className="text-sm font-medium text-ink-900">
                    {lang === "bn" ? faq.qBn : faq.q}
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-ink-50 px-4 py-3">
                    <p className="text-sm leading-relaxed text-ink-600">
                      {lang === "bn" ? faq.aBn : faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Contact Support ── */}
      <div id="contact" className="card p-5">
        <h3 className="text-sm font-semibold text-ink-900">
          {lang === "bn" ? "যোগাযোগ করুন" : "Contact Support"}
        </h3>
        <p className="mt-2 text-sm text-ink-500">
          {lang === "bn"
            ? "আপনার কোনো প্রশ্ন বা সমস্যা আছে? আমরা সাহায্য করতে এখানে আছি।"
            : "Have a question or issue? We're here to help."}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* WhatsApp */}
          <a
            href="https://wa.me/8801779184386"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-ink-100 p-3 transition-all hover:border-[#25D366] hover:shadow-sm"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/10">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#25D366]">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">WhatsApp</p>
              <p className="text-xs text-ink-400">+880 1779 184386</p>
            </div>
          </a>

          {/* Email */}
          <a
            href="mailto:support@tomodine.com"
            className="flex items-center gap-3 rounded-lg border border-ink-100 p-3 transition-all hover:border-brand-400 hover:shadow-sm"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-brand-600">
                <rect x="2" y="4" width="16" height="12" rx="2" />
                <path d="M2 4l8 6 8-6" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Email</p>
              <p className="text-xs text-ink-400">support@tomodine.com</p>
            </div>
          </a>

          {/* Website */}
          <a
            href="https://www.tomodine.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-ink-100 p-3 transition-all hover:border-brand-400 hover:shadow-sm"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5 text-brand-600">
                <circle cx="10" cy="10" r="8" />
                <path d="M2 10h16M10 2c-2.5 3-2.5 13 0 16M10 2c2.5 3 2.5 13 0 16" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Website</p>
              <p className="text-xs text-ink-400">www.tomodine.com</p>
            </div>
          </a>
        </div>
      </div>

      {/* ── Account Info ── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-900">
          {lang === "bn" ? "আপনার অ্যাকাউন্ট" : "Your Account"}
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-100 bg-ink-25 p-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
              {lang === "bn" ? "ইমেইল" : "Email"}
            </p>
            <p className="mt-1 text-sm font-medium text-ink-900">{user?.email || "—"}</p>
          </div>
          <div className="rounded-lg border border-ink-100 bg-ink-25 p-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
              {lang === "bn" ? "রেস্তোরাঁ" : "Restaurant"}
            </p>
            <p className="mt-1 text-sm font-medium text-ink-900">{restaurant?.name || "—"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
