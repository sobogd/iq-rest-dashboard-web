"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { ConfirmDialog, SubpageStickyBar } from "../_v2/ui";
import { SendIcon } from "../_v2/icons";
import { MenuPreviewModal } from "@/components/menu-preview-modal";
import { getMenuUrl } from "@/lib/menu-url";
import { useDashboardRouter } from "../_spa/router";
import { UsageEventsTable } from "./usage-events-table";

interface User {
  id: string;
  email: string;
  createdAt: string;
  role: string;
}

interface Restaurant {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  accentColor: string;
  createdAt: string;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  whatsapp: string | null;
  reservationsEnabled: boolean;
  defaultLanguage: string | null;
  languages: string[];
  url: string | null;
}

interface Company {
  id: string;
  name: string;
  createdAt: string;
  plan: string;
  subscriptionStatus: string;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  categoriesCount: number;
  itemsCount: number;
  messagesCount: number;
  monthlyViews: number;
  scanLimit: number;
  users: User[];
  restaurants: Restaurant[];
  emailsSent: Record<string, string> | null;
}

interface EmailTemplate {
  id: string;
  label: string;
  description: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome_personal",
    label: "Personal welcome from Bogdan",
    description: "Friendly intro offering setup help. Sent in owner's preferred language.",
  },
];

interface Message {
  id: string;
  message: string;
  isAdmin: boolean;
  createdAt: string;
  user: { email: string };
}

type Tab = "info" | "messages" | "events";

interface Props {
  companyId: string;
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

export function AdminCompanyPage({ companyId, onClose }: Props) {
  const router = useDashboardRouter();
  const goBack = () => {
    if (onClose) onClose();
    else router.push({ name: "settings.admin.companies" });
  };

  const [tab, setTab] = useState<Tab>("info");
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);
  const [confirmTemplate, setConfirmTemplate] = useState<EmailTemplate | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/admin/companies/${companyId}`), { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) setError("Access denied");
        else if (res.status === 404) setError("Company not found");
        else setError("Failed to load");
        return;
      }
      const data = await res.json();
      setCompany(data);
      setError(null);
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/companies/${companyId}/messages`), { credentials: "include" });
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
  }, [companyId]);

  useEffect(() => {
    if (tab === "messages" && messages.length === 0) {
      fetchMessages();
    }
  }, [tab, messages.length, fetchMessages]);

  useEffect(() => {
    if (tab !== "messages") return;
    const id = setInterval(() => {
      fetchMessages(true);
    }, 15000);
    return () => clearInterval(id);
  }, [tab, fetchMessages]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.id !== lastIdRef.current) {
      lastIdRef.current = lastMsg.id;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages]);

  async function handleDelete() {
    if (!company) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/companies/${company.id}`), {
        credentials: "include", method: "DELETE" });
      if (res.ok) {
        router.push({ name: "settings.admin.companies" });
      } else {
        const data = await res.json().catch(() => ({}));
        setAlert({ title: "Delete failed", message: data.error || "Could not delete company." });
      }
    } catch {
      setAlert({ title: "Delete failed", message: "Network error" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleImpersonate() {
    if (!company || impersonating) return;
    const user = company.users[0];
    if (!user) return;
    setImpersonating(true);
    try {
      const res = await fetch(apiUrl("/api/admin/impersonate"), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        // Full reload so all queries (auth, restaurant, etc.) re-fetch with the
        // target user's session cookies.
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
    if (sendingTemplate) return;
    setSendingTemplate(tpl.id);
    try {
      const res = await fetch(apiUrl(`/api/admin/companies/${companyId}/send-email`), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: tpl.id }),
      });
      if (res.ok) {
        const j = await res.json();
        // Optimistic update
        setCompany((prev) =>
          prev
            ? {
                ...prev,
                emailsSent: { ...(prev.emailsSent || {}), [tpl.id]: j.sentAt },
              }
            : prev,
        );
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
      const res = await fetch(apiUrl(`/api/admin/companies/${companyId}/messages`), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
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

  if (loading && !company) {
    return (
      <div>
        <SubpageStickyBar onBack={() => goBack()} hideSave />
        <div className="max-w-2xl mx-auto pt-5 md:pt-4">
          <div className="mb-5">
            <div className="text-xs text-muted-foreground">Settings / Companies</div>
            <h2 className="text-xl font-medium text-foreground mt-1">Company</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div>
        <SubpageStickyBar onBack={() => goBack()} hideSave />
        <div className="max-w-2xl mx-auto pt-5 md:pt-4">
          <div className="mb-5">
            <div className="text-xs text-muted-foreground">Settings / Companies</div>
            <h2 className="text-xl font-medium text-foreground mt-1">Company</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            {error || "Not found"}
          </div>
        </div>
      </div>
    );
  }

  const restaurant = company.restaurants[0];
  const title = restaurant?.title || company.name || "No name";

  const companyRows: { label: string; value: string }[] = [
    { label: "Plan", value: `${company.plan}${company.subscriptionStatus === "ACTIVE" ? " (Active)" : ""}` },
    { label: "Created", value: formatDate(company.createdAt, true) },
    { label: "Categories", value: String(company.categoriesCount) },
    { label: "Items", value: String(company.itemsCount) },
    {
      label: "Monthly Views",
      value: `${company.monthlyViews} / ${company.plan === "FREE" ? String(company.scanLimit) : "∞"}`,
    },
    { label: "Restaurants", value: String(company.restaurants.length) },
  ];

  if (company.plan !== "FREE") {
    if (company.billingCycle) companyRows.push({ label: "Billing", value: company.billingCycle });
    if (company.currentPeriodEnd) companyRows.push({ label: "Period Ends", value: formatDate(company.currentPeriodEnd) });
    if (company.stripeCustomerId) companyRows.push({ label: "Stripe Customer", value: company.stripeCustomerId });
  }

  const restaurantRows: { label: string; value: string }[] = [];
  if (restaurant) {
    if (restaurant.url) restaurantRows.push({ label: "URL", value: restaurant.url });
    if (restaurant.description) restaurantRows.push({ label: "Description", value: restaurant.description });
    if (restaurant.address) restaurantRows.push({ label: "Address", value: restaurant.address });
    if (restaurant.phone) restaurantRows.push({ label: "Phone", value: restaurant.phone });
    if (restaurant.instagram) restaurantRows.push({ label: "Instagram", value: `@${restaurant.instagram}` });
    if (restaurant.whatsapp) restaurantRows.push({ label: "WhatsApp", value: restaurant.whatsapp });
    if (restaurant.languages.length > 0) restaurantRows.push({ label: "Languages", value: restaurant.languages.join(", ") });
    if (restaurant.reservationsEnabled) restaurantRows.push({ label: "Reservations", value: "Enabled" });
  }

  const menuLink = restaurant?.slug ? getMenuUrl(restaurant.slug) : null;


  return (
    <div className={tab === "messages" ? "flex flex-col h-[calc(100dvh-var(--topbar-h,0px)-116px)] md:h-[calc(100dvh-var(--topbar-h,0px)-56px)]" : ""}>
      <SubpageStickyBar onBack={() => goBack()} hideSave>
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-secondary rounded-lg">
          <button
            type="button"
            onClick={() => setTab("info")}
            className={
              "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors " +
              (tab === "info" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
            }
          >
            Info
          </button>
          <button
            type="button"
            onClick={() => setTab("messages")}
            className={
              "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors " +
              (tab === "messages" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
            }
          >
            Messages
            {company.messagesCount > 0 ? (
              <span className="ml-1 opacity-70">({company.messagesCount})</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab("events")}
            className={
              "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors " +
              (tab === "events" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
            }
          >
            Events
          </button>
        </div>
      </SubpageStickyBar>
      <div
        className={
          "max-w-2xl mx-auto w-full pt-5 md:pt-4 " +
          (tab === "messages" ? "flex-1 flex flex-col min-h-0" : "")
        }
      >
        <div className={tab === "messages" ? "mb-3 shrink-0" : "mb-5"}>
          <div className="text-xs text-muted-foreground">Settings / Companies</div>
          <h2 className="text-xl font-medium text-foreground mt-1">{title}</h2>
        </div>

      {tab === "info" ? (
        <div className="space-y-4">
          {/* Company info */}
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {companyRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className="text-xs font-mono text-right break-all max-w-[60%] text-foreground">
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Users */}
          {company.users.length > 0 ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {company.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs break-all text-foreground">{user.email}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0 ml-3 tabular-nums">
                    {user.role} · {formatDate(user.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Restaurant */}
          {restaurantRows.length > 0 ? (
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
          ) : null}

          {/* Action buttons */}
          <div className="space-y-2">
            {menuLink ? (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="w-full h-10 px-4 text-sm font-medium text-foreground bg-card border border-border rounded-lg transition-colors flex items-center justify-center"
              >
                View Menu
              </button>
            ) : null}

            {company.users[0] ? (
              <button
                type="button"
                onClick={handleImpersonate}
                disabled={impersonating}
                className="w-full h-10 px-4 text-sm font-medium text-foreground bg-card border border-border rounded-lg transition-colors disabled:opacity-60"
              >
                {impersonating ? "Logging in…" : `Login as ${company.users[0].email.split("@")[0]}`}
              </button>
            ) : null}

            {/* Email templates */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email templates
              </div>
              {EMAIL_TEMPLATES.map((tpl) => {
                const sentAt = company.emailsSent?.[tpl.id];
                const sentLabel = sentAt
                  ? `Sent ${new Date(sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : null;
                return (
                  <div key={tpl.id} className="flex items-center justify-between gap-3">
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

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full h-10 px-4 text-sm font-medium text-white bg-red-600 rounded-lg transition-colors"
            >
              Delete company
            </button>
          </div>
        </div>
      ) : tab === "events" ? (
        <UsageEventsTable companyId={companyId} />
      ) : (
        <>
          <div
            ref={scrollRef}
            className="bg-card border border-border rounded-2xl overflow-y-auto p-4 space-y-3 flex-1 min-h-0"
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

          <div className="mt-3 shrink-0 flex items-start gap-2 h-[70px]">
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
              className="shrink-0 flex h-10 px-4 text-sm font-medium text-primary-foreground bg-primary rounded-lg transition-colors items-center justify-center gap-2"
            >
              {sending ? (
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <SendIcon size={14} />
              )}
              Send message
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete company?"
        message={
          `This permanently deletes ${company.restaurants.length} restaurant(s), ` +
          `${company.categoriesCount} categories, ${company.itemsCount} items, ` +
          `${company.users.length} user(s), and all related data. Cannot be undone.`
        }
        confirmLabel="Delete"
        onCancel={() => (deleting ? null : setConfirmDelete(false))}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={confirmTemplate !== null}
        title={`Send "${confirmTemplate?.label}"?`}
        message={
          confirmTemplate
            ? `Sends the email to ${company.users[0]?.email ?? "owner"} in their preferred language.`
            : ""
        }
        confirmLabel="Send"
        onCancel={() => (sendingTemplate ? null : setConfirmTemplate(null))}
        onConfirm={() => confirmTemplate && sendEmailTemplate(confirmTemplate)}
      />

      <ConfirmDialog
        open={alert !== null}
        singleButton
        title={alert?.title}
        message={alert?.message}
        onCancel={() => setAlert(null)}
      />

      {menuLink ? (
        <MenuPreviewModal menuUrl={menuLink} open={previewOpen} onOpenChange={setPreviewOpen} />
      ) : null}
      </div>
    </div>
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
    ? "bg-primary text-primary-foreground rounded-tr-sm"
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
