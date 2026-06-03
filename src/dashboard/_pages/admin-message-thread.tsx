"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";
import { SendIcon, RefreshIcon } from "../_v2/icons";
import { Select, SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";

const ADMIN_LOCALES = [
  "ar", "bg", "ca", "cs", "da", "de", "el", "en", "es", "et", "fa", "fi",
  "fr", "ga", "hr", "hu", "is", "it", "ja", "ko", "lt", "lv", "nl", "no",
  "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", "tr", "uk", "zh",
];

interface Message {
  id: string;
  message: string;
  isAdmin: boolean;
  createdAt: string;
  user: { email: string };
}

export function AdminMessageThreadPage({ restaurantId }: { restaurantId: string }) {
  const router = useDashboardRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [adminLocale, setAdminLocale] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}/messages`), { credentials: "include" });
      if (res.ok) setMessages((await res.json()) as Message[]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function sendMessage() {
    const text = newMessage.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}/messages`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, ...(adminLocale ? { locale: adminLocale } : {}) }),
      });
      if (res.ok) {
        const sent = (await res.json()) as Message;
        setMessages((prev) => [...prev, sent]);
        setNewMessage("");
        if (taRef.current) taRef.current.style.height = "";
        taRef.current?.focus();
      }
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }
  function autoresize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(Math.max(el.scrollHeight, 40), 120) + "px";
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--topbar-h,0px))]">
      <SubpageStickyBar onBack={() => router.push({ name: "settings.admin.messages" })} hideSave>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </SubpageStickyBar>
      <div className="flex-1 min-h-0 w-full max-w-3xl mx-auto flex flex-col">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 md:px-4 py-4 space-y-3">
          {loading && messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No messages yet</div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
        </div>
        <div className="shrink-0 px-3 pt-2 flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Lang</label>
          <Select<string>
            value={adminLocale}
            onChange={setAdminLocale}
            className="!h-8 !w-24 !px-2 text-xs"
            options={[{ value: "", label: "Auto" }, ...ADMIN_LOCALES.map((l) => ({ value: l, label: l }))]}
          />
        </div>
        <div className="shrink-0 flex items-start gap-2 p-3">
          <textarea
            ref={taRef}
            value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); autoresize(e.currentTarget); }}
            onKeyDown={handleKey}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 h-[40px] min-h-[40px] max-h-[120px] px-3 py-2 text-sm leading-5 text-foreground bg-card border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none resize-none box-border"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!newMessage.trim() || sending}
            className="shrink-0 inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-lg disabled:opacity-60"
          >
            {sending ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <SendIcon size={14} />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isAdmin = message.isAdmin;
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const cls = isAdmin
    ? "bg-primary-gradient text-primary-foreground rounded-tr-sm"
    : "bg-secondary text-foreground rounded-tl-sm";
  return (
    <div className={"flex " + (isAdmin ? "justify-end" : "justify-start")}>
      <div className="max-w-[75%]">
        <div className={"px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words " + cls}>
          {!isAdmin ? <div className="text-[10px] font-medium mb-1 opacity-70">{message.user.email}</div> : null}
          {message.message}
        </div>
        <div className={"text-[10px] text-muted-foreground mt-1 px-1 " + (isAdmin ? "text-right" : "text-left")}>{time}</div>
      </div>
    </div>
  );
}
