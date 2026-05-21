"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useRestaurants } from "./restaurants-context";
import { ConfirmDialog, SubpageStickyBar } from "./ui";
import { ChevronRightIcon, CheckIcon } from "./icons";
import { createRestaurant, deleteRestaurant, previewRestaurantSlug } from "./api";
import { useDashboardRouter } from "../_spa/router";

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
            ? "bg-primary text-primary-foreground scale-100"
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

export function RestaurantsListPage({ onBack }: { onBack: () => void }) {
  const t = useTranslations("dashboard.restaurants");
  const { list, activeId, isPaid, switching, setActive, refresh } = useRestaurants();
  const router = useDashboardRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const onSwitch = async (id: string) => {
    if (id === activeId || switching) return;
    try {
      await setActive(id);
      router.resetTo({ name: "menu" });
    } catch (err) {
      toast.error((err as Error).message || t("switched"));
    }
  };

  const askDelete = (id: string, name: string) => {
    if (list.length <= 1) return;
    setPendingDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    setBusyId(id);
    try {
      await deleteRestaurant(id);
      if (id === activeId) {
        const next = list.find((r) => r.id !== id);
        if (next) await setActive(next.id);
      }
      await refresh();
      toast.success(t("deleted"));
    } catch (err) {
      toast.error((err as Error).message || t("deleted"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <SubpageStickyBar onBack={onBack} hideSave />
      <div className="max-w-2xl mx-auto pt-5 md:pt-4">
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
                  </div>
                  {r.slug && (
                    <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                      {r.slug}.iq-rest.com
                    </div>
                  )}
                </button>
                {list.length > 1 && isPaid && !isActive && (
                  <button
                    type="button"
                    onClick={() => askDelete(r.id, r.title)}
                    disabled={busyId === r.id}
                    className="text-xs text-red-600 hover:text-red-700 px-2 py-1 disabled:opacity-50"
                  >
                    {t("delete")}
                  </button>
                )}
              </div>
            );
          })}

          {isPaid ? (
            <button
              type="button"
              onClick={() => router.push({ name: "settings.restaurants.new" })}
              className="w-full text-left p-4 bg-card border border-dashed border-border rounded-xl flex items-center justify-between gap-3 hover:border-primary transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">+ {t("add")}</div>
                <div className="text-xs text-muted-foreground leading-snug mt-0.5">{t("addDesc")}</div>
              </div>
              <ChevronRightIcon size={16} className="text-muted-foreground shrink-0" />
            </button>
          ) : (
            <div className="p-4 bg-secondary/50 border border-border rounded-xl text-xs text-muted-foreground">
              {t("paidOnly")}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!pendingDelete}
        title={t("deleteTitle")}
        message={pendingDelete ? t("deleteMessage", { name: pendingDelete.name }) : ""}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        confirmLabel={t("delete")}
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

export function RestaurantNewPage({ onBack }: { onBack: () => void }) {
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
      // Backend set cookie + auto-switched active restaurant. Invalidate every
      // restaurant-scoped query so subsequent fetches use the new id, then
      // refetch the restaurants list and navigate back to it.
      await qc.invalidateQueries({
        predicate: (q) => !(Array.isArray(q.queryKey) && q.queryKey[0] === "restaurants"),
      });
      await refresh();
      toast.success(t("created"));
      router.push({ name: "settings.restaurants" });
    } catch (err) {
      toast.error((err as Error).message || t("created"));
      setSubmitting(false);
    }
  };

  return (
    <div>
      <SubpageStickyBar onBack={onBack} onSave={submit} canSave={canSave} />
      <div className="max-w-2xl mx-auto pt-5 md:pt-4">
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
