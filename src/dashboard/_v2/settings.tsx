"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRightIcon, CheckIcon, CopyIcon, SendIcon, SparklesIcon, CloseIcon } from "./icons";
import {
 AiImageModal,
 PageHeader,
 SubpageStickyBar,
 ToggleSwitch,
 uploadFile,
} from "./ui";
import { TablesPage } from "./tables";
import { inputClass, secondaryBtn } from "./tokens";
import { MapPicker } from "@/components/map-picker";
import { slugify } from "./helpers";
import { getMenuUrl, getMenuUrlPrefix } from "@/lib/menu-url";
import { AVAILABLE_LANGUAGES } from "./i18n";
import {
 fetchSubscriptionStatus,
 createCheckoutSession,
 openBillingPortal,
 fetchSupportMessages,
 sendSupportMessage,
 updateRestaurant,
 updateRestaurantLanguages,
 type ApiSupportMessage,
} from "./api";
import { useRestaurant } from "./restaurant-context";
import type { Booking, Order, Restaurant, TableEntity } from "./types";
import { track } from "@/lib/dashboard-events";

const ACCENT_COLORS = [
 "#A8174E", "#C8102E", "#D55427", "#92684C", "#A8531A", "#D4A017", "#D9C29A", "#6F8246", "#3D7259", "#1F5959",
 "#1F3B57", "#314D8C", "#5B6E80", "#7E5F87", "#5E4734", "#9E866B", "#E8541C", "#3B3B3B", "#000000",
];

const CURRENCIES = [
 { code: "EUR", label: "EUR (€)" },
 { code: "USD", label: "USD ($)" },
 { code: "GBP", label: "GBP (£)" },
 { code: "RUB", label: "RUB (₽)" },
 { code: "UAH", label: "UAH (₴)" },
 { code: "BRL", label: "BRL (R$)" },
 { code: "MXN", label: "MXN ($)" },
 { code: "ARS", label: "ARS ($)" },
 { code: "CLP", label: "CLP ($)" },
 { code: "COP", label: "COP ($)" },
 { code: "TRY", label: "TRY (₺)" },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180];

const TIME_OPTIONS = (() => {
 const out: string[] = [];
 for (let h = 0; h < 24; h++) {
 for (let m = 0; m < 60; m += 30) {
 out.push((h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m));
 }
 }
 return out;
})();

type SettingsView =
 | { name: "list" }
 | { name: "about" }
 | { name: "contacts" }
 | { name: "branding" }
 | { name: "general" }
 | { name: "tables" }
 | { name: "orders" }
 | { name: "bookings" }
 | { name: "languages" }
 | { name: "billing" }
 | { name: "support" };

const Divider = () => <div className="border-t border-border my-5" />;

// ── About ──

export function AboutSettingsPage({
 restaurant,
 setRestaurant,
 onBack,
}: {
 restaurant: Restaurant;
 setRestaurant: React.Dispatch<React.SetStateAction<Restaurant>>;
 onBack: () => void;
}) {
 const t = useTranslations("dashboard.settings");
 const ta = useTranslations("dashboard.settings.about");
 const [draft, setDraft] = useState({
 name: restaurant.name,
 subtitle: restaurant.subtitle,
 });

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const canSave = draft.name.trim().length > 0;

 async function save() {
 track("dash_settings_about_save");
 if (!canSave) return;
 try {
 await updateRestaurant({
    title: draft.name.trim(),
    description: draft.subtitle.trim() || null,
   });
 } catch {
 return;
 }
 setRestaurant((r) => ({
    ...r,
    name: draft.name.trim(),
    subtitle: draft.subtitle.trim(),
   }));
 onBack();
 }

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_about_back"); onBack(); }} onSave={save} canSave={canSave} />
 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("breadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{ta("title")}</h2>
 </div>
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <label htmlFor="about-title" className="block text-sm font-medium text-foreground mb-2.5">{ta("titleLabel")}</label>
 <input
 id="about-title"
 type="text"
 value={draft.name}
 onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
 onFocus={() => track("dash_settings_about_focus_name")}
 placeholder={ta("titlePlaceholder")}
 className={inputClass}
 />
 <label htmlFor="about-subtitle" className="block text-sm font-medium text-foreground mb-2.5 mt-4">{ta("subtitleLabel")}</label>
 <input
 id="about-subtitle"
 type="text"
 value={draft.subtitle}
 onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
 onFocus={() => track("dash_settings_about_focus_description")}
 placeholder={ta("subtitlePlaceholder")}
 className={inputClass}
 />
 </div>
 
 </div>
 </div>
 );
}

// ── Contacts ──

export function ContactsSettingsPage({
 restaurant,
 setRestaurant,
 onBack,
}: {
 restaurant: Restaurant;
 setRestaurant: React.Dispatch<React.SetStateAction<Restaurant>>;
 onBack: () => void;
}) {
 const t = useTranslations("dashboard.settings");
 const tc = useTranslations("dashboard.settings.contacts");
 const [draft, setDraft] = useState({
 contacts: { ...restaurant.contacts },
 location: { ...restaurant.location },
 });

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 async function save() {
 track("dash_settings_contacts_save");
 try {
 await updateRestaurant({
 phone: draft.contacts.phone.trim() || null,
 instagram: draft.contacts.instagram.replace(/^@/, "").trim() || null,
 whatsapp: draft.contacts.whatsapp.trim() || null,
 address: draft.location.address.trim() || null,
 x: draft.location.lng !== null ? String(draft.location.lng) : null,
 y: draft.location.lat !== null ? String(draft.location.lat) : null,
 googlePlaceId: draft.location.placeId,
 });
 } catch {
 return;
 }
 setRestaurant((r) => ({
 ...r,
 contacts: {
 phone: draft.contacts.phone.trim(),
 instagram: draft.contacts.instagram.replace(/^@/, "").trim(),
 whatsapp: draft.contacts.whatsapp.trim(),
 },
 location: {
 address: draft.location.address.trim(),
 lat: draft.location.lat,
 lng: draft.location.lng,
 placeId: draft.location.placeId,
 },
 }));
 onBack();
 }

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_contacts_back"); onBack(); }} onSave={save} canSave />
 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("breadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{tc("title")}</h2>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:items-start">
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <div className="text-sm font-medium text-foreground">{tc("contactsHeader")}</div>
 <p className="text-xs text-muted-foreground mb-4 mt-0.5 leading-snug">
 {tc("contactsTip")}
 </p>

 <label htmlFor="con-phone" className="block text-sm font-medium text-foreground mb-2.5">{tc("phoneLabel")}</label>
 <input
 id="con-phone"
 type="tel"
 value={draft.contacts.phone}
 onChange={(e) => setDraft((d) => ({ ...d, contacts: { ...d.contacts, phone: e.target.value } }))}
 onFocus={() => track("dash_settings_contacts_focus_phone")}
 placeholder={tc("phonePlaceholder")}
 className={inputClass}
 />

 <label htmlFor="con-ig" className="block text-sm font-medium text-foreground mb-2.5 mt-3">{tc("instagramLabel")}</label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">@</span>
 <input
 id="con-ig"
 type="text"
 value={draft.contacts.instagram}
 onChange={(e) =>
 setDraft((d) => ({
 ...d,
 contacts: { ...d.contacts, instagram: e.target.value.replace(/^@/, "") },
 }))
 }
 onFocus={() => track("dash_settings_contacts_focus_instagram")}
 placeholder={tc("instagramPlaceholder")}
 className={inputClass + " pl-7"}
 />
 </div>

 <label htmlFor="con-wa" className="block text-sm font-medium text-foreground mb-2.5 mt-3">{tc("whatsappLabel")}</label>
 <input
 id="con-wa"
 type="tel"
 value={draft.contacts.whatsapp}
 onChange={(e) => setDraft((d) => ({ ...d, contacts: { ...d.contacts, whatsapp: e.target.value } }))}
 onFocus={() => track("dash_settings_contacts_focus_whatsapp")}
 placeholder={tc("phonePlaceholder")}
 className={inputClass}
 />
 </div>

 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <div className="text-sm font-medium text-foreground">{tc("locationHeader")}</div>
 <p className="text-xs text-muted-foreground mb-4 mt-0.5 leading-snug">
 {tc("locationTip")}
 </p>

 <div className="rounded-lg overflow-hidden border border-border">
 <MapPicker
 lat={draft.location.lat ?? undefined}
 lng={draft.location.lng ?? undefined}
 onLocationSelect={(lat, lng, placeId) => {
 track("dash_settings_contacts_location_change");
 setDraft((d) => ({ ...d, location: { ...d.location, lat, lng, placeId } }));
 }}
 />
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}

// ── Branding ──

export function BrandingSettingsPage({
 restaurant,
 setRestaurant,
 onBack,
}: {
 restaurant: Restaurant;
 setRestaurant: React.Dispatch<React.SetStateAction<Restaurant>>;
 onBack: () => void;
}) {
 const t = useTranslations("dashboard.settings");
 const tb = useTranslations("dashboard.settings.branding");
 const [draft, setDraft] = useState({
 backgroundUrl: restaurant.backgroundUrl,
 backgroundType: restaurant.backgroundType,
 accentColor: restaurant.accentColor,
 showTitleOnHomepage: restaurant.showTitleOnHomepage,
 });
 const fileInputRef = useRef<HTMLInputElement | null>(null);
 const colorPickerRef = useRef<HTMLInputElement | null>(null);
 const [uploading, setUploading] = useState(false);
 const [aiOpen, setAiOpen] = useState(false);

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 async function save() {
 track("dash_settings_branding_save");
 try {
 await updateRestaurant({
 source: draft.backgroundUrl,
 backgroundType: draft.backgroundType,
 accentColor: draft.accentColor,
    hideTitle: !draft.showTitleOnHomepage,
 });
 } catch {
 return;
 }
 setRestaurant((r) => ({
 ...r,
 backgroundUrl: draft.backgroundUrl,
 backgroundType: draft.backgroundType,
 accentColor: draft.accentColor,
    showTitleOnHomepage: draft.showTitleOnHomepage,
 }));
 onBack();
 }

 async function handleBackground(e: React.ChangeEvent<HTMLInputElement>) {
 track("dash_settings_branding_click_add_photo");
 const file = e.target.files?.[0];
 if (!file) return;
 // file.type is sometimes empty (Safari/iOS, some Android cameras), so
 // also check the filename extension before falling back to image.
 const isVideo =
 file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(file.name);
 setUploading(true);
 try {
 const url = await uploadFile(file);
 const isVideoUrl = isVideo || /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|$)/i.test(url);
 setDraft((d) => ({ ...d, backgroundUrl: url, backgroundType: isVideoUrl ? "video" : "image" }));
 } catch {
 } finally {
 setUploading(false);
 if (fileInputRef.current) fileInputRef.current.value = "";
 }
 }

 function removeBackground() {
 track("dash_settings_branding_click_delete_photo");
 setDraft((d) => ({ ...d, backgroundUrl: null, backgroundType: null }));
 if (fileInputRef.current) fileInputRef.current.value = "";
 }


 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_branding_back"); onBack(); }} onSave={save} canSave />
 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("breadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{tb("title")}</h2>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:items-start">
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <div className="text-sm font-medium text-foreground">{tb("accentLabel")}</div>
 <p className="text-xs text-muted-foreground mb-3 mt-0.5 leading-snug">
 {tb("accentTip")}
 </p>
 <style>{`
 .accent-grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 0.5rem; }
 @media (min-width: 768px) { .accent-grid { grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 0.5rem; } }
 `}</style>
 <div className="accent-grid">
 {ACCENT_COLORS.map((c) => {
 const isSelected = draft.accentColor.toLowerCase() === c.toLowerCase();
 return (
 <button
 key={c}
 type="button"
 onClick={() => {
 track("dash_settings_branding_click_color");
 setDraft((d) => ({ ...d, accentColor: c }));
 }}
 className={
 "w-full aspect-square rounded-full transition-all " +
 (isSelected ? "ring-2 ring-offset-2 ring-foreground" : "")
 }
 style={{ backgroundColor: c }}
 aria-label={tb("colorAria", { hex: c })}
 />
 );
 })}
 <button
 type="button"
 onClick={() => colorPickerRef.current?.click()}
 className={
 "w-full aspect-square rounded-full transition-all " +
 (!ACCENT_COLORS.some((c) => c.toLowerCase() === draft.accentColor.toLowerCase())
 ? "ring-2 ring-offset-2 ring-foreground"
 : "")
 }
 style={{
 background:
 "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
 }}
 aria-label={tb("customColor")}
 />
 <input
 ref={colorPickerRef}
 type="color"
 value={draft.accentColor}
 onChange={(e) => { track("dash_settings_branding_click_color"); setDraft((d) => ({ ...d, accentColor: e.target.value })); }}
 className="absolute opacity-0 pointer-events-none w-0 h-0"
 aria-hidden="true"
 />
 </div>
 <Divider />
 <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
 <div>
 <div className="text-sm font-medium text-foreground">{tb("showTitleLabel")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">
 {tb("showTitleTip")}
 </div>
 </div>
 <ToggleSwitch
 checked={draft.showTitleOnHomepage}
 onChange={() => { track("dash_settings_branding_toggle_visible"); setDraft((d) => ({ ...d, showTitleOnHomepage: !d.showTitleOnHomepage })); }}
 />
 </label>
 </div>
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <div className="flex items-center justify-between gap-3 mb-2.5">
 <div className="text-sm font-medium text-foreground">{tb("backgroundLabel")}</div>
 <button
 type="button"
 onClick={() => { track("dash_settings_branding_click_generate_photo"); setAiOpen(true); }}
 className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors"
 >
 <SparklesIcon size={11} />
 {tb("generateAi")}
 </button>
 </div>
 <label
 htmlFor="brand-bg"
 className={
 "relative flex flex-col items-center justify-center gap-1.5 mx-auto my-3 aspect-[9/16] w-full max-w-[200px] md:max-w-[180px] border border-dashed rounded-lg cursor-pointer transition-all overflow-hidden " +
 (draft.backgroundUrl
 ? "border-input p-0"
 : "border-input bg-secondary text-muted-foreground")
 }
 >
 {uploading ? (
 <div className="w-5 h-5 border-2 border-input border-t-neutral-900 rounded-full animate-spin" />
 ) : draft.backgroundUrl ? (
 <>
 {draft.backgroundType === "video" ? (
 <video
 key={draft.backgroundUrl}
 src={draft.backgroundUrl}
 autoPlay
 loop
 muted
 playsInline
 controls={false}
 className="w-full h-full object-cover"
 />
 ) : (
 <img src={draft.backgroundUrl} alt="" className="w-full h-full object-cover" />
 )}
 <button
 type="button"
 onClick={(e) => {
 e.preventDefault();
 removeBackground();
 }}
 className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white transition-colors"
 aria-label={tb("removeBackground")}
 >
 <CloseIcon size={12} />
 </button>
 {draft.backgroundType === "video" ? (
 <span className="absolute bottom-1.5 left-1.5 inline-flex items-center h-5 px-1.5 text-[10px] font-medium text-white bg-black/50 rounded">
 {tb("video")}
 </span>
 ) : null}
 </>
 ) : (
 <>
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
 <rect x="3" y="3" width="18" height="18" rx="2" />
 <circle cx="9" cy="9" r="2" />
 <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
 </svg>
 <span className="text-[11px] font-medium text-center px-2 leading-snug">{tb("uploadHint")}</span>
 </>
 )}
 <input
 id="brand-bg"
 ref={fileInputRef}
 type="file"
 accept="image/*,video/*"
 className="hidden"
 onChange={handleBackground}
 />
 </label>
 <p className="text-xs text-muted-foreground mt-2 leading-snug">
 {tb("backgroundTip")}
 </p>
 </div>
 </div>
 </div>

 <AiImageModal
 open={aiOpen}
 onClose={() => setAiOpen(false)}
 onUse={(url) => setDraft((d) => ({ ...d, backgroundUrl: url, backgroundType: "image" }))}
 eventPrefix="dash_settings_branding"
 endpoint="/api/restaurant/generate-background"
 title={tb("aiTitle")}
 placeholder={tb("aiPlaceholder")}
 aspect="portrait"
 />
 </div>
 );
}

// ── General ──

export function GeneralSettingsPage({
 restaurant,
 setRestaurant,
 onBack,
}: {
 restaurant: Restaurant;
 setRestaurant: React.Dispatch<React.SetStateAction<Restaurant>>;
 onBack: () => void;
}) {
 const t = useTranslations("dashboard.settings");
 const tg = useTranslations("dashboard.settings.general");
 const [draft, setDraft] = useState({
 slug: restaurant.slug || slugify(restaurant.name),
 currency: restaurant.currency,
 });
 const [copied, setCopied] = useState(false);

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const validSlug = /^[a-z0-9-]{2,40}$/.test(draft.slug);
 const canSave = validSlug;

 async function save() {
 track("dash_settings_general_save");
 if (!canSave) return;
 try {
 await updateRestaurant({ slug: draft.slug, currency: draft.currency });
 } catch {
 return;
 }
 setRestaurant((r) => ({
 ...r,
 slug: draft.slug,
 currency: draft.currency,
 menuUrl: getMenuUrl(draft.slug),
 }));
 onBack();
 }

 function copyUrl() {
 track("dash_settings_general_click_copy");
 const fullUrl = getMenuUrl(draft.slug);
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

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_general_back"); onBack(); }} onSave={save} canSave={canSave} />
 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("breadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{tg("title")}</h2>
 </div>
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <label htmlFor="gen-slug" className="block text-sm font-medium text-foreground mb-2.5">{tg("menuLinkLabel")}</label>
 <div className="relative flex items-center w-full h-10 bg-card border border-input rounded-lg overflow-hidden">
 <input
 id="gen-slug"
 type="text"
 value={draft.slug}
 onChange={(e) => setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))}
 onFocus={() => track("dash_settings_general_focus_link")}
 placeholder={tg("slugPlaceholder")}
 className="flex-1 min-w-0 h-full pl-3 text-sm text-foreground bg-transparent border-0 placeholder:text-muted-foreground focus:outline-none"
 />
 <span className="pr-12 text-sm text-muted-foreground whitespace-nowrap select-none">
 {getMenuUrlPrefix()}
 </span>
 <button
 type="button"
 onClick={copyUrl}
 className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground transition-colors"
 aria-label={tg("copyUrl")}
 title={tg("copyUrl")}
 >
 {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
 </button>
 </div>
 <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
 {tg("menuLinkTip")}
 </p>
 {!validSlug && draft.slug.length > 0 ? (
 <p className="text-xs text-red-600 mt-1">{tg("slugError")}</p>
 ) : null}

 <Divider />

 <label htmlFor="gen-currency" className="block text-sm font-medium text-foreground mb-2.5">{tg("currencyLabel")}</label>
 <select
 id="gen-currency"
 value={draft.currency}
 onChange={(e) => {
 track("dash_settings_general_currency_change", { currency: e.target.value });
 setDraft((d) => ({ ...d, currency: e.target.value }));
 }}
 className={inputClass}
 >
 {CURRENCIES.map((c) => (
 <option key={c.code} value={c.code}>
 {c.label}
 </option>
 ))}
 </select>
 <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{tg("currencyTip")}</p>
 </div>
 </div>
 </div>
 );
}

// ── Order settings ──

export function OrderSettingsPage({
 restaurant,
 setRestaurant,
 onBack,
}: {
 restaurant: Restaurant;
 setRestaurant: React.Dispatch<React.SetStateAction<Restaurant>>;
 onBack: () => void;
}) {
 const t = useTranslations("dashboard.settings");
 const to = useTranslations("dashboard.settings.orders");
 const [draft, setDraft] = useState(restaurant.orderSettings);

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const hasMode = draft.modes.internal || draft.modes.whatsapp;
 const canSave = !draft.acceptOrders || hasMode;

 async function save() {
 track("dash_settings_orders_save");
 if (!canSave) return;
 const orderMode =
 draft.modes.internal && draft.modes.whatsapp
 ? "both"
 : draft.modes.whatsapp
 ? "whatsapp"
 : "internal";
 try {
 await updateRestaurant({
 ordersEnabled: draft.acceptOrders,
 orderMode,
 orderNameEnabled: draft.requiredFields.name,
 orderPhoneEnabled: draft.requiredFields.phone,
 orderAddressEnabled: draft.requiredFields.address,
 });
 } catch {
 return;
 }
 setRestaurant((r) => ({ ...r, orderSettings: draft }));
 onBack();
 }

 const disabled = !draft.acceptOrders;

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_orders_back"); onBack(); }} onSave={save} canSave={canSave} />
 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("breadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{to("title")}</h2>
 </div>
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
 <div>
 <div className="text-sm font-medium text-foreground">{to("acceptLabel")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">
 {to("acceptTip")}
 </div>
 </div>
 <ToggleSwitch
 checked={draft.acceptOrders}
 onChange={() => {
 track("dash_settings_orders_toggle_accept");
 setDraft((d) => ({ ...d, acceptOrders: !d.acceptOrders }));
 }}
 />
 </label>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:items-start mt-3">
<div className={"bg-card border border-border rounded-2xl p-5 md:p-6 " + (disabled ? "opacity-50 pointer-events-none" : "")}>
 <div>
 <div className="text-sm font-medium text-foreground">{to("modeLabel")}</div>
 <p className="text-xs text-muted-foreground mb-4 mt-0.5">
 {to("modeTip")}
 </p>
 <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
 <div className="text-sm text-foreground">{to("internal")}</div>
 <ToggleSwitch
 checked={draft.modes.internal}
 onChange={() => { track("dash_settings_orders_toggle_internal"); setDraft((d) => ({ ...d, modes: { ...d.modes, internal: !d.modes.internal } })); }}
 />
 </label>
 <div className="border-t border-border my-2.5" />
 <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
 <div className="text-sm text-foreground">{to("whatsapp")}</div>
 <ToggleSwitch
 checked={draft.modes.whatsapp}
 onChange={() => { track("dash_settings_orders_toggle_whatsapp"); setDraft((d) => ({ ...d, modes: { ...d.modes, whatsapp: !d.modes.whatsapp } })); }}
 />
 </label>
 {!hasMode ? <p className="text-xs text-red-600 mt-2">{to("modeError")}</p> : null}
 </div>
 </div>

 <div className={"bg-card border border-border rounded-2xl p-5 md:p-6 " + (disabled ? "opacity-50 pointer-events-none" : "")}>
 <div>
 <div className="text-sm font-medium text-foreground">{to("requiredFieldsLabel")}</div>
 <p className="text-xs text-muted-foreground mb-4 mt-0.5">
 {to("requiredFieldsTip")}
 </p>
 {(["name", "phone", "address"] as const).map((key, idx) => (
 <div key={key}>
 {idx > 0 ? <div className="border-t border-border my-2.5" /> : null}
 <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
 <div className="text-sm text-foreground">
 {key === "name" ? to("fieldName") : key === "phone" ? to("fieldPhone") : to("fieldAddress")}
 </div>
 <ToggleSwitch
 checked={draft.requiredFields[key]}
 onChange={() => {
 track(`dash_settings_orders_toggle_${key}`);
 setDraft((d) => ({
 ...d,
 requiredFields: { ...d.requiredFields, [key]: !d.requiredFields[key] },
 }));
 }}
 />
 </label>
 </div>
 ))}
 </div>
 </div>
 </div>
</div>
 </div>
 );
}

// ── Booking settings ──

export function BookingSettingsPage({
 restaurant,
 setRestaurant,
 onBack,
}: {
 restaurant: Restaurant;
 setRestaurant: React.Dispatch<React.SetStateAction<Restaurant>>;
 onBack: () => void;
}) {
 const t = useTranslations("dashboard.settings");
 const tb = useTranslations("dashboard.settings.bookings");
 const [draft, setDraft] = useState(restaurant.bookingSettings);

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const dayErrors = draft.schedule.map((d) => {
 if (d.closed) return null;
 if (!(d.from < d.to)) return "hours";
 const lunchSet = d.lunchFrom !== null && d.lunchTo !== null;
 if (lunchSet) {
 if (!(d.lunchFrom! < d.lunchTo!)) return "lunch";
 if (!(d.lunchFrom! >= d.from && d.lunchTo! <= d.to)) return "lunchOutside";
 }
 return null;
 });
 const canSave = !draft.enabled || dayErrors.every((e) => e === null);

 async function save() {
 track("dash_settings_booking_save");
 if (!canSave) return;
 // Keep legacy workingHoursStart/End in sync with the first open day so
 // public-menu fallback (reservationSchedule null) still picks something.
 const firstOpen = draft.schedule.find((d) => !d.closed);
 try {
 await updateRestaurant({
 reservationsEnabled: draft.enabled,
 reservationMode: draft.approval,
 reservationSlotMinutes: draft.duration,
 reservationSchedule: draft.schedule,
 timezone: draft.timezone,
 ...(firstOpen
 ? { workingHoursStart: firstOpen.from, workingHoursEnd: firstOpen.to }
 : {}),
 });
 } catch {
 return;
 }
 setRestaurant((r) => ({ ...r, bookingSettings: draft }));
 onBack();
 }

 function updateDay(idx: number, patch: Partial<typeof draft.schedule[0]>) {
 setDraft((d) => ({
 ...d,
 schedule: d.schedule.map((day, i) => (i === idx ? { ...day, ...patch } : day)),
 }));
 }

 const disabled = !draft.enabled;

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_booking_back"); onBack(); }} onSave={save} canSave={canSave} />
 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("breadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{tb("title")}</h2>
 </div>
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
 <div>
 <div className="text-sm font-medium text-foreground">{tb("enableLabel")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">
 {tb("enableTip")}
 </div>
 </div>
 <ToggleSwitch
 checked={draft.enabled}
 onChange={() => {
 track("dash_settings_booking_toggle_enable");
 setDraft((d) => ({ ...d, enabled: !d.enabled }));
 }}
 />
 </label>

 <Divider />

 <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
 <div className="flex items-center justify-between gap-3">
 <div>
 <div className="text-sm font-medium text-foreground">{tb("modeLabel")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">
 {draft.approval === "auto" ? tb("modeAutoTip") : tb("modeManualTip")}
 </div>
 </div>
 <select
 value={draft.approval}
 onChange={(e) => {
 track("dash_settings_booking_change_mode", { mode: e.target.value });
 setDraft((d) => ({ ...d, approval: e.target.value as "auto" | "manual" }));
 }}
 className={inputClass + " w-32"}
 >
 <option value="auto">{tb("modeAuto")}</option>
 <option value="manual">{tb("modeManual")}</option>
 </select>
 </div>
 </div>

 <Divider />

 <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
 <div className="flex items-center justify-between gap-3">
 <div>
 <div className="text-sm font-medium text-foreground">{tb("durationLabel")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">
 {tb("durationTip")}
 </div>
 </div>
 <select
 value={draft.duration}
 onChange={(e) => { track("dash_settings_booking_change_duration"); setDraft((d) => ({ ...d, duration: parseInt(e.target.value, 10) })); }}
 className={inputClass + " w-24"}
 >
 {DURATION_OPTIONS.map((min) => (
 <option key={min} value={min}>
 {tb("durationMin", { min })}
 </option>
 ))}
 </select>
 </div>
 </div>
 </div>

 {/* All weekdays in one card, separated by dividers. */}
 <div className={"mt-5 bg-card border border-border rounded-2xl p-5 md:p-6 " + (disabled ? "opacity-50 pointer-events-none" : "")}>
 {draft.schedule.map((day, idx) => (
 <div key={idx}>
 {idx > 0 ? <Divider /> : null}
 <ScheduleDayRow
 idx={idx}
 day={day}
 dayName={tb(`day.${WEEKDAY_KEYS[idx]}`)}
 error={dayErrors[idx]}
 tb={tb}
 onChange={(patch) => updateDay(idx, patch)}
 />
 </div>
 ))}
 </div>

 {/* Timezone — IANA identifier. Used by reservation logic to compute
   "is slot in the past" against the restaurant's local clock. */}
 <div className={"mt-5 bg-card border border-border rounded-2xl p-5 md:p-6 " + (disabled ? "opacity-50 pointer-events-none" : "")}>
 <div className="flex items-center justify-between gap-3">
 <div>
 <div className="text-sm font-medium text-foreground">{tb("timezoneLabel")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">
 {tb("timezoneTip")}
 </div>
 </div>
 <select
 value={draft.timezone}
 onChange={(e) => {
 track("dash_settings_booking_change_timezone", { tz: e.target.value });
 setDraft((d) => ({ ...d, timezone: e.target.value }));
 }}
 className={inputClass + " w-56"}
 >
 {TIMEZONE_OPTIONS.map((tz) => (
 <option key={tz} value={tz}>{tz}</option>
 ))}
 </select>
 </div>
 </div>
 </div>
 </div>
 );
}

// IANA timezone identifiers available at runtime. Falls back to a small
// curated list on environments that don't expose Intl.supportedValuesOf.
const TIMEZONE_OPTIONS: string[] = (() => {
 try {
 const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
 if (typeof fn === "function") return fn("timeZone");
 } catch {
 // ignore
 }
 return [
 "UTC",
 "Europe/Madrid", "Europe/Rome", "Europe/Paris", "Europe/Berlin", "Europe/London",
 "Europe/Lisbon", "Europe/Amsterdam", "Europe/Brussels", "Europe/Zurich",
 "Europe/Vienna", "Europe/Athens", "Europe/Warsaw", "Europe/Prague",
 "Europe/Budapest", "Europe/Bucharest", "Europe/Sofia", "Europe/Istanbul",
 "Europe/Moscow", "Europe/Kyiv", "Europe/Helsinki", "Europe/Stockholm",
 "Europe/Oslo", "Europe/Copenhagen", "Europe/Dublin", "Asia/Nicosia",
 "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
 "America/Toronto", "America/Mexico_City", "America/Sao_Paulo",
 "America/Argentina/Buenos_Aires", "America/Bogota", "America/Lima",
 "America/Santiago",
 "Asia/Dubai", "Asia/Riyadh", "Asia/Jerusalem", "Asia/Tokyo", "Asia/Seoul",
 "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Bangkok",
 "Asia/Jakarta", "Asia/Manila", "Asia/Kolkata",
 "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland",
 "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi",
 "Africa/Casablanca",
 ];
})();

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type DayErrorCode = "hours" | "lunch" | "lunchOutside" | null;

function ScheduleDayRow({
 idx,
 day,
 dayName,
 error,
 tb,
 onChange,
}: {
 idx: number;
 day: { closed: boolean; from: string; to: string; lunchFrom: string | null; lunchTo: string | null };
 dayName: string;
 error: DayErrorCode;
 tb: ReturnType<typeof useTranslations>;
 onChange: (patch: Partial<{ closed: boolean; from: string; to: string; lunchFrom: string | null; lunchTo: string | null }>) => void;
}) {
 const lunchEnabled = day.lunchFrom !== null && day.lunchTo !== null;
 // Lunch must fit inside the day's working hours.
 const lunchTimes = TIME_OPTIONS.filter((t) => t >= day.from && t <= day.to);
 return (
 <div>
 <div className="flex items-center justify-between gap-3 flex-nowrap min-h-10">
 <label className="flex items-center gap-3 cursor-pointer select-none min-w-0">
 <ToggleSwitch
 checked={!day.closed}
 onChange={() => {
 track("dash_settings_booking_toggle_day", { idx });
 onChange({ closed: !day.closed });
 }}
 />
 <div className="text-sm font-semibold text-foreground truncate min-w-0">{dayName}</div>
 </label>
 <div className={"items-center gap-2 ml-auto shrink-0 " + (day.closed ? "hidden" : "flex")}>
 <select
 value={day.from}
 onChange={(e) => onChange({ from: e.target.value })}
 disabled={day.closed}
 className={inputClass + " w-auto tabular-nums"}
 >
 {TIME_OPTIONS.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
 </select>
 <span className="text-muted-foreground">—</span>
 <select
 value={day.to}
 onChange={(e) => onChange({ to: e.target.value })}
 disabled={day.closed}
 className={inputClass + " w-auto tabular-nums"}
 >
 {TIME_OPTIONS.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
 </select>
 </div>
 </div>

 {!day.closed && (
 <>
 <div className="flex items-center justify-between gap-3 flex-nowrap min-h-10 mt-3">
 <label className="flex items-center gap-3 cursor-pointer select-none min-w-0">
 <ToggleSwitch
 checked={lunchEnabled}
 onChange={() => {
 track("dash_settings_booking_toggle_lunch", { idx });
 if (lunchEnabled) {
 onChange({ lunchFrom: null, lunchTo: null });
 } else {
 onChange({ lunchFrom: "14:00", lunchTo: "16:00" });
 }
 }}
 />
 <div className="text-sm font-semibold text-foreground truncate min-w-0">{tb("lunchLabel")}</div>
 </label>
 <div className={"items-center gap-2 ml-auto shrink-0 " + (lunchEnabled ? "flex" : "hidden")}>
 <select
 value={day.lunchFrom || lunchTimes[0] || day.from}
 onChange={(e) => onChange({ lunchFrom: e.target.value })}
 disabled={!lunchEnabled}
 className={inputClass + " w-auto tabular-nums"}
 >
 {lunchTimes.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
 </select>
 <span className="text-muted-foreground">—</span>
 <select
 value={day.lunchTo || lunchTimes[lunchTimes.length - 1] || day.to}
 onChange={(e) => onChange({ lunchTo: e.target.value })}
 disabled={!lunchEnabled}
 className={inputClass + " w-auto tabular-nums"}
 >
 {lunchTimes.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
 </select>
 </div>
 </div>

 {error ? (
 <p className="text-xs text-red-600 mt-3">{tb(`error.${error}`)}</p>
 ) : null}
 </>
 )}
 </div>
 );
}

// ── Languages ──

export function LanguagesSettingsPage({
 restaurant,
 setRestaurant,
 onBack,
}: {
 restaurant: Restaurant;
 setRestaurant: React.Dispatch<React.SetStateAction<Restaurant>>;
 onBack: () => void;
}) {
 const t = useTranslations("dashboard.settings");
 const tl = useTranslations("dashboard.settings.languages");
 const tc = useTranslations("dashboard.common");
 const [draft, setDraft] = useState({
 languages: restaurant.languages,
 defaultLang: restaurant.defaultLang,
 });
 const [saving, setSaving] = useState(false);
 const [translating, setTranslating] = useState(false);
 const [translateError, setTranslateError] = useState<string | null>(null);

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const canSave = draft.languages.length > 0 && draft.languages.includes(draft.defaultLang) && !saving;

 async function save() {
 track("dash_settings_langs_save");
 if (!canSave) return;
 const addedLangs = draft.languages.filter((l) => !restaurant.languages.includes(l));
 const willBackfill = addedLangs.length > 0;
 setSaving(true);
 if (willBackfill) setTranslating(true);
 try {
 await updateRestaurantLanguages(draft.languages, draft.defaultLang);
 setRestaurant((r) => ({ ...r, languages: draft.languages, defaultLang: draft.defaultLang }));
 setTranslating(false);
 onBack();
 } catch (err) {
 if (willBackfill) setTranslateError(err instanceof Error ? err.message : String(err));
 setSaving(false);
 }
 }

 function toggleLang(code: string) {
 setDraft((d) => {
 const isOn = d.languages.includes(code);
 track(isOn ? "dash_settings_langs_lang_off" : "dash_settings_langs_lang_on");
 const next = isOn ? d.languages.filter((c) => c !== code) : [...d.languages, code];
 let nextDefault = d.defaultLang;
 if (isOn && code === d.defaultLang) nextDefault = next[0] || "";
 if (!isOn && next.length === 1) nextDefault = code;
 return { languages: next, defaultLang: nextDefault };
 });
 }

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_langs_back"); onBack(); }} onSave={save} canSave={canSave} />
 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5 flex items-start justify-between gap-3">
 <div>
 <div className="text-xs text-muted-foreground">{t("breadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{tl("title")}</h2>
 </div>
 {draft.languages.length > 0 ? (
 <span className="shrink-0 inline-flex items-center h-8 px-2.5 text-xs font-medium text-muted-foreground bg-secondary rounded-md tabular-nums">
 {draft.languages.length} {tc("selected")}
 </span>
 ) : null}
 </div>
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <div className="text-sm font-medium text-foreground mb-0.5">{tl("availableLabel")}</div>
 <p className="text-xs text-muted-foreground mb-3">
 {tl("availableTip")}
 </p>
 <div className="flex flex-wrap gap-1.5">
 {AVAILABLE_LANGUAGES.map((l) => {
 const isSelected = draft.languages.includes(l.code);
 return (
 <button
 key={l.code}
 type="button"
 onClick={() => toggleLang(l.code)}
 className={
 "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium transition-colors " +
 (isSelected
 ? "bg-foreground text-background"
 : "bg-secondary text-foreground")
 }
 >
 <span className="text-sm leading-none">{l.flag}</span>
 <span>{l.label}</span>
 </button>
 );
 })}
 </div>
 {draft.languages.length === 0 ? (
 <p className="text-xs text-red-600 mt-2">{tl("noneError")}</p>
 ) : null}

 <Divider />

 <label htmlFor="lang-default" className="block text-sm font-medium text-foreground mb-2.5">{tl("defaultLabel")}</label>
 <select
 id="lang-default"
 value={draft.defaultLang}
 onChange={(e) => {
 track("dash_settings_langs_change_default");
 setDraft((d) => ({ ...d, defaultLang: e.target.value }));
 }}
 disabled={draft.languages.length === 0}
 className={inputClass + " disabled:bg-secondary disabled:text-muted-foreground"}
 >
 {draft.languages.map((code) => {
 const l = AVAILABLE_LANGUAGES.find((x) => x.code === code);
 if (!l) return null;
 return (
 <option key={code} value={code}>
 {l.flag} {l.label}
 </option>
 );
 })}
 </select>
 <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
 {tl("defaultTip")}
 </p>
 </div>
 </div>
 {translating || translateError ? (
 <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 text-center">
 {translateError ? (
 <>
 <div className="text-base font-semibold text-foreground mb-2">{tl("translateErrorTitle")}</div>
 <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{translateError}</p>
 <button
 type="button"
 onClick={() => { setTranslateError(null); }}
 className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
 >
 {tc("close")}
 </button>
 </>
 ) : (
 <>
 <div className="w-10 h-10 mx-auto mb-4 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
 <div className="text-base font-semibold text-foreground mb-2">{tl("translatingTitle")}</div>
 <p className="text-sm text-muted-foreground leading-relaxed">{tl("translatingBody")}</p>
 </>
 )}
 </div>
 </div>
 ) : null}
 </div>
 );
}

// ── Billing ──

interface SubStatus {
 plan: string | null;
 subscriptionStatus: string | null;
 currentPeriodEnd: string | null;
 billingCycle: string | null;
 trialEndsAt: string | null;
}

export function BillingSettingsPage({ onBack }: { onBack: () => void }) {
 const t = useTranslations("dashboard.settings");
 const tb = useTranslations("dashboard.settings.billing");
 const locale = useLocale();
 const restaurant = useRestaurant();
 const [sub, setSub] = useState<SubStatus | null>(null);
 const [pendingPlan, setPendingPlan] = useState<{ plan: "BASIC" | "PRO"; cycle: "MONTHLY" | "YEARLY" } | null>(null);

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 fetchSubscriptionStatus().then((s) => setSub(s)).catch(() => track("dash_error_fetch"));
 }, []);

 const isActive = sub?.subscriptionStatus === "ACTIVE" && sub.plan !== "FREE";
 const trialEndsAt = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
 const trialExpired = !isActive && trialEndsAt !== null && trialEndsAt <= new Date();
 const trialing = !isActive && trialEndsAt !== null && trialEndsAt > new Date();

 async function startCheckout(plan: "BASIC" | "PRO", cycle: "MONTHLY" | "YEARLY") {
 track(cycle === "YEARLY" ? "dash_settings_billing_subscribe_year" : "dash_settings_billing_subscribe_month");
 setPendingPlan({ plan, cycle });
 try {
 const url = await createCheckoutSession(plan, cycle, restaurant.currency);
 if (url) window.location.href = url;
 } catch {
 } finally {
 setPendingPlan(null);
 }
 }

 async function manage() {
 track("dash_settings_billing_stripe_panel");
 try {
 const url = await openBillingPortal(locale);
 if (url) window.location.href = url;
 } catch {
 }
 }

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_billing_back"); onBack(); }} hideSave />
 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("breadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{tb("title")}</h2>
 </div>

 {trialExpired ? (
 <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
 <div className="text-sm font-medium text-red-800">{tb("menuUnavailable")}</div>
 <p className="text-xs text-red-700 mt-1 leading-snug">
 {tb("menuUnavailableTip")}
 </p>
 </div>
 ) : trialing && trialEndsAt ? (
 <div className="bg-card border border-border rounded-2xl p-4 mb-5">
 <div className="text-sm font-medium text-foreground">{tb("trialActive")}</div>
 <p className="text-xs text-muted-foreground mt-1 leading-snug">
 {tb("trialEnds", { date: trialEndsAt.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" }) })}
 </p>
 </div>
 ) : null}

 {isActive && sub ? (
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6 mb-5">
 <div className="flex items-start justify-between gap-3">
 <div>
 <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">{tb("active")}</div>
 <div className="text-base font-medium text-foreground mt-0.5">
 {sub.plan} · {sub.billingCycle?.toLowerCase() || "—"}
 </div>
 {sub.currentPeriodEnd ? (
 <div className="text-xs text-muted-foreground mt-0.5">
 {tb("renewsOn", { date: new Date(sub.currentPeriodEnd).toLocaleDateString([], {
 day: "numeric",
 month: "long",
 year: "numeric",
 }) })}
 </div>
 ) : null}
 </div>
 <button type="button" onClick={manage} className={secondaryBtn}>
 {tb("manage")}
 </button>
 </div>
 </div>
 ) : null}

 <style>{`
 .billing-plans { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
 @media (min-width: 600px) { .billing-plans { grid-template-columns: 1fr 1fr; } }
 `}</style>
 <div className="billing-plans">
 {[
 { plan: "BASIC" as const, cycle: "YEARLY" as const, labelKey: "yearly" as const, priceMonthly: "6.90", periodKey: "billedYearly" as const, badgeKey: "save30" as const, highlight: true },
 { plan: "BASIC" as const, cycle: "MONTHLY" as const, labelKey: "monthly" as const, priceMonthly: "9.90", periodKey: "billedMonthly" as const, badgeKey: null, highlight: false },
 ].map((p) => {
 const isCurrent = sub?.plan === p.plan && sub?.billingCycle === p.cycle && isActive;
 return (
 <div
 key={p.plan + p.cycle}
 className={
 "relative bg-card border rounded-2xl p-5 flex flex-col " +
 (isCurrent ? "border-emerald-300" : p.highlight ? "border-primary" : "border-border")
 }
 >
 {p.badgeKey && !isCurrent ? (
 <span className="absolute -top-2 left-5 inline-flex items-center h-5 px-2 text-[10px] font-medium text-primary-foreground bg-primary rounded-full">
 {tb(p.badgeKey)}
 </span>
 ) : null}
 {isCurrent ? (
 <span className="absolute -top-2 left-5 inline-flex items-center h-5 px-2 text-[10px] font-medium text-white bg-emerald-600 rounded-full">
 {tb("current")}
 </span>
 ) : null}

 <div className="text-sm font-medium text-foreground">{tb(p.labelKey)}</div>
 <div className="mt-1 flex items-baseline gap-1">
 <span className="text-2xl font-medium text-foreground tabular-nums">€{p.priceMonthly}</span>
 <span className="text-xs text-muted-foreground">{tb("perMo")}</span>
 </div>
 <div className="text-xs text-muted-foreground mt-0.5">{tb(p.periodKey)}</div>

 <button
 type="button"
 onClick={() => startCheckout(p.plan, p.cycle)}
 disabled={isCurrent || pendingPlan !== null}
 className={
 "mt-4 h-10 text-sm font-medium rounded-lg transition-colors " +
 (isCurrent
 ? "bg-secondary text-muted-foreground cursor-not-allowed"
 : p.highlight
 ? "text-primary-foreground bg-primary"
 : "text-foreground bg-card border border-input")
 }
 >
 {isCurrent ? tb("currentPlan") : isActive ? tb("switch") : tb("subscribe")}
 </button>
 </div>
 );
 })}
 </div>

 <p className="text-xs text-muted-foreground mt-4 leading-snug">
 {tb("cancelTip")}
 </p>
 </div>
 </div>
 );
}

// ── Support ──

export function SupportPage({ onBack }: { onBack: () => void }) {
 const t = useTranslations("dashboard.settings");
 const ts = useTranslations("dashboard.settings.support");
 const [messages, setMessages] = useState<ApiSupportMessage[]>([]);
 const [input, setInput] = useState("");
 const [sending, setSending] = useState(false);
 const scrollRef = useRef<HTMLDivElement | null>(null);
 const lastIdRef = useRef<string | null>(null);
 const taRef = useRef<HTMLTextAreaElement | null>(null);

 function autoresize(el: HTMLTextAreaElement) {
 el.style.height = "auto";
 const next = Math.min(Math.max(el.scrollHeight, 40), 70);
 el.style.height = next + "px";
 }

 useEffect(() => {
 let cancelled = false;
 fetchSupportMessages()
 .then((msgs) => {
 if (!cancelled) setMessages(msgs);
 })
 .catch(() => track("dash_error_fetch"));
 return () => {
 cancelled = true;
 };
 }, []);

 useEffect(() => {
 const id = setInterval(() => {
 fetchSupportMessages().then((msgs) => {
 setMessages((prev) => {
 const lastNew = msgs[msgs.length - 1];
 const lastPrev = prev[prev.length - 1];
 if (lastNew && lastPrev && lastNew.id === lastPrev.id && msgs.length === prev.length) {
 return prev;
 }
 return msgs;
 });
 });
 }, 15000);
 return () => clearInterval(id);
 }, []);

 useEffect(() => {
 const lastMsg = messages[messages.length - 1];
 if (lastMsg && lastMsg.id !== lastIdRef.current) {
 lastIdRef.current = lastMsg.id;
 if (scrollRef.current) {
 scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
 }
 }
 }, [messages]);

 async function send() {
 track("dash_settings_support_send");
 const text = input.trim();
 if (!text || sending) return;
 setSending(true);
 setInput("");
 if (taRef.current) {
 taRef.current.style.height = "";
 }
 try {
 const real = await sendSupportMessage(text);
 setMessages((m) => [...m, real]);
 } catch {
 } finally {
 setSending(false);
 }
 }

 function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
 if (e.key === "Enter" && !e.shiftKey) {
 e.preventDefault();
 send();
 }
 }

 return (
 <div
 className="flex flex-col h-[calc(100dvh-var(--topbar-h,0px)-116px)] md:h-[calc(100dvh-var(--topbar-h,0px)-56px)]"
 >
 <SubpageStickyBar onBack={() => { track("dash_settings_support_back"); onBack(); }} hideSave />
 <div className="max-w-2xl mx-auto w-full pt-5 md:pt-4 flex-1 flex flex-col min-h-0">
 <div className="mb-3 shrink-0">
 <div className="text-xs text-muted-foreground">{t("breadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{ts("title")}</h2>
 </div>

 <div
 ref={scrollRef}
 className="bg-card border border-border rounded-2xl overflow-y-auto p-4 space-y-3 flex-1 min-h-0 hide-scrollbar"
 >
 {messages.length === 0 ? (
 <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
 {ts("noMessages")}
 </div>
 ) : (
 messages.map((m) => <SupportBubble key={m.id} message={m} />)
 )}
 </div>

 <div className="mt-3 shrink-0 flex flex-col gap-3">
 <textarea
 ref={taRef}
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onFocus={() => track("dash_settings_support_focus")}
 onKeyDown={onInputKeyDown}
 placeholder={ts("placeholder")}
 className="w-full h-[90px] px-4 py-3 text-sm leading-5 text-foreground bg-card border border-border rounded-2xl placeholder:text-muted-foreground focus:outline-none transition-colors resize-none box-border"
 />
 <button
 type="button"
 onClick={send}
 disabled={!input.trim() || sending}
 className="w-full shrink-0 flex h-10 px-4 text-sm font-medium text-primary-foreground bg-primary rounded-lg transition-colors items-center justify-center gap-2"
 >
 {sending ? (
 <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
 ) : (
 <SendIcon size={14} />
 )}
 {ts("send")}
 </button>
 </div>
 </div>
 </div>
 );
}

function SupportBubble({ message }: { message: ApiSupportMessage }) {
 const isUser = !message.isAdmin;
 const time = new Date(message.createdAt).toLocaleTimeString([], {
 hour: "2-digit",
 minute: "2-digit",
 hour12: false,
 });
 const cls = isUser
 ? "bg-primary text-primary-foreground rounded-tr-sm"
 : "bg-secondary text-foreground rounded-tl-sm";

 return (
 <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
 <div className="max-w-[75%]">
 <div
 className={
 "px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words " + cls
 }
 >
 {message.message}
 </div>
 <div className={"text-[10px] text-muted-foreground mt-1 px-1 " + (isUser ? "text-right" : "text-left")}>
 {time}
 </div>
 </div>
 </div>
 );
}
