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
import { stripMarkdown } from "@/lib/stripMarkdown";

interface Props {
  tableId?: string;
  restaurantSlug?: string;
  onPlayGames?: () => void;
}

/* ── Main widget ─────────────────────────────────────────────── */

export function ChatWidget({ tableId, restaurantSlug, onPlayGames }: Props) {
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
          className="fixed bottom-24 right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl active:scale-95 sm:bottom-20 sm:right-5 sm:h-12 sm:w-12"
          aria-label={t("chat.open", "Open TomoDine AI")}
        >
          <img src="/images/logos/chatbot-logo.png" alt="TomoDine AI" className="h-full w-full rounded-full object-cover" />
          {messages.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[0.55rem] font-bold">
              {messages.filter((m) => m.role === "assistant").length}
            </span>
          )}
        </button>
      )}

      {/* ── Chat window — full-screen on mobile, floating on desktop ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-20 sm:right-5 sm:h-[500px] sm:w-[380px] sm:rounded-2xl sm:border sm:border-ink-100 sm:shadow-2xl"
          style={{ height: "100dvh", maxHeight: "-webkit-fill-available" } as React.CSSProperties}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 bg-brand-600 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
              <img src="/images/logos/chatbot-logo.png" alt="" className="h-5 w-5 rounded-full object-cover" />
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
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 sm:px-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand-50">
                  <img src="/images/logos/chatbot-logo.png" alt="TomoDine AI" className="h-full w-full object-cover" />
                </div>
                <p className="text-sm font-semibold text-ink-700">{t("chat.welcome", "Welcome! How can I help?")}</p>
                <p className="mt-1 text-xs text-ink-400">{t("chat.welcomeHint", "Ask about our menu, place an order, or call a waiter")}</p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onQuickReply={handleQuickReply} onPlayGames={onPlayGames} />
            ))}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100">
                  <img src="/images/logos/chatbot-logo.png" alt="" className="h-full w-full rounded-full object-cover" />
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
          <div className="flex shrink-0 items-center gap-2 border-t border-ink-100 px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
  onPlayGames,
}: {
  message: ChatMessage;
  onQuickReply: (text: string) => void;
  onPlayGames?: () => void;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100">
          <img src="/images/logos/chatbot-logo.png" alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className={`max-w-[85%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Text bubble */}
        {message.content && (
          <div
            className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
              isUser
                ? "rounded-tr-sm bg-brand-600 text-white"
                : "rounded-tl-sm bg-ink-50 text-ink-800"
            }`}
          >
            {isUser ? message.content : stripMarkdown(message.content)}
          </div>
        )}

        {/* Structured actions */}
        {message.structuredActions && (
          <StructuredActionsRenderer actions={message.structuredActions} onQuickReply={onQuickReply} onPlayGames={onPlayGames} lang={lang} />
        )}
      </div>
    </div>
  );
}

/* ── Structured actions renderer ─────────────────────────────── */

function StructuredActionsRenderer({
  actions,
  onQuickReply,
  onPlayGames,
  lang,
}: {
  actions: StructuredActions;
  onQuickReply: (text: string) => void;
  onPlayGames?: () => void;
  lang: "en" | "bn";
}) {
  const { t } = useTranslation();
  const [detailItem, setDetailItem] = useState<NonNullable<StructuredActions["items"]>[number] | null>(null);
  const [detailQty, setDetailQty] = useState(1);

  switch (actions.type) {
    case "dish_carousel":
      return (
        <>
          <div className="min-w-0 max-w-full flex gap-2 overflow-x-auto pb-1 scrollbar-thin snap-x snap-mandatory">
            {(actions.items ?? []).map((item, idx) => (
              <button
                key={item.id ?? idx}
                type="button"
                onClick={() => { setDetailItem(item); setDetailQty(1); }}
                className="flex w-36 shrink-0 snap-start cursor-pointer flex-col overflow-hidden rounded-xl border border-ink-100 bg-white text-left transition-all hover:shadow-md active:scale-[0.98]"
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-gradient-to-br from-ink-50 to-ink-100">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="h-8 w-8 text-ink-200">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-2">
                  <p className="text-xs font-bold text-ink-900 leading-tight">{item.name}</p>
                  {item.description && (
                    <p className="mt-0.5 line-clamp-1 text-[0.6rem] text-ink-400">{item.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-1.5">
                    <span className="text-sm font-bold tabular-nums text-ink-900">
                      {item.price != null ? formatBDT(item.price, lang) : "—"}
                    </span>
                    <span
                      className="rounded-md bg-brand-600 px-2 py-0.5 text-[0.55rem] font-bold text-white"
                    >
                      {t("chat.add", "Add")}
                    </span>
                  </div>
                  {item.badge && (
                    <span className="mt-1 w-fit rounded-full bg-emerald-50 px-1.5 py-px text-[0.5rem] font-medium text-emerald-700">
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Detail modal */}
          {detailItem && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" onClick={() => setDetailItem(null)}>
              <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                {detailItem.image_url && (
                  <img src={detailItem.image_url} alt={detailItem.name} className="mb-4 h-48 w-full rounded-xl object-cover" />
                )}
                <h3 className="text-lg font-bold text-ink-900">{detailItem.name}</h3>
                {detailItem.category && (
                  <p className="mt-0.5 text-xs text-ink-400">{detailItem.category}</p>
                )}
                {detailItem.description && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{detailItem.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {detailItem.is_vegetarian && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[0.65rem] font-medium text-green-700">Vegetarian</span>
                  )}
                  {detailItem.is_spicy && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[0.65rem] font-medium text-red-700">Spicy</span>
                  )}
                  {detailItem.badge && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700">{detailItem.badge}</span>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xl font-bold tabular-nums text-ink-900">
                    {detailItem.price != null ? formatBDT(detailItem.price * detailQty, lang) : "—"}
                  </span>
                  {detailItem.min_prep_time && (
                    <span className="text-xs text-ink-400">{detailItem.min_prep_time}–{detailItem.max_prep_time} min</span>
                  )}
                </div>
                {/* Quantity selector */}
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-50 active:scale-90"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                  </button>
                  <span className="w-10 text-center text-lg font-bold tabular-nums text-ink-900">{detailQty}</span>
                  <button
                    type="button"
                    onClick={() => setDetailQty((q) => Math.min(20, q + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-50 active:scale-90"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                  </button>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { onQuickReply(`Add ${detailQty}x ${detailItem.name} to my order`); setDetailItem(null); setDetailQty(1); }}
                    className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
                  >
                    {t("chat.addToOrder", "Add to order")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDetailItem(null); setDetailQty(1); }}
                    className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
                  >
                    {t("common.close", "Close")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
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
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => onQuickReply("Show me the menu")}
              className="rounded-full border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              {t("chat.addMore", "Add something else")}
            </button>
            {onPlayGames && (
              <button
                type="button"
                onClick={onPlayGames}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8 7.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm-2 5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm7-2a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
                </svg>
                {t("chat.playGames", "Play games while you wait")}
              </button>
            )}
          </div>
        </div>
      );

    case "order_status":
      return (
        <div className="space-y-2">
          {(actions.orders ?? []).map((order, idx) => {
            const statusColors: Record<string, string> = {
              new: "bg-blue-100 text-blue-700",
              accepted: "bg-violet-100 text-violet-700",
              preparing: "bg-amber-100 text-amber-700",
              ready: "bg-emerald-100 text-emerald-700",
              served: "bg-teal-100 text-teal-700",
              paid: "bg-ink-100 text-ink-700",
            };
            return (
              <div key={order.id ?? idx} className="rounded-lg border border-ink-100 bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink-900">#{order.order_number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${statusColors[order.status ?? ""] ?? "bg-ink-100 text-ink-600"}`}>
                    {order.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[0.65rem] text-ink-500">
                  <span>{formatBDT(order.total ?? "0", lang)}</span>
                  {order.minutes_ago != null && <span>{order.minutes_ago}m ago</span>}
                </div>
              </div>
            );
          })}
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
