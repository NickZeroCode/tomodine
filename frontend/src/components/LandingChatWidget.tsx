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
import { stripMarkdown } from "@/lib/stripMarkdown";

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
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3">
          {/* TomoDine AI — bot icon */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl active:scale-95"
            aria-label={t("landing.chatOpen", "Ask TomoDine AI")}
          >
            <img src="/images/logos/chatbot-logo.png" alt="TomoDine AI" className="h-full w-full object-cover" />
          </button>

          {/* WhatsApp */}
          <a
            href="https://wa.me/8801779184386"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md transition-all hover:bg-[#128C7E] hover:shadow-lg active:scale-95"
            aria-label="Chat on WhatsApp"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.814-6.3-2.18l-.44-.352-3.242 1.087 1.087-3.242-.352-.44A9.96 9.96 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
            </svg>
          </a>
        </div>
      )}

      {/* Chat window */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[480px] sm:w-[360px] sm:rounded-2xl sm:border sm:border-ink-100 sm:shadow-2xl"
          style={{ height: "100dvh", maxHeight: "-webkit-fill-available" } as React.CSSProperties}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 bg-brand-600 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20">
              <img src="/images/logos/chatbot-logo.png" alt="" className="h-full w-full object-cover" />
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
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand-50">
                  <img src="/images/logos/chatbot-logo.png" alt="TomoDine AI" className="h-full w-full object-cover" />
                </div>
                <p className="text-sm font-semibold text-ink-700">{t("landing.chatWelcome", "Hi! I'm TomoDine AI")}</p>
                <p className="mt-1 text-xs text-ink-400">{t("landing.chatWelcomeHint", "Ask me about our platform, features, pricing, or how to get started.")}</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100">
                    <img src="/images/logos/chatbot-logo.png" alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "user" ? "rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm bg-ink-50 text-ink-800"
                }`}>
                  {msg.role === "user" ? msg.content : stripMarkdown(msg.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100">
                  <img src="/images/logos/chatbot-logo.png" alt="" className="h-full w-full object-cover" />
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
          <div className="flex shrink-0 items-center gap-2 border-t border-ink-100 px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
