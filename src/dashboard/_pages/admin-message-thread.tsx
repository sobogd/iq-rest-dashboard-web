"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";
import { SendIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";

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
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}/messages`), { credentials: "include" });
      if (res.ok) {
        const msgs = (await res.json()) as Message[];
        setMessages((prev) => {
          const lastNew = msgs[msgs.length - 1];
          const lastPrev = prev[prev.length - 1];
          if (silent && lastNew && lastPrev && lastNew.id === lastPrev.id && msgs.length === prev.length) {
            return prev;
          }
          return msgs;
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => void load(true), 15000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.id !== lastIdRef.current) {
      lastIdRef.current = lastMsg.id;
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function autoresize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(Math.max(el.scrollHeight, 40), 70) + "px";
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    if (taRef.current) taRef.current.style.height = "";
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}/messages`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const sent = (await res.json()) as Message;
        setMessages((m) => [...m, sent]);
      }
    } finally {
      setSending(false);
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const ownerEmail = messages.find((m) => !m.isAdmin)?.user.email ?? "";

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--topbar-h,0px)-116px)] md:h-[calc(100dvh-var(--topbar-h,0px)-56px)]">
      <SubpageStickyBar onBack={() => router.push({ name: "settings.admin.messages" })} hideSave />
      <div className="max-w-5xl mx-auto md:px-6 w-full pt-5 md:pt-4 flex-1 flex flex-col min-h-0">
        <div className="mb-3 shrink-0">
          <div className="text-xs text-muted-foreground">Messages</div>
          <h2 className="text-xl font-medium text-foreground mt-1 truncate">{ownerEmail || "Conversation"}</h2>
        </div>

        <div
          ref={scrollRef}
          className="bg-card border border-border rounded-2xl overflow-y-auto p-4 space-y-3 flex-1 min-h-0 hide-scrollbar"
        >
          {loading && messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
              No messages yet
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
        </div>

        <div className="mt-3 shrink-0 flex flex-col gap-3">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoresize(e.currentTarget); }}
            onKeyDown={onInputKeyDown}
            placeholder="Type a message..."
            className="w-full h-[90px] px-4 py-3 text-sm leading-5 text-foreground bg-card border border-border rounded-2xl placeholder:text-muted-foreground focus:outline-none transition-colors resize-none box-border"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!input.trim() || sending}
            className="w-full shrink-0 flex h-10 px-4 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors items-center justify-center gap-2"
          >
            {sending ? (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <SendIcon size={14} />
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Admin's own replies sit on the right (gradient); the restaurant owner's
// messages sit on the left (secondary) with their email above the bubble.
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
          {!isAdmin && message.user.email ? (
            <div className="text-[10px] font-medium mb-1 opacity-70">{message.user.email}</div>
          ) : null}
          {message.message}
        </div>
        <div className={"text-[10px] text-muted-foreground mt-1 px-1 " + (isAdmin ? "text-right" : "text-left")}>{time}</div>
      </div>
    </div>
  );
}
