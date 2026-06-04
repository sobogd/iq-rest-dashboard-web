"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Star, EyeOff } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { SendIcon, RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { AVAILABLE_LANGUAGES } from "../_v2/i18n";

const LANG_FLAG = new Map(AVAILABLE_LANGUAGES.map((l) => [l.code, l.flag]));

interface Contact {
  id: string;
  name: string;
  externalId: string;
  lang: string | null;
  watched: boolean;
  muted: boolean;
}

interface Msg {
  id: string;
  direction: "in" | "out";
  body: string;        // contact-language text (sent/received)
  lang: string | null;
  translatedRu: string | null; // RU rendering
  status: string;
  createdAt: string;
}

export function AdminInboxThreadPage({ threadId }: { threadId: string }) {
  const router = useDashboardRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState<{ ru: string; lang: string; text: string } | null>(null);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/inbox/threads/${encodeURIComponent(threadId)}/messages`), { credentials: "include" });
      if (res.ok) {
        const j = (await res.json()) as { contact: Contact; messages: Msg[] };
        setContact(j.contact);
        setMessages(j.messages ?? []);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Light polling so inbound replies appear without a manual refresh.
  useEffect(() => {
    const id = setInterval(() => void load(true), 15000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.id !== lastIdRef.current) {
      lastIdRef.current = last.id;
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function autoresize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(Math.max(el.scrollHeight, 40), 120) + "px";
  }

  // Step 1: translate (no send) so the admin can verify the outgoing text.
  async function requestPreview() {
    const ru = input.trim();
    if (!ru || preparing || sending) return;
    setPreparing(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/inbox/threads/${encodeURIComponent(threadId)}/preview`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ru }),
      });
      if (res.ok) {
        const j = (await res.json()) as { lang: string; text: string };
        setPreview({ ru, lang: j.lang, text: j.text });
      } else {
        const j = await res.json().catch(() => ({}));
        window.alert(j.message || "Preview failed");
      }
    } finally {
      setPreparing(false);
    }
  }

  // Step 2: send the approved (possibly edited) translation verbatim.
  async function confirmSend() {
    if (!preview || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/inbox/threads/${encodeURIComponent(threadId)}/send`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ru: preview.ru, text: preview.text }),
      });
      if (res.ok) {
        const sent = (await res.json()) as Msg;
        setMessages((m) => [...m, sent]);
        setInput("");
        if (taRef.current) taRef.current.style.height = "";
        setPreview(null);
      } else {
        const j = await res.json().catch(() => ({}));
        window.alert(j.message || "Send failed");
      }
    } finally {
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void requestPreview();
    }
  }

  async function setFlag(patch: { watched?: boolean; muted?: boolean }) {
    if (!contact) return;
    await fetch(apiUrl(`/api/admin/inbox/contacts/${contact.id}/flags`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void load(true);
  }

  function toggleOriginal(id: string) {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--topbar-h,0px))]">
      <SubpageStickyBar onBack={() => router.push({ name: "settings.admin.inbox" })} hideSave>
        {contact ? (
          <>
            <button
              type="button"
              onClick={() => setFlag({ watched: !contact.watched })}
              className={"h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md " + (contact.watched ? "text-amber-500" : "text-muted-foreground hover:text-foreground")}
              title={contact.watched ? "Unwatch" : "Watch"}
            >
              <Star className="w-4 h-4" fill={contact.watched ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={() => setFlag({ muted: !contact.muted })}
              className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
              title={contact.muted ? "Unmute" : "Mute"}
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </>
        ) : null}
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
        {contact ? (
          <div className="shrink-0 px-4 pt-4 pb-2 flex items-center gap-2">
            <span className="text-base" title={contact.lang || ""}>{LANG_FLAG.get(contact.lang || "") || "🌐"}</span>
            <span className="text-sm font-medium text-foreground truncate">{contact.name}</span>
            <span className="text-[11px] text-muted-foreground">{contact.externalId}</span>
          </div>
        ) : null}

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 md:px-4 py-3 space-y-3">
          {loading && messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No messages yet</div>
          ) : (
            messages.map((m) => (
              <Bubble key={m.id} m={m} showOriginal={showOriginal.has(m.id)} onToggle={() => toggleOriginal(m.id)} />
            ))
          )}
        </div>

        <div className="shrink-0 flex items-start gap-2 p-3">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoresize(e.currentTarget); }}
            onKeyDown={onKey}
            placeholder="Напишите по-русски…"
            rows={1}
            className="flex-1 h-[40px] min-h-[40px] max-h-[120px] px-3 py-2 text-sm leading-5 text-foreground bg-card border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none resize-none box-border"
          />
          <button
            type="button"
            onClick={() => void requestPreview()}
            disabled={!input.trim() || preparing || sending}
            className="shrink-0 inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-lg disabled:opacity-60"
          >
            {preparing ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <SendIcon size={14} />}
            Send
          </button>
        </div>
      </div>

      {preview ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="text-base">{LANG_FLAG.get(preview.lang) || "🌐"}</span>
              Preview — will be sent in {preview.lang.toUpperCase()}
            </div>
            <textarea
              value={preview.text}
              onChange={(e) => setPreview((p) => (p ? { ...p, text: e.target.value } : p))}
              rows={4}
              className="w-full px-3 py-2 text-sm leading-5 text-foreground bg-secondary border border-input rounded-lg focus:outline-none resize-none"
            />
            <div className="text-[11px] text-muted-foreground">
              <span className="opacity-70">Your text (RU):</span> {preview.ru}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                disabled={sending}
                className="h-8 px-3 text-xs font-medium bg-secondary text-foreground rounded-lg hover:bg-muted disabled:opacity-60"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void confirmSend()}
                disabled={sending || !preview.text.trim()}
                className="h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {sending ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <SendIcon size={12} />}
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Incoming: Russian translation shown primary, original on tap. Outgoing: the
// Russian you typed shown primary, the sent (contact-language) text on tap.
function Bubble({ m, showOriginal, onToggle }: { m: Msg; showOriginal: boolean; onToggle: () => void }) {
  const out = m.direction === "out";
  const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const primary = out ? (m.translatedRu || m.body) : (m.translatedRu || m.body);
  const secondary = out ? m.body : m.body; // contact-language text
  const hasAlt = !!m.translatedRu && m.body !== m.translatedRu;
  const cls = out ? "bg-primary-gradient text-primary-foreground rounded-tr-sm" : "bg-secondary text-foreground rounded-tl-sm";
  return (
    <div className={"flex " + (out ? "justify-end" : "justify-start")}>
      <div className="max-w-[78%]">
        <div className={"px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words " + cls}>
          {primary}
          {hasAlt && showOriginal ? (
            <div className={"mt-1.5 pt-1.5 text-[12px] border-t " + (out ? "border-white/25" : "border-border")}>
              {secondary}
            </div>
          ) : null}
        </div>
        <div className={"flex items-center gap-2 mt-1 px-1 " + (out ? "justify-end" : "justify-start")}>
          {hasAlt ? (
            <button type="button" onClick={onToggle} className="text-[10px] text-muted-foreground underline">
              {showOriginal ? "hide original" : (out ? "show sent" : "show original")}
            </button>
          ) : null}
          <span className="text-[10px] text-muted-foreground tabular-nums">{time}</span>
          {out && m.status === "failed" ? <span className="text-[10px] text-red-500">failed</span> : null}
        </div>
      </div>
    </div>
  );
}
