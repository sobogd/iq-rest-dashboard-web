"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useRestaurants } from "./restaurants-context";
import { Modal, SubpageStickyBar } from "./ui";
import { CheckIcon, PlusIcon } from "./icons";
import { createRestaurant, deleteRestaurant, previewRestaurantSlug } from "./api";
import { useDashboardRouter } from "../_spa/router";
import { track } from "@/lib/dashboard-events";

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "rest";
}

function ModeCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`group relative text-left p-4 rounded-xl border-2 transition-all ${
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-foreground/30 hover:bg-secondary/30"
      }`}
    >
      <div
        className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
          active
            ? "bg-primary-gradient text-primary-foreground scale-100"
            : "bg-transparent border-2 border-border scale-90"
        }`}
      >
        {active && <CheckIcon size={12} className="text-primary-foreground" />}
      </div>
      <div className="pr-7">
        <div className="text-sm font-semibold text-foreground leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground leading-snug mt-1.5">{desc}</div>
      </div>
    </button>
  );
}

export function RestaurantsListPage({ onBack, isDemo = false }: { onBack: () => void; isDemo?: boolean }) {
  const t = useTranslations("dashboard.restaurants");
  const tc = useTranslations("dashboard.common");
  const { list, activeId, isPaid, switching, setActive, refresh } = useRestaurants();
  const router = useDashboardRouter();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // Demo accounts can't add restaurants — record that one reached the place
  // where the "+ Add restaurant" button would be (upsell-intent signal).
  useEffect(() => {
    if (isDemo) track("dash_restaurants_add_blocked_demo");
  }, [isDemo]);

  const onSwitch = async (id: string) => {
    if (id === activeId || switching) return;
    await setActive(id).catch(() => undefined);
    router.resetTo({ name: "menu" });
  };

  const askDelete = (id: string, name: string) => {
    if (list.length <= 1) return;
    setPendingDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    const { id } = pendingDelete;
    setDeleting(true);
    try {
      await deleteRestaurant(id);
      if (id === activeId) {
        const next = list.find((r) => r.id !== id);
        if (next) await setActive(next.id);
      }
      await refresh();
      setPendingDelete(null);
    } catch {
      // surface failure via the modal staying open + button re-enabling
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <SubpageStickyBar onBack={onBack} hideSave />
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4">
        <div className="mb-5">
          <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
          <p className="text-[13px] text-muted-foreground leading-snug mt-1">{t("subtitle")}</p>
        </div>

        <div className="space-y-2.5">
          {list.map((r) => {
            const isActive = r.id === activeId;
            return (
              <div
                key={r.id}
                className={`w-full p-4 bg-card border rounded-xl flex items-center justify-between gap-3 ${
                  isActive ? "border-primary" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSwitch(r.id)}
                  disabled={switching || isActive}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="text-sm font-medium text-foreground flex items-center gap-2">
                    {r.title || r.slug || r.id}
                    {isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-wide">
                        {t("active")}
                      </span>
                    )}
                    {r.owned === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wide">
                        {t("managed")}
                      </span>
                    )}
                  </div>
                  {r.slug && (
                    <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                      {r.slug}.iq-rest.com
                    </div>
                  )}
                </button>
                {list.length > 1 && isPaid && !isActive && r.owned !== false && (
                  <button
                    type="button"
                    onClick={() => askDelete(r.id, r.title)}
                    className="text-xs text-red-600 hover:text-red-700 px-2 py-1"
                  >
                    {t("delete")}
                  </button>
                )}
              </div>
            );
          })}

          {/* Demo accounts can't create restaurants — hide the add affordance
              entirely (the route is also guarded in RestaurantNewPage). */}
          {isDemo ? null : isPaid ? (
            <button
              type="button"
              onClick={() => {
                track("dash_restaurant_add_click");
                router.push({ name: "settings.restaurants.new" });
              }}
              className="w-full mt-2.5 h-11 text-sm font-medium text-muted-foreground/60 border border-dashed border-input rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <PlusIcon size={14} />
              {t("add")}
            </button>
          ) : (
            <div className="p-4 bg-secondary/50 border border-border rounded-xl text-xs text-muted-foreground">
              {t("paidOnly")}
            </div>
          )}
        </div>
      </div>
      <Modal
        open={!!pendingDelete}
        onClose={() => { if (!deleting) setPendingDelete(null); }}
        title={t("deleteTitle")}
        subtitle={pendingDelete ? t("deleteMessage", { name: pendingDelete.name }) : ""}
        size="sm"
        closeOnBackdrop={!deleting}
        footer={
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
              className="h-8 px-3 text-xs font-medium text-foreground bg-card border border-border rounded-lg transition-colors disabled:opacity-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="h-8 px-3 text-xs font-medium text-white bg-red-600 rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-70"
            >
              {deleting ? (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : null}
              {t("delete")}
            </button>
          </div>
        }
      />
      {switching ? (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-[3px] border-input border-t-foreground rounded-full animate-spin" />
            <div className="text-xs text-muted-foreground">{t("switching")}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RestaurantNewPage({ onBack, isDemo = false }: { onBack: () => void; isDemo?: boolean }) {
  const t = useTranslations("dashboard.restaurants");
  const router = useDashboardRouter();
  const qc = useQueryClient();
  const { list, activeId, refresh } = useRestaurants();
  const current = list.find((r) => r.id === activeId);

  const [name, setName] = useState("");
  const [mode, setMode] = useState<"duplicate" | "blank">("duplicate");
  const [submitting, setSubmitting] = useState(false);
  // Server-resolved slug (with incremental suffix on collision). Empty while
  // the debounced request is in flight — UI shows a spinner instead.
  const [serverSlug, setServerSlug] = useState<string>("");
  const [slugLoading, setSlugLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // Demo accounts can't create restaurants. If one reaches this page by URL,
  // bounce back to the list (the server also 403s the create call).
  useEffect(() => {
    if (isDemo) router.push({ name: "settings.restaurants" });
  }, [isDemo, router]);
  if (isDemo) return null;

  // Debounce slug-preview API calls. Loading flag flips on the first keystroke
  // and back off only when the server responds (or the field is cleared).
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setServerSlug("");
      setSlugLoading(false);
      return;
    }
    setSlugLoading(true);
    const ctl = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const slug = await previewRestaurantSlug(trimmed);
        if (!ctl.signal.aborted) {
          setServerSlug(slug);
          setSlugLoading(false);
        }
      } catch {
        if (!ctl.signal.aborted) setSlugLoading(false);
      }
    }, 400);
    return () => {
      ctl.abort();
      window.clearTimeout(handle);
    };
  }, [name]);

  const canSave = name.trim().length > 0;

  const submit = async () => {
    if (!canSave || submitting) return;
    setSubmitting(true);
    try {
      await createRestaurant({
        name: name.trim(),
        duplicateFromId: mode === "duplicate" && current ? current.id : null,
      });
      track(mode === "duplicate" ? "dash_restaurant_create_duplicate" : "dash_restaurant_create_blank");
      // Backend set cookie + auto-switched active restaurant. Invalidate every
      // restaurant-scoped query so subsequent fetches use the new id, then
      // refetch the restaurants list and navigate back to it.
      await qc.invalidateQueries({
        predicate: (q) => !(Array.isArray(q.queryKey) && q.queryKey[0] === "restaurants"),
      });
      await refresh();
      router.push({ name: "settings.restaurants" });
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <SubpageStickyBar onBack={onBack} onSave={submit} canSave={canSave} />
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4">
        <div className="mb-5">
          <h2 className="text-xl font-medium text-foreground">{t("newTitle")}</h2>
          <p className="text-[13px] text-muted-foreground leading-snug mt-1">{t("newSubtitle")}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          <fieldset>
            <legend className="text-sm font-medium text-foreground mb-2">{t("startFrom")}</legend>
            <div role="radiogroup" className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ModeCard
                active={mode === "duplicate"}
                onClick={() => setMode("duplicate")}
                title={t("duplicate")}
                desc={t("duplicateDesc")}
              />
              <ModeCard
                active={mode === "blank"}
                onClick={() => setMode("blank")}
                title={t("blank")}
                desc={t("blankDesc")}
              />
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="r-name" className="text-sm font-medium text-foreground">
              {t("name")}
            </label>
            <input
              id="r-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary"
              required
              maxLength={120}
            />
            {name.trim() && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>{t("slugPreview")}:</span>
                {slugLoading || !serverSlug ? (
                  <span
                    className="inline-block w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin"
                    aria-label="loading"
                  />
                ) : (
                  <span>{serverSlug}.iq-rest.com</span>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
