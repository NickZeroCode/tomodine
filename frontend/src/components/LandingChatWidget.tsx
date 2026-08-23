/**
 * LandingChatWidget — TomoDine AI for the public landing page.
 *
 * System-info-only mode: answers questions about TomoDine the platform,
 * how to sign up, pricing, features, FAQ, contact info.  No ordering,
 * no branch-specific data.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";

const chatApi = axios.create({ baseURL: "/api/v1" });

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function LandingChatWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: uid(), role: "user", content: text.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const payload: Record<string, unknown> = { message: text.trim() };
      if (sessionIdRef.current) payload.session_id = sessionIdRef.current;
      const { data } = await chatApi.post("/chat/", payload);
      sessionIdRef.current = data.session_id;
      setMessages((prev) => [...prev, {
        id: uid(),
        role: "assistant",
        content: data.response || "",
        timestamp: Date.now(),
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: uid(),
        role: "assistant",
        content: "I'm having trouble right now. Please try again or contact us at +880 1779 184386.",
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const suggestions = [
    t("landing.chatSuggest1", "What is TomoDine?"),
    t("landing.chatSuggest2", "How do I sign up?"),
    t("landing.chatSuggest3", "How does it work for customers?"),
  ];

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl active:scale-95"
          aria-label={t("landing.chatOpen", "Ask TomoDine AI")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[480px] sm:w-[360px] sm:rounded-2xl sm:border sm:border-ink-100 sm:shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 bg-brand-600 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-white">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">TomoDine AI</p>
              <p className="truncate text-[0.6rem] text-white/70">Ask about our platform, features, and pricing</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                  <span className="text-lg font-bold text-brand-600">T</span>
                </div>
                <p className="text-sm font-semibold text-ink-700">{t("landing.chatWelcome", "Hi! I'm TomoDine AI")}</p>
                <p className="mt-1 text-xs text-ink-400">{t("landing.chatWelcomeHint", "Ask me about our platform, features, pricing, or how to get started.")}</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100">
                    <span className="text-[0.5rem] font-bold text-brand-600">T</span>
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user" ? "rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm bg-ink-50 text-ink-800"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100">
                  <span className="text-[0.5rem] font-bold text-brand-600">T</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-ink-50 px-3 py-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-ink-50 px-3 py-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)}
                  className="rounded-full border border-ink-200 px-2.5 py-1 text-[0.6rem] font-medium text-ink-600 hover:bg-ink-50">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-ink-100 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <input
              ref={inputRef} type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              placeholder={t("landing.chatPlaceholder", "Ask about TomoDine...")}
              className="flex-1 rounded-full border border-ink-200 bg-ink-50 px-3.5 py-2 text-sm text-ink-900 outline-none focus:border-brand-400 focus:bg-white focus:ring-1 focus:ring-brand-200"
              disabled={loading}
            />
            <button type="button" onClick={() => void send(input)} disabled={!input.trim() || loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40">
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
