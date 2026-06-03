"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  ExternalLink,
  LogIn,
  Mail,
  MessageSquare,
  StickyNote,
  X as CloseIcon,
  Trash2,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { SendIcon } from "../_v2/icons";
import { Select } from "../_v2/ui";
import { MenuPreviewModal } from "@/components/menu-preview-modal";
import { getMenuUrl } from "@/lib/menu-url";
import { useDashboardRouter } from "../_spa/router";

interface RestaurantUser {
  id: string;
  email: string;
  preferredLocale: string | null;
  hasStripeCustomer: boolean;
  emailsSent: Record<string, string> | null;
  emailUnsubscribed: boolean;
  attachedAt: string;
  isOwner: boolean;
  userCreatedAt: string;
}

interface RestaurantDetail {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  whatsapp: string | null;
  languages: string[];
  defaultLanguage: string | null;
  reservationsEnabled: boolean;
  plan: string;
  billingCycle: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  hasStripeSub: boolean;
  paymentProcessing: boolean;
  adminComment: string | null;
  createdAt: string;
  categoriesCount: number;
  itemsCount: number;
  messagesCount: number;
  users: RestaurantUser[];
}

interface EmailTemplate {
  id: string;
  label: string;
  description: string;
}

// Locale codes admin can pick when sending an email or support reply.
// Matches the i18n template catalogue on the API (admin-only — English only).
const ADMIN_LOCALES = [
  "ar", "bg", "ca", "cs", "da", "de", "el", "en", "es", "et", "fa", "fi",
  "fr", "ga", "hr", "hu", "is", "it", "ja", "ko", "lt", "lv", "nl", "no",
  "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", "tr", "uk", "zh",
];

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome_personal",
    label: "Personal welcome from Bogdan",
    description: "Friendly intro offering setup help. Sent in owner's preferred language.",
  },
  {
    id: "menu_almost_ready",
    label: "Menu almost ready reminder",
    description: "Nudge for owners who started setup but haven't finished. Sent in owner's preferred language.",
  },
  {
    id: "trial_ending",
    label: "Trial ends tomorrow",
    description: "Heads-up that the free trial expires in 1 day. Points to billing page; offers reply for questions.",
  },
];

interface Message {
  id: string;
  message: string;
  isAdmin: boolean;
  createdAt: string;
  user: { email: string };
}

type NestedView = "messages" | "email" | "comment" | null;

interface Props {
  restaurantId: string;
  /** When provided, used instead of the router-based back nav (modal mode). */
  onClose?: () => void;
}

function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (withTime) {
    return d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminRestaurantPage({ restaurantId, onClose }: Props) {
  const router = useDashboardRouter();
  // Modal mode passes onClose; page mode (route) falls back to router nav.
  const close = onClose ?? (() => router.push({ name: "settings.admin.restaurants" }));
  const [nested, setNested] = useState<NestedView>(null);
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [impersonating, setImpersonating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);
  const [confirmTemplate, setConfirmTemplate] = useState<EmailTemplate | null>(null);
  // Admin-picked locale for outgoing emails + support replies. Empty = auto
  // (server falls back to user.preferredLocale → restaurant.defaultLanguage → en).
  const [adminLocale, setAdminLocale] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const fetchRestaurant = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}`), { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) setError("Access denied");
        else if (res.status === 404) setError("Restaurant not found");
        else setError("Failed to load");
        return;
      }
      const data = await res.json();
      setRestaurant(data);
      setError(null);
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}/messages`), { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as Message[];
        setMessages((prev) => {
          const lastNew = data[data.length - 1];
          const lastPrev = prev[prev.length - 1];
          if (lastNew && lastPrev && lastNew.id === lastPrev.id && data.length === prev.length) {
            return prev;
          }
          return data;
        });
      }
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (nested === "messages" && messages.length === 0) {
      fetchMessages();
    }
  }, [nested, messages.length, fetchMessages]);

  function openCommentModal() {
    setCommentDraft(restaurant?.adminComment ?? "");
    setNested("comment");
  }

  async function saveComment() {
    if (savingComment) return;
    setSavingComment(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}/admin-comment`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminComment: commentDraft }),
      });
      if (res.ok) {
        const j = (await res.json()) as { adminComment: string | null };
        setRestaurant((prev) => (prev ? { ...prev, adminComment: j.adminComment } : prev));
        setNested(null);
      } else {
        const j = await res.json().catch(() => ({}));
        setAlert({ title: "Save failed", message: j.message || j.error || "Could not save." });
      }
    } catch {
      setAlert({ title: "Save failed", message: "Network error" });
    } finally {
      setSavingComment(false);
    }
  }

  async function applyDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setConfirmDelete(false);
        close();
      } else {
        const j = await res.json().catch(() => ({}));
        setAlert({ title: "Delete failed", message: j.message || j.error || "Could not delete." });
      }
    } catch {
      setAlert({ title: "Delete failed", message: "Network error" });
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (nested !== "messages") return;
    const id = setInterval(() => {
      fetchMessages(true);
    }, 15000);
    return () => clearInterval(id);
  }, [nested, fetchMessages]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.id !== lastIdRef.current) {
      lastIdRef.current = lastMsg.id;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages]);

  async function handleImpersonate() {
    if (!restaurant || impersonating) return;
    const owner = restaurant.users.find((u) => u.isOwner) ?? restaurant.users[0];
    if (!owner) return;
    setImpersonating(true);
    try {
      const res = await fetch(apiUrl("/api/admin/impersonate"), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: owner.id }),
      });
      if (res.ok) {
        window.location.assign("/");
      } else {
        const data = await res.json().catch(() => ({}));
        setAlert({ title: "Login failed", message: data.error || "Could not impersonate user." });
        setImpersonating(false);
      }
    } catch {
      setAlert({ title: "Login failed", message: "Network error" });
      setImpersonating(false);
    }
  }

  async function sendEmailTemplate(tpl: EmailTemplate) {
    if (sendingTemplate || !restaurant) return;
    const owner = restaurant.users.find((u) => u.isOwner) ?? restaurant.users[0];
    if (!owner) return;
    setSendingTemplate(tpl.id);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${owner.id}/send-email`), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: tpl.id, ...(adminLocale ? { locale: adminLocale } : {}) }),
      });
      if (res.ok) {
        const j = await res.json();
        // Optimistic update on the owner's emailsSent map.
        setRestaurant((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            users: prev.users.map((u) =>
              u.id === owner.id
                ? { ...u, emailsSent: { ...(u.emailsSent ?? {}), [tpl.id]: j.sentAt } }
                : u,
            ),
          };
        });
        setAlert({ title: "Sent", message: `Email "${tpl.label}" sent to ${j.to} in ${j.locale}.` });
      } else {
        const j = await res.json().catch(() => ({}));
        setAlert({ title: "Failed", message: j.message || j.error || "Could not send email." });
      }
    } catch {
      setAlert({ title: "Failed", message: "Network error" });
    } finally {
      setSendingTemplate(null);
      setConfirmTemplate(null);
    }
  }

  async function sendMessage() {
    const text = newMessage.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}/messages`), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, ...(adminLocale ? { locale: adminLocale } : {}) }),
      });
      if (res.ok) {
        const sent = await res.json();
        setMessages((prev) => [...prev, sent]);
        setNewMessage("");
        if (taRef.current) taRef.current.style.height = "";
        taRef.current?.focus();
      } else {
        setAlert({ title: "Send failed", message: "Could not send message." });
      }
    } catch {
      setAlert({ title: "Send failed", message: "Network error" });
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoresize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, 40), 70);
    el.style.height = next + "px";
  }

  if (loading && !restaurant) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          {error || "Not found"}
        </div>
      </div>
    );
  }

  const title = restaurant.title || "No name";
  const planLabel = `${restaurant.plan}${restaurant.subscriptionStatus === "ACTIVE" ? " (Active)" : ""}`;
  const restaurantRows: { label: string; value: string }[] = [
    { label: "Plan", value: planLabel },
    { label: "Created", value: formatDate(restaurant.createdAt, true) },
    { label: "Categories", value: String(restaurant.categoriesCount) },
    { label: "Items", value: String(restaurant.itemsCount) },
  ];
  if (restaurant.plan !== "FREE") {
    if (restaurant.billingCycle) restaurantRows.push({ label: "Billing", value: restaurant.billingCycle });
    if (restaurant.currentPeriodEnd) restaurantRows.push({ label: "Period Ends", value: formatDate(restaurant.currentPeriodEnd) });
  }
  if (restaurant.trialEndsAt) {
    restaurantRows.push({ label: "Trial Ends", value: formatDate(restaurant.trialEndsAt) });
  }

  const detailRows: { label: string; value: string }[] = [];
  if (restaurant.description) detailRows.push({ label: "Description", value: restaurant.description });
  if (restaurant.address) detailRows.push({ label: "Address", value: restaurant.address });
  if (restaurant.phone) detailRows.push({ label: "Phone", value: restaurant.phone });
  if (restaurant.instagram) detailRows.push({ label: "Instagram", value: `@${restaurant.instagram}` });
  if (restaurant.whatsapp) detailRows.push({ label: "WhatsApp", value: restaurant.whatsapp });
  if (restaurant.languages.length > 0) detailRows.push({ label: "Languages", value: restaurant.languages.join(", ") });
  if (restaurant.reservationsEnabled) detailRows.push({ label: "Reservations", value: "Enabled" });

  const menuLink = restaurant.slug ? getMenuUrl(restaurant.slug) : null;
  const owner = restaurant.users.find((u) => u.isOwner) ?? restaurant.users[0];
  const ownerHandle = owner?.email.split("@")[0] ?? "";

  return (
    <>
      <div className="shrink-0 px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
        <button
          type="button"
          onClick={close}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0"
          title={onClose ? "Close" : "Back"}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {restaurantRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className="text-xs font-mono text-right break-all max-w-[60%] text-foreground">
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {restaurant.users.length > 0 ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {restaurant.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs break-all text-foreground">{user.email}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0 ml-3 tabular-nums">
                    {user.isOwner ? "owner" : "member"} · {formatDate(user.attachedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {detailRows.length > 0 ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {detailRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-mono text-right break-all max-w-[60%] text-foreground">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 px-5 py-3 border-t border-border flex items-center gap-2">
        {menuLink ? (
          <FooterIconButton title="View menu" onClick={() => setPreviewOpen(true)}>
            <ExternalLink className="h-4 w-4" />
          </FooterIconButton>
        ) : null}

        {owner ? (
          <FooterIconButton
            title={impersonating ? "Logging in…" : `Login as ${ownerHandle}`}
            onClick={handleImpersonate}
            disabled={impersonating}
          >
            <LogIn className="h-4 w-4" />
          </FooterIconButton>
        ) : null}

        <FooterIconButton title="Send email" onClick={() => setNested("email")}>
          <Mail className="h-4 w-4" />
        </FooterIconButton>

        <FooterIconButton
          title="Messages"
          onClick={() => setNested("messages")}
          badge={restaurant.messagesCount}
        >
          <MessageSquare className="h-4 w-4" />
        </FooterIconButton>

        <FooterIconButton
          title={restaurant.adminComment ? "Edit admin note" : "Add admin note"}
          onClick={openCommentModal}
        >
          <StickyNote
            className={
              "h-4 w-4 " + (restaurant.adminComment ? "text-amber-500" : "")
            }
          />
        </FooterIconButton>

        <FooterIconButton
          title="Delete restaurant"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </FooterIconButton>
      </div>

      {nested === "comment" ? (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => (savingComment ? null : setNested(null))}
        >
          <div
            className="w-full max-w-md bg-background border border-border rounded-2xl shadow-xl flex flex-col max-h-[85dvh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground truncate">Admin note</h3>
              <button
                type="button"
                onClick={() => (savingComment ? null : setNested(null))}
                disabled={savingComment}
                className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-60"
                title="Close"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Internal note — only visible to admins"
                autoFocus
                className="w-full min-h-[200px] bg-secondary border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-y outline-none focus:border-foreground/40"
              />
            </div>
            <div className="shrink-0 px-4 py-3 border-t border-border flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setNested(null)}
                disabled={savingComment}
                className="h-9 px-3 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveComment}
                disabled={savingComment}
                className="h-9 px-3 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-md inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {savingComment ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : null}
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {nested === "messages" ? (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setNested(null)}
        >
          <div
            className="w-full max-w-md bg-background border border-border rounded-2xl shadow-xl flex flex-col max-h-[85dvh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground truncate">Messages</h3>
              <button
                type="button"
                onClick={() => setNested(null)}
                className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0"
                title="Close"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div
              ref={scrollRef}
              className="overflow-y-auto p-4 space-y-3 flex-1 min-h-0"
            >
              {loadingMessages && messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                  Loading…
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                  No messages yet
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
              )}
            </div>

            <div className="shrink-0 px-3 pt-3 flex items-center gap-2 border-t border-border">
              <label className="text-xs text-muted-foreground">Lang</label>
              <Select<string>
                value={adminLocale}
                onChange={(next) => setAdminLocale(next)}
                className="!h-8 !w-24 !px-2 text-xs"
                options={[
                  { value: "", label: "Auto" },
                  ...ADMIN_LOCALES.map((l) => ({ value: l, label: l })),
                ]}
              />
            </div>
            <div className="shrink-0 flex items-start gap-2 p-3 border-t border-border">
              <textarea
                ref={taRef}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  autoresize(e.currentTarget);
                }}
                onKeyDown={handleKey}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 h-[40px] min-h-[40px] max-h-[70px] px-3 py-2 text-sm leading-5 text-foreground bg-card border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none transition-colors resize-none box-border"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="shrink-0 flex h-10 px-4 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors items-center justify-center gap-2"
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
      ) : null}

      {nested === "email" ? (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setNested(null)}
        >
          <div
            className="w-full max-w-md bg-background border border-border rounded-2xl shadow-xl flex flex-col max-h-[85dvh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground truncate">Send email</h3>
              <button
                type="button"
                onClick={() => setNested(null)}
                className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0"
                title="Close"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {EMAIL_TEMPLATES.map((tpl) => {
                const sentAt = owner?.emailsSent?.[tpl.id];
                const sentLabel = sentAt
                  ? `Sent ${new Date(sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : null;
                return (
                  <div key={tpl.id} className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{tpl.label}</div>
                      <div className="text-xs text-muted-foreground leading-snug mt-0.5">{tpl.description}</div>
                      {sentLabel ? (
                        <div className="text-[11px] text-emerald-600 mt-1">✓ {sentLabel}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmTemplate(tpl)}
                      disabled={sendingTemplate === tpl.id}
                      className="h-8 px-3 text-xs font-medium text-foreground bg-secondary border border-border rounded-md transition-colors shrink-0 disabled:opacity-60"
                    >
                      {sendingTemplate === tpl.id ? "Sending…" : sentAt ? "Resend" : "Send"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {confirmTemplate ? (
        <div
          onClick={() => (sendingTemplate ? null : setConfirmTemplate(null))}
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl"
          >
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">{`Send "${confirmTemplate.label}"?`}</h3>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-sm text-muted-foreground leading-snug">
                Sends the email to {owner?.email ?? "owner"}.
              </p>
              <label className="block text-xs font-medium text-foreground">
                Language
                <div className="mt-1">
                  <Select<string>
                    value={adminLocale}
                    onChange={(next) => setAdminLocale(next)}
                    options={[
                      { value: "", label: "Auto (user preference)" },
                      ...ADMIN_LOCALES.map((l) => ({ value: l, label: l })),
                    ]}
                  />
                </div>
              </label>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmTemplate(null)}
                disabled={!!sendingTemplate}
                className="h-9 px-3 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => sendEmailTemplate(confirmTemplate)}
                disabled={!!sendingTemplate}
                className="h-9 px-3 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-md inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {sendingTemplate ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : null}
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {alert ? (
        <div
          onClick={() => setAlert(null)}
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl"
          >
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">{alert.title}</h3>
            </div>
            <p className="px-4 py-3 text-sm text-muted-foreground leading-snug">{alert.message}</p>
            <div className="px-4 py-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setAlert(null)}
                className="h-9 px-3 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-md"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {menuLink ? (
        <MenuPreviewModal menuUrl={menuLink} open={previewOpen} onOpenChange={setPreviewOpen} />
      ) : null}

      {confirmDelete ? (
        <div
          onClick={() => (deleting ? null : setConfirmDelete(false))}
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl"
          >
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Delete restaurant</h3>
            </div>
            <p className="px-4 py-3 text-sm text-muted-foreground leading-snug">
              Delete {restaurant.title || "this restaurant"}? This removes the restaurant, its menu, orders and chat history. Cannot be undone.
            </p>
            <div className="px-4 py-3 border-t border-border flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="h-9 px-3 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void applyDelete()}
                disabled={deleting}
                className="h-9 px-3 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 inline-flex items-center gap-2 disabled:opacity-60"
              >
                {deleting ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FooterIconButton({
  title,
  onClick,
  disabled,
  badge,
  variant = "default",
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: number;
  variant?: "default" | "danger";
  children: React.ReactNode;
}) {
  const base =
    "relative h-9 w-9 inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-50";
  const cls =
    variant === "danger"
      ? `${base} bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40`
      : `${base} bg-secondary text-muted-foreground hover:text-foreground`;
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls}>
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-primary-gradient text-primary-foreground text-[10px] font-semibold tabular-nums">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isAdmin = message.isAdmin;
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const cls = isAdmin
    ? "bg-primary-gradient text-primary-foreground rounded-tr-sm"
    : "bg-secondary text-foreground rounded-tl-sm";

  return (
    <div className={"flex " + (isAdmin ? "justify-end" : "justify-start")}>
      <div className="max-w-[75%]">
        <div
          className={
            "px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words " + cls
          }
        >
          {!isAdmin ? (
            <div className="text-[10px] font-medium mb-1 opacity-70">{message.user.email}</div>
          ) : null}
          {message.message}
        </div>
        <div className={"text-[10px] text-muted-foreground mt-1 px-1 " + (isAdmin ? "text-right" : "text-left")}>
          {time}
        </div>
      </div>
    </div>
  );
}
