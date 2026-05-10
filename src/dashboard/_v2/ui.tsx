"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { apiUrl } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
 CheckIcon,
 CloseIcon,
 CopyIcon,
 DownloadIcon,
 ExternalLinkIcon,
 EyeIcon,
 ShareIcon,
 SparklesIcon,
} from "./icons";
import { inputClass, labelClass, primaryBtn, secondaryBtn } from "./tokens";
import { getMl, setMl, translateText } from "./i18n";
import { useAiImageAccess } from "./sub-context";
import type { Ml } from "./types";
import { MenuPreviewModal } from "@/components/menu-preview-modal";
import { track } from "@/lib/dashboard-events";
import { QRCodeCanvas } from "qrcode.react";

// Modal — Escape closes, body scroll lock while open.

export function Modal({
 open,
 onClose,
 title,
 children,
 size = "md",
 footer,
}: {
 open: boolean;
 onClose: () => void;
 title: string;
 children: ReactNode;
 size?: "sm" | "md" | "lg";
 footer?: ReactNode;
}) {
 useEffect(() => {
 if (!open) return;
 function onKey(e: KeyboardEvent) {
 if (e.key === "Escape") onClose();
 }
 window.addEventListener("keydown", onKey);
 return () => window.removeEventListener("keydown", onKey);
 }, [open, onClose]);

 useEffect(() => {
 if (!open) return;
 const prev = document.body.style.overflow;
 document.body.style.overflow = "hidden";
 return () => {
 document.body.style.overflow = prev;
 };
 }, [open]);

 const tc = useTranslations("dashboard.common");
 if (!open) return null;

 const widthCls =
 size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4 bg-black/50 backdrop-blur-sm">
 <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
 <div
 className={
 "relative w-full " +
 widthCls +
 " bg-card border border-border rounded-2xl max-h-[92vh] flex flex-col"
 }
 >
 <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
 <h3 className="text-base font-medium text-foreground truncate">{title}</h3>
 <button
 type="button"
 onClick={onClose}
 className="w-8 h-8 -mr-2 flex items-center justify-center rounded-md text-muted-foreground transition-colors"
 aria-label={tc("close")}
 >
 <CloseIcon size={16} />
 </button>
 </div>
 <div className="flex-1 overflow-y-auto p-5">{children}</div>
 {footer ? (
 <div className="px-5 py-3 border-t border-border shrink-0">{footer}</div>
 ) : null}
 </div>
 </div>
 );
}

// ConfirmDialog — destructive by default. singleButton turns it into a one-button alert.

export function ConfirmDialog({
 open,
 title,
 message,
 onConfirm,
 onCancel,
 confirmLabel,
 confirmStyle,
 singleButton,
}: {
 open: boolean;
 title?: string;
 message?: string;
 onConfirm?: () => void;
 onCancel: () => void;
 confirmLabel?: string;
 confirmStyle?: "danger" | "primary";
 singleButton?: boolean;
}) {
 const tc = useTranslations("dashboard.common");
 const label = confirmLabel || (singleButton ? tc("ok") : tc("delete"));
 const isDanger = !singleButton && (!confirmStyle || confirmStyle === "danger");
 const confirmCls = isDanger
 ? "h-10 px-4 text-sm font-medium text-white bg-red-600 rounded-lg transition-colors"
 : "h-10 px-4 text-sm font-medium text-background bg-foreground rounded-lg transition-colors";

 return (
 <Modal open={open} onClose={onCancel} title={title || tc("confirm")} size="sm">
 <p className="text-sm text-muted-foreground leading-snug mb-5">{message}</p>
 <div className="flex gap-2.5 justify-end">
 {!singleButton ? (
 <button type="button" onClick={onCancel} className={secondaryBtn}>
 {tc("cancel")}
 </button>
 ) : null}
 <button
 type="button"
 onClick={singleButton ? onCancel : onConfirm}
 className={confirmCls}
 >
 {label}
 </button>
 </div>
 </Modal>
 );
}

// ToggleSwitch.

export function ToggleSwitch({
 checked,
 onChange,
}: {
 checked: boolean;
 onChange: () => void;
}) {
 return (
 <button
 type="button"
 role="switch"
 aria-checked={checked}
 onClick={onChange}
 className={
 "shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
 (checked ? "bg-foreground" : "bg-input")
 }
 >
 <span
 className={
 "inline-block h-4 w-4 transform rounded-full bg-background transition-transform " +
 (checked ? "translate-x-6" : "translate-x-1")
 }
 />
 </button>
 );
}

// LanguageSwitcher — pill tabs, only the languages enabled on the restaurant.

interface MiniLang {
 code: string;
 short: string;
 label: string;
}

export function LanguageSwitcher({
 lang,
 onChange,
 languages,
 onOpen,
 onSelect,
}: {
 lang: string;
 onChange: (code: string) => void;
 languages: MiniLang[];
 onOpen?: () => void;
 onSelect?: () => void;
}) {
 const [open, setOpen] = useState(false);
 const ref = useRef<HTMLDivElement | null>(null);

 useEffect(() => {
 if (!open) return;
 function onDocClick(e: MouseEvent) {
 if (!ref.current) return;
 if (!ref.current.contains(e.target as Node)) setOpen(false);
 }
 function onEsc(e: KeyboardEvent) {
 if (e.key === "Escape") setOpen(false);
 }
 document.addEventListener("mousedown", onDocClick);
 document.addEventListener("keydown", onEsc);
 return () => {
 document.removeEventListener("mousedown", onDocClick);
 document.removeEventListener("keydown", onEsc);
 };
 }, [open]);

 if (languages.length <= 1) return null;
 const active = languages.find((l) => l.code === lang) || languages[0];

 return (
 <div ref={ref} className="relative">
 <button
 type="button"
 onClick={() => {
 setOpen((v) => {
 if (!v) onOpen?.();
 return !v;
 });
 }}
 className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium bg-secondary text-foreground rounded-md transition-colors"
 title={active.label}
 aria-haspopup="listbox"
 aria-expanded={open}
 >
 <span className="uppercase">{active.short}</span>
 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="6 9 12 15 18 9" />
 </svg>
 </button>
 {open ? (
 <div
 role="listbox"
 className="absolute right-0 mt-1 z-20 min-w-[180px] max-h-64 overflow-y-auto bg-card border border-border rounded-lg shadow-lg py-1"
 >
 {languages.map((l) => {
 const isActive = l.code === lang;
 return (
 <button
 key={l.code}
 type="button"
 role="option"
 aria-selected={isActive}
 onClick={() => {
 onSelect?.();
 onChange(l.code);
 setOpen(false);
 }}
 className={
 "w-full flex items-center justify-between gap-3 px-3 h-8 text-[12px] text-left transition-colors " +
 (isActive ? "text-foreground" : "text-muted-foreground")
 }
 >
 <span className="truncate">{l.label}</span>
 <span className="uppercase text-[10px] tabular-nums shrink-0">{l.short}</span>
 </button>
 );
 })}
 </div>
 ) : null}
 </div>
 );
}

// AiTranslateButton — invoked from within TranslatedInput when not on default lang.

function AiTranslateButton({
 value,
 lang,
 defaultLang,
 languages,
 onChange,
 disabled,
 inline,
}: {
 value: Ml;
 lang: string;
 defaultLang: string;
 languages: string[];
 onChange: (next: Ml) => void;
 disabled?: boolean;
 inline?: boolean;
}) {
 const [translating, setTranslating] = useState(false);
 const [confirmReplace, setConfirmReplace] = useState(false);
 const tc = useTranslations("dashboard.common");
 const ta = useTranslations("dashboard.ai");

 if (lang === defaultLang) return null;

 const current = getMl(value, lang);
 const sourceText = (() => {
 const def = getMl(value, defaultLang);
 if (def) return { text: def, fromLang: defaultLang };
 for (const code of languages) {
 const v = getMl(value, code);
 if (v && code !== lang) return { text: v, fromLang: code };
 }
 return null;
 })();

 const canTranslate = !!sourceText && !translating && !disabled;

 async function doTranslate() {
 if (!canTranslate || !sourceText) return;
 setTranslating(true);
 try {
 const translated = await translateText(sourceText.text, sourceText.fromLang, lang);
 onChange(setMl(value, lang, translated));
 } catch {
 // Silent fail; the user can retry.
 } finally {
 setTranslating(false);
 }
 }

 function handleClick() {
 if (current.trim().length > 0) {
 setConfirmReplace(true);
 } else {
 doTranslate();
 }
 }

 const inlineCls =
 "flex items-center justify-center w-9 h-10 rounded-lg text-muted-foreground transition-colors disabled:text-muted-foreground/50 disabled:cursor-not-allowed shrink-0";
 const linkCls =
 "inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors disabled:text-muted-foreground/50 disabled:cursor-not-allowed";

 return (
 <>
 <button
 type="button"
 onClick={handleClick}
 disabled={!canTranslate}
 className={inline ? inlineCls : linkCls}
 aria-label={tc("translateWithAi")}
 title={inline && translating ? tc("translating") : (inline ? tc("translateWithAi") : undefined)}
 >
 {translating ? (
 <div className="w-3 h-3 border-2 border-input border-t-neutral-900 rounded-full animate-spin" />
 ) : (
 <SparklesIcon size={inline ? 14 : 11} />
 )}
 {!inline ? (translating ? tc("translating") : tc("translate")) : null}
 </button>

 <ConfirmDialog
 open={confirmReplace}
 title={ta("translateReplaceTitle")}
 message={ta("translateReplaceMessage")}
 confirmLabel={tc("replace")}
 confirmStyle="primary"
 onConfirm={() => {
 setConfirmReplace(false);
 doTranslate();
 }}
 onCancel={() => setConfirmReplace(false)}
 />
 </>
 );
}

// Textarea that grows to fit its content. Starts at the height of a regular
// input (h-10) and expands one line at a time. On md+ it keeps a min height
// matching the dish photo column so the form stays balanced.
function AutoGrowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
 const ref = useRef<HTMLTextAreaElement | null>(null);

 useEffect(() => {
 const el = ref.current;
 if (!el) return;
 el.style.height = "auto";
 el.style.height = el.scrollHeight + "px";
 }, [props.value]);

 const baseCls = inputClass + " h-10 py-2 resize-none overflow-hidden";
 return (
 <textarea
 {...props}
 ref={ref}
 rows={1}
 className={baseCls + (props.className ? " " + props.className : "")}
 />
 );
}

// TranslatedInput — text/textarea bound to a multilingual field.

export function TranslatedInput({
 id,
 label,
 value,
 lang,
 defaultLang,
 languages,
 onChange,
 placeholder,
 type = "text",
 multiline,
 hint,
 translatable = true,
 onFocus,
}: {
 id: string;
 label?: string;
 value: Ml;
 lang: string;
 defaultLang: string;
 languages: string[];
 onChange: (next: Ml) => void;
 placeholder?: string;
 type?: string;
 multiline?: boolean;
 hint?: string;
 translatable?: boolean;
 onFocus?: () => void;
}) {
 const current = getMl(value, lang);
 const fallback = lang !== defaultLang ? getMl(value, defaultLang) : "";
 const showFallback = lang !== defaultLang && !current && fallback;

 const showTranslate = translatable && lang !== defaultLang;

 const tc = useTranslations("dashboard.common");
 const inputProps = {
 id,
 value: current,
 onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
 onChange(setMl(value, lang, e.target.value)),
 onFocus,
 placeholder: showFallback ? tc("willUse") + ": " + fallback : (placeholder || ""),
 className: inputClass,
 };

 return (
 <div>
 {(label || showTranslate) ? (
 <div className="flex items-center justify-between gap-2 mb-2.5">
 {label ? (
 <label htmlFor={id} className="block text-sm font-medium text-foreground">
 {label}
 </label>
 ) : (
 <span />
 )}
 {showTranslate ? (
 <AiTranslateButton
 value={value}
 lang={lang}
 defaultLang={defaultLang}
 languages={languages}
 onChange={onChange}
 />
 ) : null}
 </div>
 ) : null}
 {multiline ? (
 <AutoGrowTextarea {...inputProps} />
 ) : (
 <input
 {...inputProps}
 type={type}
 inputMode={type === "decimal" ? "decimal" : undefined}
 />
 )}
 {hint ? <p className="text-[11px] text-muted-foreground mt-1">{hint}</p> : null}
 </div>
 );
}

// PageHeader.

export function PageHeader({
 title,
 subtitle,
 action,
}: {
 title: string;
 subtitle?: string;
 action?: ReactNode;
}) {
 return (
 <div className="mb-5 flex items-start justify-between gap-3">
 <div className="min-w-0">
 <h2 className="text-xl font-medium text-foreground">{title}</h2>
 {subtitle ? (
 <p className="text-[13px] text-muted-foreground leading-snug mt-1">{subtitle}</p>
 ) : null}
 </div>
 {action}
 </div>
 );
}

// Subscription chip — shows current plan / trial state. Click goes to billing.

export function SubscriptionChip({
 sub,
 onClick,
}: {
 sub: { plan: string | null; subscriptionStatus: string | null; trialEndsAt: string | null } | null;
 onClick: () => void;
}) {
 const tsub = useTranslations("dashboard.subscriptionChip");
 let label = tsub("plan");
 let cls = "bg-secondary text-foreground border-border";

 if (sub) {
 const isActive = sub.subscriptionStatus === "ACTIVE" && sub.plan && sub.plan !== "FREE";
 const trialEndsAt = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
 const trialing = !isActive && trialEndsAt !== null && trialEndsAt > new Date();
 const trialExpired = !isActive && trialEndsAt !== null && trialEndsAt <= new Date();

 if (isActive && sub.plan) {
 label = sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase();
 cls = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
 } else if (trialing && trialEndsAt) {
 const daysLeft = Math.max(1, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000));
 label = tsub("trialDays", { days: daysLeft });
 cls = "bg-primary/10 text-primary border-primary/30";
 } else if (trialExpired) {
 label = tsub("trialExpired");
 cls = "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
 } else {
 label = tsub("free");
 cls = "bg-secondary text-muted-foreground border-border";
 }
 }

 return (
 <button
 type="button"
 onClick={onClick}
 className={"shrink-0 inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-md " + cls}
 >
 {label}
 </button>
 );
}

// EmptyState.

export function EmptyState({
 title,
 subtitle,
 action,
}: {
 title: string;
 subtitle?: string;
 action?: ReactNode;
}) {
 return (
 <div className="bg-card border border-border rounded-xl p-8 md:p-12 min-h-[280px] flex flex-col items-center justify-center text-center">
 <h3 className="text-base font-medium text-foreground">{title}</h3>
 {subtitle ? (
 <p className="text-sm text-muted-foreground leading-snug mt-1.5 max-w-sm">{subtitle}</p>
 ) : null}
 {action ? <div className="mt-5 w-full max-w-xs">{action}</div> : null}
 </div>
 );
}

// Section card for edit pages.

export function Section({
 title,
 description,
 children,
 className = "",
}: {
 title?: string;
 description?: string;
 children: ReactNode;
 className?: string;
}) {
 return (
 <section className={"bg-card border border-border rounded-xl p-4 md:p-5 " + className}>
 {title || description ? (
 <div className="mb-4">
 {title ? <h3 className="text-sm font-medium text-foreground">{title}</h3> : null}
 {description ? (
 <p className="text-xs text-muted-foreground leading-snug mt-0.5">{description}</p>
 ) : null}
 </div>
 ) : null}
 {children}
 </section>
 );
}

// Sticky bar used on edit/sub pages.

export function SubpageStickyBar({
 onBack,
 onSave,
 canSave,
 hideSave,
 children,
}: {
 onBack: () => void;
 onSave?: () => void | Promise<void>;
 canSave?: boolean;
 hideSave?: boolean;
 children?: ReactNode;
}) {
 const tc = useTranslations("dashboard.common");
 const [saving, setSaving] = useState(false);
 async function handleSave() {
 if (saving || !onSave) return;
 setSaving(true);
 try {
 await onSave();
 } finally {
 setSaving(false);
 }
 }
 return (
 <div
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 h-14 flex items-center bg-[hsl(0_0%_6.5%/0.9)] backdrop-blur-md border-b border-border/60"
 style={{ top: "var(--topbar-h, 0px)" }}
 >
 <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3">
 <button
 type="button"
 onClick={onBack}
 className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-muted-foreground bg-secondary rounded-md"
 >
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
 {tc("back")}
 </button>
 <div className="flex items-center gap-2">
 {children}
 {!hideSave ? (
 <button
 type="button"
 onClick={handleSave}
 disabled={!canSave || saving}
 className="h-8 px-2.5 text-xs font-medium text-primary-foreground bg-primary rounded-md transition-colors inline-flex items-center gap-1"
 >
 {saving ? (
 <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
 ) : (
 <CheckIcon size={14} />
 )}
 {tc("save")}
 </button>
 ) : null}
 </div>
 </div>
 </div>
 );
}

// EditPageHeader — bigger heading + sticky save bar (used for dish/option pages).

export function EditPageHeader({
 onBack,
 title,
 breadcrumb,
 lang,
 onLangChange,
 languages,
 onSave,
 canSave,
 saving,
 onLangsOpen,
 onLangSelect,
}: {
 onBack: () => void;
 title: string;
 breadcrumb?: string;
 lang?: string;
 onLangChange?: (code: string) => void;
 languages?: MiniLang[];
 onSave?: () => void;
 canSave?: boolean;
 saving?: boolean;
 onLangsOpen?: () => void;
 onLangSelect?: () => void;
}) {
 const tc = useTranslations("dashboard.common");
 return (
 <>
 <div
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 h-14 flex items-center bg-[hsl(0_0%_6.5%/0.9)] backdrop-blur-md border-b border-border/60"
 style={{ top: "var(--topbar-h, 0px)" }}
 >
 <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3">
 <button
 type="button"
 onClick={onBack}
 className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-muted-foreground bg-secondary rounded-md"
 >
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
 {tc("back")}
 </button>
 <div className="flex items-center gap-2">
 {onLangChange && languages && lang ? (
 <LanguageSwitcher lang={lang} onChange={onLangChange} languages={languages} onOpen={onLangsOpen} onSelect={onLangSelect} />
 ) : null}
 {onSave ? (
 <button
 type="button"
 onClick={onSave}
 disabled={!canSave || saving}
 className="h-8 px-2.5 text-xs font-medium text-primary-foreground bg-primary rounded-md transition-colors inline-flex items-center gap-1"
 >
 {saving ? (
 <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
 ) : (
 <CheckIcon size={14} />
 )}
 {tc("save")}
 </button>
 ) : null}
 </div>
 </div>
 </div>

 <div className="max-w-2xl mx-auto pt-5 md:pt-4 pb-5">
 {breadcrumb ? <div className="text-xs text-muted-foreground truncate">{breadcrumb}</div> : null}
 <h2 className="text-xl font-medium text-foreground truncate mt-1">{title}</h2>
 </div>
 </>
 );
}

// PreviewButton + ShareButton (used on Menu page sticky bar).

export function PreviewButton({
 url,
 onOpen,
 onboardingTarget,
}: {
 url: string;
 onOpen?: () => void;
 onboardingTarget?: string;
}) {
 const t = useTranslations("dashboard.preview");
 const [open, setOpen] = useState(false);
 const fullUrl = url.startsWith("http") ? url : "https://" + url;
 return (
 <>
 <button
 type="button"
 data-onboarding-target={onboardingTarget}
 onClick={() => {
 onOpen?.();
 setOpen(true);
 }}
 className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-primary-foreground bg-primary rounded-md transition-colors"
 >
 <EyeIcon size={14} />
 {t("preview")}
 </button>
 <MenuPreviewModal menuUrl={fullUrl} open={open} onOpenChange={setOpen} />
 </>
 );
}

export function ShareButton({
 onClick,
 onboardingTarget,
}: {
 onClick: () => void;
 onboardingTarget?: string;
}) {
 const t = useTranslations("dashboard.preview");
 return (
 <button
 type="button"
 data-onboarding-target={onboardingTarget}
 onClick={onClick}
 className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-muted-foreground bg-secondary rounded-md"
 >
 <ShareIcon size={14} />
 {t("share")}
 </button>
 );
}

// ShareModal — QR + link + actions.

export function ShareModal({
 open,
 onClose,
 url,
 restaurantName,
}: {
 open: boolean;
 onClose: () => void;
 url: string;
 restaurantName: string;
}) {
 const tc = useTranslations("dashboard.common");
 const tp = useTranslations("dashboard.preview");
 const [copied, setCopied] = useState(false);
 const fullUrl = url && url.startsWith("http") ? url : "https://" + (url || "");
 const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

 function copyLink() {
 track("dash_menu_share_copy");
 if (navigator.clipboard?.writeText) {
 navigator.clipboard
 .writeText(fullUrl)
 .then(() => {
 setCopied(true);
 setTimeout(() => setCopied(false), 1800);
 })
 .catch(() => {});
 }
 }

 function downloadQr() {
 track("dash_menu_share_download");
 const canvas = qrCanvasRef.current;
 if (!canvas) return;
 canvas.toBlob((blob) => {
 if (!blob) return;
 const objectUrl = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = objectUrl;
 a.download = "menu-qr.png";
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
 }, "image/png");
 }

 function openInNewTab() {
 track("dash_menu_share_open_menu");
 window.open(fullUrl, "_blank", "noopener,noreferrer");
 }

 const handleClose = () => {
 track("dash_menu_share_close");
 onClose();
 };

 return (
 <Modal open={open} onClose={handleClose} size="sm" title={tp("shareTitle", { name: restaurantName || tp("shareYourMenu") })}>
 <div className="flex justify-center">
 <div
 className="w-[180px] h-[180px] p-5 bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
 onClick={() => track("dash_menu_share_qr_image")}
 >
 <QRCodeCanvas
 ref={qrCanvasRef}
 value={fullUrl}
 size={480}
 marginSize={2}
 level="M"
 className="block w-[140px] h-[140px]"
 />
 </div>
 </div>
 <p className="text-xs text-muted-foreground text-center mt-3">
 {tp("tip")}
 </p>
 <div className="mt-5 flex items-center justify-between gap-2 p-3 bg-secondary border border-border rounded-lg">
 <span
 className="text-xs text-muted-foreground truncate"
 onClick={() => track("dash_menu_share_link_input")}
 >{fullUrl.replace(/^https?:\/\//, "")}</span>
 <button
 type="button"
 onClick={copyLink}
 className="text-xs font-medium text-foreground hover:text-foreground/70 transition-colors flex items-center gap-1 flex-shrink-0"
 >
 {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
 {copied ? tc("copied") : tc("copy")}
 </button>
 </div>
 <div className="grid grid-cols-2 gap-2 mt-4">
 <button
 type="button"
 onClick={downloadQr}
 className="h-10 px-3 text-sm font-medium text-foreground bg-card border border-input rounded-lg transition-colors flex items-center justify-center gap-1.5"
 >
 <DownloadIcon size={14} />
 {tc("downloadQr")}
 </button>
 <button
 type="button"
 onClick={openInNewTab}
 className="h-10 px-3 text-sm font-medium text-foreground bg-card border border-input rounded-lg transition-colors flex items-center justify-center gap-1.5"
 >
 <ExternalLinkIcon size={14} />
 {tc("openMenu")}
 </button>
 </div>
 </Modal>
 );
}

// TableQrModal — per-table QR.

export function TableQrModal({
 open,
 onClose,
 tableNumber,
 tableLabel,
 menuUrl,
}: {
 open: boolean;
 onClose: () => void;
 tableNumber: number | null;
 tableLabel: string;
 menuUrl: string;
}) {
 const tc = useTranslations("dashboard.common");
 const tp = useTranslations("dashboard.preview");
 const tt = useTranslations("dashboard.tables");
 const [copied, setCopied] = useState(false);
 const tableQrCanvasRef = useRef<HTMLCanvasElement | null>(null);
 if (tableNumber === null) return null;
 const baseUrl = menuUrl && menuUrl.startsWith("http") ? menuUrl : "https://" + (menuUrl || "");
 const fullUrl = baseUrl + "?table=" + tableNumber;

 function copyLink() {
 if (navigator.clipboard?.writeText) {
 navigator.clipboard
 .writeText(fullUrl)
 .then(() => {
 setCopied(true);
 setTimeout(() => setCopied(false), 1800);
 })
 .catch(() => {});
 }
 }

 function downloadQr() {
 const canvas = tableQrCanvasRef.current;
 if (!canvas) return;
 canvas.toBlob((blob) => {
 if (!blob) return;
 const objectUrl = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = objectUrl;
 a.download = "table-" + tableNumber + "-qr.png";
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
 }, "image/png");
 }

 function openInNewTab() {
 window.open(fullUrl, "_blank", "noopener,noreferrer");
 }

 return (
 <Modal open={open} onClose={onClose} title={tt("qrModalTitle", { number: tableNumber, label: tableLabel ? " · " + tableLabel : "" })}>
 <div className="flex justify-center">
 <div className="p-3 bg-card border border-border rounded-xl">
 <QRCodeCanvas
 ref={tableQrCanvasRef}
 value={fullUrl}
 size={480}
 marginSize={2}
 level="M"
 className="block w-48 h-48"
 />
 </div>
 </div>
 <p className="text-xs text-muted-foreground text-center mt-3">
 {tp("tableTip")}
 </p>
 <div className="mt-5">
 <label className={labelClass}>{tc("tableLink")}</label>
 <div className="flex gap-2">
 <input
 type="text"
 readOnly
 value={fullUrl}
 onFocus={(e) => e.target.select()}
 className={inputClass + " font-mono text-xs"}
 />
 <button
 type="button"
 onClick={copyLink}
 className={
 "shrink-0 h-10 px-3 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 " +
 (copied
 ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
 : "text-foreground bg-card border border-input")
 }
 >
 {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
 {copied ? tc("copied") : tc("copy")}
 </button>
 </div>
 </div>
 <div className="flex gap-2 mt-4">
 <button
 type="button"
 onClick={downloadQr}
 className={secondaryBtn + " flex-1 inline-flex items-center justify-center gap-1.5"}
 >
 <DownloadIcon size={14} />
 {tc("download")}
 </button>
 <button
 type="button"
 onClick={openInNewTab}
 className={primaryBtn + " flex-1 inline-flex items-center justify-center gap-1.5"}
 >
 <ExternalLinkIcon size={14} />
 {tc("open")}
 </button>
 </div>
 </Modal>
 );
}

// File upload helper — POST to /api/upload, returns the public URL.

export async function uploadFile(file: File): Promise<string> {
 const fd = new FormData();
 fd.append("file", file);
 const res = await fetch(apiUrl("/api/upload"), {
        credentials: "include", method: "POST", body: fd });
 if (!res.ok) throw new Error("Upload failed");
 const data = await res.json();
 return data.url as string;
}

// PhotoPicker — reusable inline upload control with hover-overlay remove + AI generate slot.

export function PhotoPicker({
 url,
 onChange,
 onAiClick,
 inputId,
 height = "h-10",
 width = "min-w-[150px]",
 fileInputRef,
 onAddClick,
 onRemoveClick,
}: {
 url: string | null;
 onChange: (url: string | null) => void;
 onAiClick?: () => void;
 inputId: string;
 height?: string;
 width?: string;
 fileInputRef?: React.RefObject<HTMLInputElement | null>;
 onAddClick?: () => void;
 onRemoveClick?: () => void;
}) {
 const tph = useTranslations("dashboard.photo");
 const ta = useTranslations("dashboard.ai");
 const [uploading, setUploading] = useState(false);
 const localRef = useRef<HTMLInputElement | null>(null);
 const ref = fileInputRef ?? localRef;

 async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
 const file = e.target.files?.[0];
 if (!file) return;
 setUploading(true);
 try {
 const uploadedUrl = await uploadFile(file);
 onChange(uploadedUrl);
 } catch {
 // Silent; the upload error surfaces via missing photo.
 } finally {
 setUploading(false);
 if (ref.current) ref.current.value = "";
 }
 }

 function remove() {
 onRemoveClick?.();
 onChange(null);
 if (ref.current) ref.current.value = "";
 }

 return (
 <>
 {onAiClick ? (
 <div className="flex items-center justify-between gap-2 mb-2.5">
 <label className="block text-sm font-medium text-foreground">Photo</label>
 <button
 type="button"
 onClick={onAiClick}
 className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors"
 >
 <SparklesIcon size={11} />
 Generate
 </button>
 </div>
 ) : null}
 <label
 htmlFor={inputId}
 onClick={() => { if (!url) onAddClick?.(); }}
 className={
 "relative flex items-center justify-center gap-1.5 " + width + " " + height +
 " border border-dashed rounded-lg cursor-pointer transition-all overflow-hidden " +
 (url
 ? "border-input p-0"
 : "border-input bg-secondary text-muted-foreground px-3")
 }
 >
 {uploading ? (
 <div className="w-4 h-4 border-2 border-input border-t-neutral-900 rounded-full animate-spin" />
 ) : url ? (
 <>
 <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
 <button
 type="button"
 onClick={(e) => {
 e.preventDefault();
 remove();
 }}
 className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/50 text-white transition-colors"
 aria-label={tph("removePhoto")}
 >
 <CloseIcon size={11} />
 </button>
 </>
 ) : (
 <>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
 <rect x="3" y="3" width="18" height="18" rx="2" />
 <circle cx="9" cy="9" r="2" />
 <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
 </svg>
 <span className="text-[13px] font-medium">Add photo</span>
 </>
 )}
 <input
 id={inputId}
 ref={ref}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={handleFile}
 />
 </label>
 </>
 );
}

// AiImageModal — prompt-driven image generation modal. Posts {prompt} (and any extra body) to endpoint.

export function AiImageModal({
 open,
 onClose,
 onUse,
 endpoint,
 title,
 placeholder,
 defaultPrompt,
 aspect = "square",
 extraBody,
 eventPrefix,
}: {
 open: boolean;
 onClose: () => void;
 onUse: (url: string) => void;
 endpoint: string;
 title: string;
 placeholder?: string;
 defaultPrompt?: string;
 aspect?: "square" | "portrait";
 extraBody?: Record<string, unknown>;
 eventPrefix?: string;
}) {
 const tc = useTranslations("dashboard.common");
 const ta = useTranslations("dashboard.ai");
 const access = useAiImageAccess();
 const qc = useQueryClient();
 const [prompt, setPrompt] = useState(defaultPrompt || "");
 const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
 const [resultUrl, setResultUrl] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 if (open) {
 setPrompt(defaultPrompt || "");
 setStatus("idle");
 setResultUrl(null);
 setError(null);
 }
 }, [open, defaultPrompt]);

 async function generate() {
 if (eventPrefix) track(`${eventPrefix}_generate_photo_click_generate`);
 if (!prompt.trim()) return;
 setStatus("loading");
 setError(null);
 try {
 const res = await fetch(endpoint, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ prompt: prompt.trim(), ...(extraBody || {}) }),
 });
 if (!res.ok) {
 if (res.status === 403) {
 void qc.invalidateQueries({ queryKey: ["sub"] });
 setError(ta("quotaExceededMessage", { limit: 5 }));
 } else {
 setError(ta("errorGenerate"));
 }
 setStatus("error");
 return;
 }
 const data = await res.json();
 if (!data.url) {
 setError(ta("noImage"));
 setStatus("error");
 return;
 }
 setResultUrl(data.url);
 setStatus("done");
 void qc.invalidateQueries({ queryKey: ["sub"] });
 } catch {
 setError(ta("errorGenerate"));
 setStatus("error");
 }
 }

 function useImage() {
 if (eventPrefix) track(`${eventPrefix}_generate_photo_click_use`);
 if (resultUrl) {
 onUse(resultUrl);
 onClose();
 }
 }

 const handleClose = () => {
 if (eventPrefix) track(`${eventPrefix}_generate_photo_click_close`);
 onClose();
 };
 const handleCancel = () => {
 if (eventPrefix) track(`${eventPrefix}_generate_photo_click_cancel`);
 onClose();
 };

 const isLoading = status === "loading";
 const hasResult = status === "done" && resultUrl;
 const previewCls = aspect === "portrait" ? "aspect-[9/16] max-h-[40vh] mx-auto" : "aspect-square w-full max-w-[60vh] mx-auto";

 if (access.kind === "exhausted" && !resultUrl) {
 return (
 <Modal open={open} onClose={handleClose} title={title} size="sm">
 <div className="flex flex-col items-center text-center gap-3 py-4">
 <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
 <SparklesIcon size={20} />
 </div>
 <div className="text-sm font-medium text-foreground">{ta("quotaExceededTitle")}</div>
 <p className="text-xs text-muted-foreground max-w-xs">{ta("quotaExceededMessage", { limit: access.limit })}</p>
 </div>
 <div className="flex gap-2 mt-4">
 <button type="button" onClick={handleClose} className={primaryBtn + " flex-1"}>
 {tc("close")}
 </button>
 </div>
 </Modal>
 );
 }

 return (
 <Modal open={open} onClose={handleClose} title={title} size="sm">
 <div className={previewCls + " bg-secondary rounded-xl overflow-hidden border border-border flex items-center justify-center mb-4"}>
 {isLoading ? (
 <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
 <div className="w-6 h-6 border-2 border-input border-t-foreground rounded-full animate-spin" />
 <div className="text-[11px]">{ta("generating")}</div>
 </div>
 ) : hasResult ? (
 <img src={resultUrl!} alt="" className="w-full h-full object-cover" />
 ) : (
 <div className="flex flex-col items-center gap-1.5 text-muted-foreground px-4 text-center">
 <SparklesIcon size={20} />
 <div className="text-[11px]">{ta("describeTip")}</div>
 </div>
 )}
 </div>

 <label htmlFor="ai-prompt" className={labelClass}>{ta("describe")}</label>
 <textarea
 id="ai-prompt"
 rows={2}
 placeholder={placeholder || ta("promptPlaceholder")}
 value={prompt}
 onChange={(e) => setPrompt(e.target.value)}
 onFocus={() => { if (eventPrefix) track(`${eventPrefix}_generate_photo_focus_description`); }}
 disabled={isLoading}
 className={inputClass + " h-auto py-2 resize-none"}
 />
 <p className="text-[11px] text-muted-foreground mt-1">
 {ta("promptTip")}
 </p>
 {access.kind === "limited" ? (
 <p className="text-[11px] text-muted-foreground mt-1">
 {ta("quotaRemaining", { remaining: access.remaining, limit: access.limit })}
 </p>
 ) : null}

 {error ? <p className="text-xs text-red-600 mt-3">{error}</p> : null}

 <div className="flex gap-2 mt-4">
 {hasResult ? (
 <>
 <button
 type="button"
 onClick={generate}
 disabled={isLoading || !prompt.trim() || access.kind === "exhausted"}
 className={secondaryBtn + " flex-1 inline-flex items-center justify-center gap-1.5"}
 >
 <SparklesIcon size={13} />
 {ta("tryAgain")}
 </button>
 <button
 type="button"
 onClick={useImage}
 className={primaryBtn + " flex-1"}
 >
 {ta("useThisPhoto")}
 </button>
 </>
 ) : (
 <>
 <button type="button" onClick={handleCancel} className={secondaryBtn + " flex-1"}>
 {tc("cancel")}
 </button>
 <button
 type="button"
 onClick={generate}
 disabled={isLoading || !prompt.trim()}
 className={primaryBtn + " flex-1 inline-flex items-center justify-center gap-1.5"}
 >
 {isLoading ? (
 <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
 ) : (
 <SparklesIcon size={13} />
 )}
 {isLoading ? ta("generating") : ta("generate")}
 </button>
 </>
 )}
 </div>
 </Modal>
 );
}
