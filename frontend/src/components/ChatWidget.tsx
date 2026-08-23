/**
 * ChatWidget — floating AI Concierge for the customer ordering page.
 *
 * Renders a chat bubble in the bottom-right corner.  Clicking opens
 * a chat window with message history, quick replies, dish carousels,
 * and action buttons.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatApi, type ChatMessage, type StructuredActions } from "@/hooks/useChatApi";
import { formatBDT } from "@/lib/format";

interface Props {
  tableId?: string;
  restaurantSlug?: string;
}

/* ── Main widget ─────────────────────────────────────────────── */

export function ChatWidget({ tableId, restaurantSlug }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { messages, isLoading, sendMessage, resetSession } = useChatApi({ tableId, restaurantSlug });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when opened.
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    void sendMessage(input);
    setInput("");
  }, [input, sendMessage]);

  const handleQuickReply = useCallback(
    (text: string) => {
      void sendMessage(text);
    },
    [sendMessage]
  );

  return (
    <>
      {/* ── Floating bubble — positioned above the bottom nav bar ── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl active:scale-95 sm:bottom-20 sm:right-5 sm:h-13 sm:w-13"
          aria-label={t("chat.open", "Open TomoDine AI")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {messages.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[0.55rem] font-bold">
              {messages.filter((m) => m.role === "assistant").length}
            </span>
          )}
        </button>
      )}

      {/* ── Chat window — full-screen on mobile, floating on desktop ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-20 sm:right-5 sm:h-[500px] sm:w-[380px] sm:rounded-2xl sm:border sm:border-ink-100 sm:shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 bg-brand-600 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-white">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{t("chat.title", "TomoDine AI")}</p>
              <p className="truncate text-[0.65rem] text-white/70">{t("chat.subtitle", "Ask about the menu, order, or call a waiter")}</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={resetSession}
                className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                title={t("chat.newSession", "New conversation")}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-brand-600">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-ink-700">{t("chat.welcome", "Welcome! How can I help?")}</p>
                <p className="mt-1 text-xs text-ink-400">{t("chat.welcomeHint", "Ask about our menu, place an order, or call a waiter")}</p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onQuickReply={handleQuickReply} />
            ))}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100">
                  <span className="text-xs font-bold text-brand-600">AI</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-ink-50 px-3.5 py-2.5">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          {messages.length === 0 && (
            <div className="flex gap-1.5 border-t border-ink-50 px-3 py-2 sm:px-4">
              {[
                t("chat.suggestMenu", "Show me the menu"),
                t("chat.suggestVeg", "What's vegetarian?"),
                t("chat.suggestWaiter", "Call a waiter"),
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleQuickReply(suggestion)}
                  className="rounded-full border border-ink-200 px-2.5 py-1 text-[0.65rem] font-medium text-ink-600 transition hover:bg-ink-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-ink-100 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t("chat.placeholder", "Ask about the menu...")}
              className="flex-1 rounded-full border border-ink-200 bg-ink-50 px-3.5 py-2 text-sm text-ink-900 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-1 focus:ring-brand-200"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Message bubble ──────────────────────────────────────────── */

function MessageBubble({
  message,
  onQuickReply,
}: {
  message: ChatMessage;
  onQuickReply: (text: string) => void;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100">
          <span className="text-xs font-bold text-brand-600">AI</span>
        </div>
      )}

      <div className={`max-w-[85%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Text bubble */}
        {message.content && (
          <div
            className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              isUser
                ? "rounded-tr-sm bg-brand-600 text-white"
                : "rounded-tl-sm bg-ink-50 text-ink-800"
            }`}
          >
            {message.content}
          </div>
        )}

        {/* Structured actions */}
        {message.structuredActions && (
          <StructuredActionsRenderer actions={message.structuredActions} onQuickReply={onQuickReply} lang={lang} />
        )}
      </div>
    </div>
  );
}

/* ── Structured actions renderer ─────────────────────────────── */

function StructuredActionsRenderer({
  actions,
  onQuickReply,
  lang,
}: {
  actions: StructuredActions;
  onQuickReply: (text: string) => void;
  lang: "en" | "bn";
}) {
  const { t } = useTranslation();

  switch (actions.type) {
    case "dish_carousel":
      return (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {(actions.items ?? []).map((item, idx) => (
            <div
              key={item.id ?? idx}
              className="flex w-44 shrink-0 flex-col overflow-hidden rounded-xl border border-ink-100 bg-white"
            >
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="h-24 w-full object-cover" />
              ) : (
                <div className="flex h-24 items-center justify-center bg-ink-50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="h-8 w-8 text-ink-200">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  </svg>
                </div>
              )}
              <div className="flex flex-1 flex-col p-2.5">
                <p className="text-xs font-semibold text-ink-900">{item.name}</p>
                {item.description && (
                  <p className="mt-0.5 line-clamp-2 text-[0.6rem] text-ink-400">{item.description}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm font-bold tabular-nums text-ink-900">
                    {item.price != null ? formatBDT(item.price, lang) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuickReply(`Add ${item.name} to my order`)}
                    className="rounded-md bg-brand-600 px-2 py-1 text-[0.6rem] font-bold text-white transition hover:bg-brand-700"
                  >
                    {t("chat.add", "Add")}
                  </button>
                </div>
                {item.badge && (
                  <span className="mt-1 w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-[0.55rem] font-medium text-emerald-700">
                    {item.badge}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      );

    case "price_comparison":
      return (
        <div className="overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-ink-50 text-[0.6rem] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-3 py-2 text-left">{t("chat.dish", "Dish")}</th>
                <th className="px-3 py-2 text-right">{t("chat.price", "Price")}</th>
                <th className="px-3 py-2 text-left">{t("chat.category", "Category")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {(actions.items ?? []).map((item, idx) => (
                <tr key={idx} className="transition-colors hover:bg-ink-25">
                  <td className="px-3 py-2 font-medium text-ink-900">{item.name}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink-900">
                    {item.price != null ? formatBDT(item.price, lang) : "—"}
                  </td>
                  <td className="px-3 py-2 text-ink-500">{item.category || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "confirmation":
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
          <svg viewBox="0 0 24 24" fill="none" className="mx-auto h-8 w-8 text-emerald-500">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-1.5 text-sm font-semibold text-emerald-800">{actions.message}</p>
          {actions.order_total && (
            <p className="mt-0.5 text-xs text-emerald-600">
              {t("chat.orderTotal", "Order total")}: {formatBDT(actions.order_total, lang)}
            </p>
          )}
        </div>
      );

    case "waiter_ping":
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
          <svg viewBox="0 0 24 24" fill="none" className="mx-auto h-8 w-8 text-amber-500">
            <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-1.5 text-sm font-semibold text-amber-800">{actions.message}</p>
        </div>
      );

    default:
      return null;
  }
}
