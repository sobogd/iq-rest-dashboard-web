"use client";

// Standalone form components for category / dish / option editing.
// Each one lives in its own Next.js route and uses router.push for navigation.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
 ArrowDownIcon,
 ArrowUpIcon,
 ChevronRightIcon,
 PlusIcon,
 TrashIcon,
} from "./icons";
import {
 AiImageModal,
 ConfirmDialog,
 EditPageHeader,
 PhotoPicker,
 ToggleSwitch,
 TranslatedInput,
} from "./ui";
import { iconBtn, inputClass } from "./tokens";
import {
 ALLERGENS,
 AVAILABLE_LANGUAGES,
 emptyMl,
 getMl,
 getMlWithFallback,
 setMl,
 translateText,
} from "./i18n";
import { AllergenIcon } from "./allergen-icon";
import { moveItem, newId, currencySymbolOf, parseDecimal, sanitizePriceInput } from "./helpers";
import { buildCategoryTranslations, buildItemTranslations } from "./mappers";
import { useScrollLock } from "./use-scroll-lock";
import {
 createCategory,
 createItem,
 deleteCategory,
 deleteItem,
 updateCategory,
 updateItem,
} from "./api";
import { useRestaurant } from "./restaurant-context";
import type { Category, Dish, DishOption, Ml, OptionVariant } from "./types";
import { track } from "@/lib/dashboard-events";

const OPTIONS_ENABLED = import.meta.env.VITE_OPTIONS_ENABLED === "TRUE";

// ── Category form ──

export function CategoryForm({
 category,
 onSavedRedirect,
 onBack,
 onDeletedRedirect,
}: {
 category: Category | null;
 onSavedRedirect: () => void;
 onBack: () => void;
 onDeletedRedirect: () => void;
}) {
 const t = useTranslations("dashboard.categoryForm");
 const tc = useTranslations("dashboard.common");
 const restaurant = useRestaurant();
 const { defaultLang, languages } = restaurant;
 const isNew = category === null;

 const [lang, setLang] = useState<string>(defaultLang);
 const [form, setForm] = useState<{ name: Ml }>({
 name: category ? category.name : emptyMl(languages),
 });
 const [saving, setSaving] = useState(false);
 const [deleting, setDeleting] = useState(false);
 const [confirmOpen, setConfirmOpen] = useState(false);
 const langMetas = (() => {
 const enabled = AVAILABLE_LANGUAGES.filter((l) => languages.includes(l.code));
 const def = enabled.find((l) => l.code === defaultLang);
 if (!def) return enabled;
 return [def, ...enabled.filter((l) => l.code !== defaultLang)];
 })();

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const namePrimary = (form.name[defaultLang] || "").trim();
 const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

 async function save() {
 track("dash_category_click_save");
 if (saving) return;
 if (namePrimary.length === 0) {
 setAlert({
 title: t("nameRequiredTitle"),
 message: t("nameRequiredMessage"),
 });
 return;
 }
 const trimmed: Ml = {};
 languages.forEach((l) => {
 trimmed[l] = (form.name[l] || "").trim();
 });
 const translations = buildCategoryTranslations(trimmed, defaultLang);
 setSaving(true);
 try {
 if (isNew) {
 await createCategory({ name: trimmed[defaultLang], translations });
 } else if (category) {
 await updateCategory(category.id, { name: trimmed[defaultLang], translations });
 }
 onSavedRedirect();
 } catch {
 setSaving(false);
 }
 }

 async function confirmDelete() {
 track("dash_category_click_delete");
 if (!category) return;
 setDeleting(true);
 try {
 await deleteCategory(category.id);
 onDeletedRedirect();
 } catch {
 setDeleting(false);
 setConfirmOpen(false);
 }
 }

 const titleText = isNew
 ? t("newTitle")
 : (getMlWithFallback(form.name, lang, defaultLang) || tc("untitled"));

 return (
 <div>
 <EditPageHeader
 onBack={() => { track("dash_category_click_back"); onBack(); }}
 title={titleText}
 breadcrumb={t("breadcrumb")}
 lang={lang}
 onLangChange={setLang}
 languages={langMetas}
 onSave={save}
 canSave={!saving}
 saving={saving}
 onLangsOpen={() => track("dash_category_click_langs")}
 onLangSelect={() => track("dash_category_click_lang")}
 />

 <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-5 md:p-6">
 <TranslatedInput
 id="cat-name"
 label={t("nameLabel")}
 value={form.name}
 lang={lang}
 defaultLang={defaultLang}
 languages={languages}
 onChange={(v) => setForm((f) => ({ ...f, name: v }))}
 placeholder={t("namePlaceholder")}
 onFocus={() => track("dash_category_focus_name_input")}
 />
 </div>

 {!isNew ? (
 <div className="max-w-2xl mx-auto mt-6 flex justify-center">
 <button
 type="button"
 onClick={() => setConfirmOpen(true)}
 className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-red-600 rounded-lg transition-colors"
 >
 <TrashIcon size={13} />
 {t("deleteButton")}
 </button>
 </div>
 ) : null}

 <ConfirmDialog
 open={confirmOpen}
 title={t("deleteTitle")}
 message={
 deleting
 ? tc("deleting")
 : t("deleteMessage")
 }
 onConfirm={confirmDelete}
 onCancel={() => (deleting ? null : setConfirmOpen(false))}
 />

 <ConfirmDialog
 open={alert !== null}
 singleButton
 title={alert?.title}
 message={alert?.message}
 onCancel={() => setAlert(null)}
 />
 </div>
 );
}

// ── Dish form ──

interface DishFormState {
 name: Ml;
 description: Ml;
 price: string;
 photoUrl: string | null;
 visible: boolean;
 allergens: string[];
}

export function DishForm({
 dish,
 categoryId,
 categoryName,
 onSavedRedirect,
 onBack,
 onDeletedRedirect,
 optionRoutePrefix,
 onOpenOption,
}: {
 dish: Dish | null;
 categoryId: string;
 categoryName: string;
 onSavedRedirect: (newId: string) => void;
 onBack: () => void;
 onDeletedRedirect: () => void;
 optionRoutePrefix?: (dishId: string) => string;
 onOpenOption?: (dishId: string, optionId: string | null) => void;
}) {
 const t = useTranslations("dashboard.dishForm");
 const tc = useTranslations("dashboard.common");
 const tAllergens = useTranslations("dashboard.allergens");
 const router = useRouter();
 const restaurant = useRestaurant();
 const { defaultLang, languages, currency } = restaurant;
 const currencySymbol = currencySymbolOf(currency);
 const isNew = dish === null;

 const [lang, setLang] = useState<string>(defaultLang);
 const initialForm = useMemo<DishFormState>(() => ({
 name: dish ? dish.name : emptyMl(languages),
 description: dish && dish.description ? dish.description : emptyMl(languages),
 price: dish ? dish.price : "",
 photoUrl: dish?.photoUrl ?? null,
 visible: dish ? dish.visible : true,
 allergens: dish?.allergens ?? [],
 }), [dish, languages]);
 const [form, setForm] = useState<DishFormState>(initialForm);
 const [saving, setSaving] = useState(false);
 const [deleting, setDeleting] = useState(false);
 const [confirmOpen, setConfirmOpen] = useState(false);
 const [unsavedOpen, setUnsavedOpen] = useState(false);
 const [aiOpen, setAiOpen] = useState(false);
 const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
 const langMetas = (() => {
 const enabled = AVAILABLE_LANGUAGES.filter((l) => languages.includes(l.code));
 const def = enabled.find((l) => l.code === defaultLang);
 if (!def) return enabled;
 return [def, ...enabled.filter((l) => l.code !== defaultLang)];
 })();

 useEffect(() => {
 if (typeof window !== "undefined" && window.location.hash === "#options") {
 const el = document.getElementById("options-section");
 if (el) {
 el.scrollIntoView({ block: "start", behavior: "auto" });
 return;
 }
 }
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const namePrimary = (form.name[defaultLang] || "").trim();
 const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

 function validateForm(): { title: string; message: string } | null {
 const missing: string[] = [];
 if (namePrimary.length === 0) missing.push("name");
 const priceTrim = form.price.trim();
 if (priceTrim.length === 0 || isNaN(parseDecimal(priceTrim))) missing.push("price");
 if (missing.length === 0) return null;
 if (missing.length === 1) {
 const field = missing[0];
 return {
 title: field === "name" ? t("nameRequiredTitle") : t("priceRequiredTitle"),
 message:
 field === "name"
 ? t("nameRequiredMessage")
 : t("priceRequiredMessage"),
 };
 }
 return {
 title: t("missingTitle"),
 message: t("missingMessage"),
 };
 }

 function toggleAllergen(code: string) {
 setForm((f) => ({
 ...f,
 allergens: f.allergens.includes(code)
 ? f.allergens.filter((a) => a !== code)
 : [...f.allergens, code],
 }));
 }

 async function persist(redirectAfter: "list" | "stay" = "list"): Promise<string | null> {
 if (saving) return null;
 const validation = validateForm();
 if (validation) {
 setAlert(validation);
 return null;
 }
 const priceNum = parseDecimal(form.price);
 const translations = buildItemTranslations(form.name, form.description, defaultLang);
 const descPrimary = (form.description[defaultLang] || "").trim() || null;
 setSaving(true);
 try {
 let savedId: string;
 if (isNew) {
 const created = await createItem({
 name: namePrimary,
 description: descPrimary,
 price: priceNum,
 imageUrl: form.photoUrl,
 categoryId,
 isActive: form.visible,
 translations,
 allergens: form.allergens,
 options: null,
 });
 savedId = created.id;
 } else if (dish) {
 await updateItem(dish.id, {
 name: namePrimary,
 description: descPrimary,
 price: priceNum,
 imageUrl: form.photoUrl,
 categoryId,
 isActive: form.visible,
 translations,
 allergens: form.allergens,
 options: dish.options,
 });
 savedId = dish.id;
 } else {
 setSaving(false);
 return null;
 }
 if (redirectAfter === "list") {
 onSavedRedirect(savedId);
 } else {
 setSaving(false);
 }
 return savedId;
 } catch {
 setSaving(false);
 return null;
 }
 }

 async function save() {
 track("dash_item_click_save");
 await persist("list");
 }

 async function handleAddOption() {
 const id = await persist("stay");
 if (!id) return;
 if (onOpenOption) {
 onOpenOption(id, null);
 } else if (optionRoutePrefix) {
 router.push(`${optionRoutePrefix(id)}/new`);
 }
 }

 async function handleEditOption(optId: string) {
 const id = await persist("stay");
 if (!id) return;
 if (onOpenOption) {
 onOpenOption(id, optId);
 } else if (optionRoutePrefix) {
 router.push(`${optionRoutePrefix(id)}/${optId}`);
 }
 }

 async function confirmDelete() {
 track("dash_item_click_delete");
 if (!dish) return;
 setDeleting(true);
 try {
 await deleteItem(dish.id);
 onDeletedRedirect();
 } catch {
 setDeleting(false);
 setConfirmOpen(false);
 }
 }

 const titleText = isNew
 ? t("newTitle")
 : (getMlWithFallback(form.name, lang, defaultLang) || tc("untitled"));
 const divider = <div className="border-t border-border my-5" />;

 return (
 <div>
 <EditPageHeader
 onBack={() => {
 track("dash_item_click_back");
 if (isDirty && !saving) { setUnsavedOpen(true); return; }
 onBack();
 }}
 title={titleText}
 breadcrumb={categoryName ? t("breadcrumb") + " / " + categoryName : t("breadcrumb")}
 lang={lang}
 onLangChange={setLang}
 languages={langMetas}
 onSave={save}
 canSave={!saving}
 saving={saving}
 onLangsOpen={() => track("dash_item_click_langs")}
 onLangSelect={() => track("dash_item_click_lang")}
 />

 <div className="max-w-2xl mx-auto space-y-3">
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <div className="flex flex-col-reverse md:flex-row-reverse gap-4 md:gap-5">
 <div className="w-full md:w-[7.6rem] shrink-0">
 <PhotoPicker
 url={form.photoUrl}
 onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
 onAiClick={() => { track("dash_item_click_generate_photo"); setAiOpen(true); }}
 onAddClick={() => track("dash_item_click_add_photo")}
 onRemoveClick={() => track("dash_item_click_delete_photo")}
 inputId="dish-photo"
 width="w-full"
 height="aspect-square"
 />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex gap-5 items-start mb-4">
 <div className="flex-1 min-w-0">
 <TranslatedInput
 id="dish-name"
 label={t("nameLabel")}
 value={form.name}
 lang={lang}
 defaultLang={defaultLang}
 languages={languages}
 onChange={(v) => setForm((f) => ({ ...f, name: v }))}
 placeholder={t("namePlaceholder")}
 onFocus={() => track("dash_item_focus_name_input")}
 />
 </div>
 <div className="w-24 shrink-0">
 <label htmlFor="dish-price" className="block text-sm font-medium text-foreground mb-2.5">
 {t("priceLabel")}
 </label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
 {currencySymbol}
 </span>
 <input
 id="dish-price"
 type="text"
 inputMode="decimal"
 placeholder={t("pricePlaceholder")}
 value={form.price}
 onChange={(e) => setForm((f) => ({ ...f, price: sanitizePriceInput(e.target.value) }))}
 onFocus={() => track("dash_item_focus_price_input")}
 className={inputClass + " pl-6 pr-2 tabular-nums"}
 />
 </div>
 </div>
 </div>
 <TranslatedInput
 id="dish-desc"
 label={t("descLabel")}
 value={form.description}
 lang={lang}
 defaultLang={defaultLang}
 languages={languages}
 onChange={(v) => setForm((f) => ({ ...f, description: v }))}
 placeholder={t("descPlaceholder")}
 multiline
 onFocus={() => track("dash_item_focus_description_input")}
 />
 </div>
 </div>
 </div>

 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <div className="flex items-baseline justify-between gap-3 mb-0.5">
 <div className="text-sm font-medium text-foreground">{t("allergensLabel")}</div>
 {form.allergens.length > 0 ? (
 <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
 {form.allergens.length} {tc("selected")}
 </span>
 ) : null}
 </div>
 <p className="text-xs text-muted-foreground mb-2.5">{t("allergensTip")}</p>
 <div className="flex flex-wrap gap-1.5">
 {ALLERGENS.map((a) => {
 const checked = form.allergens.includes(a.code);
 return (
 <button
 key={a.code}
 type="button"
 onClick={() => {
 track(form.allergens.includes(a.code) ? "dash_item_click_allergen_off" : "dash_item_click_allergen_on");
 toggleAllergen(a.code);
 }}
 className={
 "inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium rounded-md transition-colors " +
 (checked
 ? "bg-foreground text-background"
 : "bg-secondary text-muted-foreground")
 }
 >
 <AllergenIcon code={a.code} className="w-3.5 h-3.5" />
 {tAllergens(a.code as never)}
 </button>
 );
 })}
 </div>
 </div>

 {OPTIONS_ENABLED && (
 <div id="options-section" className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <div className="text-sm font-medium text-foreground">{t("optionsLabel")}</div>
 <p className="text-xs text-muted-foreground mb-2.5 mt-0.5">
 {t("optionsTip")}
 </p>

 {!(optionRoutePrefix || onOpenOption) ? null : dish ? (
 <DishOptionsInline
 dish={dish}
 defaultLang={defaultLang}
 disabled={saving}
 onAddOption={handleAddOption}
 onEditOption={handleEditOption}
 />
 ) : (
 <button
 type="button"
 onClick={handleAddOption}
 disabled={saving}
 className="w-full h-10 text-sm font-medium text-muted-foreground bg-card border border-dashed border-input rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
 >
 {saving ? (
 <div className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
 ) : (
 <PlusIcon size={14} />
 )}
 {t("addOption")}
 </button>
 )}
 </div>
 )}

 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
 <div>
 <div className="text-sm font-medium text-foreground">{t("visibleLabel")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">
 {t("visibleTip")}
 </div>
 </div>
 <ToggleSwitch
 checked={form.visible}
 onChange={() => {
 track("dash_item_click_visible_toggle");
 setForm((f) => ({ ...f, visible: !f.visible }));
 }}
 />
 </label>
 </div>
 </div>

 {!isNew ? (
 <div className="max-w-2xl mx-auto mt-6 flex justify-center">
 <button
 type="button"
 onClick={() => setConfirmOpen(true)}
 className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-red-600 rounded-lg transition-colors"
 >
 <TrashIcon size={13} />
 {t("deleteButton")}
 </button>
 </div>
 ) : null}

 <ConfirmDialog
 open={confirmOpen}
 title={t("deleteTitle")}
 message={deleting ? tc("deleting") : t("deleteMessage")}
 onConfirm={confirmDelete}
 onCancel={() => (deleting ? null : setConfirmOpen(false))}
 />

 <ConfirmDialog
 open={alert !== null}
 singleButton
 title={alert?.title}
 message={alert?.message}
 onCancel={() => setAlert(null)}
 />

 <AiImageModal
 open={aiOpen}
 onClose={() => setAiOpen(false)}
 onUse={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
 endpoint="/api/items/generate-image"
 title={t("aiTitle")}
 defaultPrompt={getMl(form.name, defaultLang)}
 aspect="square"
 eventPrefix="dash_item"
 />

 <UnsavedChangesDialog
 open={unsavedOpen}
 saving={saving}
 onDiscard={() => { setUnsavedOpen(false); onBack(); }}
 onSave={save}
 onClose={() => setUnsavedOpen(false)}
 />
 </div>
 );
}

// ── Options list (rendered inline inside DishForm) ──

function DishOptionsInline({
 dish,
 defaultLang,
 disabled,
 onAddOption,
 onEditOption,
}: {
 dish: Dish;
 defaultLang: string;
 disabled: boolean;
 onAddOption: () => Promise<void>;
 onEditOption: (optionId: string) => Promise<void>;
}) {
 const t = useTranslations("dashboard.dishForm");
 const [busy, setBusy] = useState(false);
 const [options, setOptions] = useState<DishOption[]>(dish.options);

 useEffect(() => {
 setOptions(dish.options);
 }, [dish.options]);

 async function moveOption(idx: number, dir: number) {
 if (busy || disabled) return;
 const next = moveItem(options, idx, dir);
 setOptions(next);
 setBusy(true);
 try {
 const namePrimary = (dish.name[defaultLang] || "").trim();
 const descPrimary = (dish.description[defaultLang] || "").trim() || null;
 const translations = buildItemTranslations(dish.name, dish.description, defaultLang);
 await updateItem(dish.id, {
 name: namePrimary,
 description: descPrimary,
 price: parseDecimal(dish.price),
 imageUrl: dish.photoUrl,
 categoryId: dish.categoryId,
 isActive: dish.visible,
 translations,
 allergens: dish.allergens,
 options: next,
 });
 } catch {
 setOptions(dish.options);
 } finally {
 setBusy(false);
 }
 }

 async function handleAdd() {
 if (busy || disabled) return;
 await onAddOption();
 }

 async function handleEdit(optId: string) {
 if (busy || disabled) return;
 await onEditOption(optId);
 }

 return (
 <>
 {options.length > 0 ? (
 <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
 {options.map((opt, idx) => (
 <OptionRow
 key={opt.id}
 option={opt}
 defaultLang={defaultLang}
 isFirst={idx === 0}
 isLast={idx === options.length - 1}
 onEdit={() => handleEdit(opt.id)}
 onMoveUp={() => moveOption(idx, -1)}
 onMoveDown={() => moveOption(idx, 1)}
 />
 ))}
 </div>
 ) : null}

 <button
 type="button"
 onClick={handleAdd}
 disabled={busy || disabled}
 className={
 "w-full h-10 text-sm font-medium text-muted-foreground bg-card border border-dashed border-input rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed " +
 (options.length > 0 ? "mt-2" : "")
 }
 >
 {busy || disabled ? (
 <div className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
 ) : (
 <PlusIcon size={14} />
 )}
 {t("addOption")}
 </button>
 </>
 );
}

function OptionRow({
 option,
 defaultLang,
 isFirst,
 isLast,
 onEdit,
 onMoveUp,
 onMoveDown,
}: {
 option: DishOption;
 defaultLang: string;
 isFirst: boolean;
 isLast: boolean;
 onEdit: () => void;
 onMoveUp: () => void;
 onMoveDown: () => void;
}) {
 const tc = useTranslations("dashboard.common");
 const to = useTranslations("dashboard.optionForm");
 const typeLabel = option.type === "multi" ? to("typeMulti") : to("typeSingle");
 const reqLabel = option.required ? to("required") : to("optional");
 const variantsCount = option.variants?.length || 0;
 return (
 <div className="flex items-center gap-2 px-3 py-2 transition-colors">
 <div className="flex items-center gap-0.5 shrink-0">
 <button type="button" onClick={onMoveUp} disabled={isFirst} className={iconBtn} aria-label={tc("moveUp")}>
 <ArrowUpIcon size={14} />
 </button>
 <button type="button" onClick={onMoveDown} disabled={isLast} className={iconBtn} aria-label={tc("moveDown")}>
 <ArrowDownIcon size={14} />
 </button>
 </div>
 <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-left">
 <div className="text-sm font-medium text-foreground truncate">
 {getMlWithFallback(option.name, defaultLang, defaultLang) || to("untitledOption")}
 </div>
 <div className="text-xs text-muted-foreground truncate mt-0.5">
 {typeLabel} · {reqLabel} · {variantsCount} {variantsCount === 1 ? to("variantOne") : to("variantOther")}
 </div>
 </button>
 <ChevronRightIcon size={14} className="text-muted-foreground shrink-0" />
 </div>
 );
}

// ── Option form ──

interface OptionFormState {
 name: Ml;
 type: "single" | "multi";
 required: boolean;
 variants: OptionVariant[];
}

export function OptionForm({
 dish,
 option,
 onSavedRedirect,
 onBack,
 onDeletedRedirect,
}: {
 dish: Dish;
 option: DishOption | null;
 onSavedRedirect: () => void;
 onBack: () => void;
 onDeletedRedirect: () => void;
}) {
 const t = useTranslations("dashboard.optionForm");
 const tc = useTranslations("dashboard.common");
 const restaurant = useRestaurant();
 const { defaultLang, languages, currency } = restaurant;
 const currencySymbol = currencySymbolOf(currency);
 const isNew = option === null;

 const [lang, setLang] = useState<string>(defaultLang);
 const [form, setForm] = useState<OptionFormState>(() => ({
 name: option ? option.name : emptyMl(languages),
 type: option ? option.type : "single",
 required: option ? !!option.required : false,
 variants:
 option && option.variants && option.variants.length > 0
 ? option.variants
 : [{ id: newId(), name: emptyMl(languages), priceDelta: "0" }],
 }));
 const [saving, setSaving] = useState(false);
 const [deleting, setDeleting] = useState(false);
 const [confirmOpen, setConfirmOpen] = useState(false);
 const [translatingAll, setTranslatingAll] = useState(false);
 const langMetas = (() => {
 const enabled = AVAILABLE_LANGUAGES.filter((l) => languages.includes(l.code));
 const def = enabled.find((l) => l.code === defaultLang);
 if (!def) return enabled;
 return [def, ...enabled.filter((l) => l.code !== defaultLang)];
 })();

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const namePrimary = (form.name[defaultLang] || "").trim();
 const validVariants = form.variants.filter((v) => (v.name?.[defaultLang] || "").trim().length > 0);
 const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

 function validateForm(): { title: string; message: string } | null {
 if (namePrimary.length === 0 && validVariants.length === 0) {
 return {
 title: t("missingTitle"),
 message: t("missingMessage"),
 };
 }
 if (namePrimary.length === 0) {
 return {
 title: t("nameRequiredTitle"),
 message: t("nameRequiredMessage"),
 };
 }
 if (validVariants.length === 0) {
 return {
 title: t("variantRequiredTitle"),
 message: t("variantRequiredMessage"),
 };
 }
 return null;
 }

 function setVariant(idx: number, patch: Partial<OptionVariant>) {
 setForm((f) => ({
 ...f,
 variants: f.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
 }));
 }
 function addVariant() {
 setForm((f) => ({
 ...f,
 variants: [...f.variants, { id: newId(), name: emptyMl(languages), priceDelta: "0" }],
 }));
 }
 function removeVariant(idx: number) {
 setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }));
 }
 function moveVariant(idx: number, dir: number) {
 setForm((f) => ({ ...f, variants: moveItem(f.variants, idx, dir) }));
 }

 async function translateAllVariants() {
 if (lang === defaultLang || translatingAll) return;
 const targets = form.variants
 .map((v, i) => ({ v, i }))
 .filter(({ v }) => {
 const src = getMl(v.name, defaultLang);
 const cur = getMl(v.name, lang);
 return src.trim().length > 0 && cur.trim().length === 0;
 });
 if (targets.length === 0) return;
 setTranslatingAll(true);
 try {
 const results = await Promise.all(
 targets.map(({ v }) => translateText(getMl(v.name, defaultLang), defaultLang, lang)),
 );
 setForm((f) => {
 const next = f.variants.slice();
 targets.forEach(({ i }, j) => {
 next[i] = { ...next[i], name: setMl(next[i].name, lang, results[j]) };
 });
 return { ...f, variants: next };
 });
 } catch {
 // silent
 } finally {
 setTranslatingAll(false);
 }
 }

 async function save() {
 if (saving) return;
 const validation = validateForm();
 if (validation) {
 setAlert(validation);
 return;
 }
 setSaving(true);
 const normalisedVariants = validVariants.map((v) => ({
 ...v,
 priceDelta: String(v.priceDelta || "0").replace(",", ".").trim() || "0",
 }));
 const data: Omit<DishOption, "id"> = {
 name: form.name,
 type: form.type,
 required: form.required,
 variants: normalisedVariants,
 };
 let nextOptions: DishOption[];
 if (isNew) {
 nextOptions = [...dish.options, { id: newId(), ...data }];
 } else if (option) {
 nextOptions = dish.options.map((o) => (o.id === option.id ? { ...o, ...data } : o));
 } else {
 nextOptions = dish.options;
 }
 try {
 await persistDishOptions(dish, nextOptions, defaultLang);
 onSavedRedirect();
 } catch {
 setSaving(false);
 }
 }

 async function confirmDelete() {
 if (!option) return;
 setDeleting(true);
 const nextOptions = dish.options.filter((o) => o.id !== option.id);
 try {
 await persistDishOptions(dish, nextOptions, defaultLang);
 onDeletedRedirect();
 } catch {
 setDeleting(false);
 setConfirmOpen(false);
 }
 }

 const translatableVariantsCount =
 lang === defaultLang
 ? 0
 : form.variants.filter((v) => {
 const src = getMl(v.name, defaultLang);
 const cur = getMl(v.name, lang);
 return src.trim().length > 0 && cur.trim().length === 0;
 }).length;

 const titleText = isNew
 ? t("newTitle")
 : (getMlWithFallback(form.name, lang, defaultLang) || t("untitledOption"));
 const divider = <div className="border-t border-border my-5" />;
 const dishName = getMlWithFallback(dish.name, defaultLang, defaultLang);

 return (
 <div>
 <EditPageHeader
 onBack={onBack}
 title={titleText}
 breadcrumb={dishName ? t("breadcrumb") + " / " + dishName : t("breadcrumb")}
 lang={lang}
 onLangChange={setLang}
 languages={langMetas}
 onSave={save}
 canSave={!saving}
 saving={saving}
 />

 <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-5 md:p-6">
 <TranslatedInput
 id="opt-name"
 label={t("nameLabel")}
 value={form.name}
 lang={lang}
 defaultLang={defaultLang}
 languages={languages}
 onChange={(v) => setForm((f) => ({ ...f, name: v }))}
 placeholder={t("namePlaceholder")}
 />

 {divider}

 <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
 <div>
 <div className="text-sm font-medium text-foreground">{t("multiLabel")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">
 {t("multiTip")}
 </div>
 </div>
 <ToggleSwitch
 checked={form.type === "multi"}
 onChange={() => {
 setForm((f) => ({ ...f, type: f.type === "multi" ? "single" : "multi" }));
 }}
 />
 </label>

 {divider}

 <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
 <div>
 <div className="text-sm font-medium text-foreground">{t("requiredLabel")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">
 {t("requiredTip")}
 </div>
 </div>
 <ToggleSwitch
 checked={form.required}
 onChange={() => {
 setForm((f) => ({ ...f, required: !f.required }));
 }}
 />
 </label>

 {divider}

 <div className="flex items-center justify-between gap-2 mb-0.5">
 <div className="text-sm font-medium text-foreground">{t("variantsLabel")}</div>
 {lang !== defaultLang && translatableVariantsCount > 0 ? (
 <button
 type="button"
 onClick={translateAllVariants}
 disabled={translatingAll}
 className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors disabled:text-muted-foreground/50 disabled:cursor-not-allowed"
 >
 {translatingAll ? tc("translating") : tc("translateAll")}
 </button>
 ) : null}
 </div>
 <p className="text-xs text-muted-foreground mb-2.5">
 {t("variantsTip")}
 </p>
 <div className="space-y-2">
 {form.variants.map((variant, idx) => (
 <VariantRow
 key={variant.id}
 variant={variant}
 lang={lang}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 isFirst={idx === 0}
 isLast={idx === form.variants.length - 1}
 canRemove={form.variants.length > 1}
 onChange={(patch) => setVariant(idx, patch)}
 onRemove={() => removeVariant(idx)}
 onMoveUp={() => moveVariant(idx, -1)}
 onMoveDown={() => moveVariant(idx, 1)}
 />
 ))}
 </div>

 <button
 type="button"
 onClick={addVariant}
 className="w-full mt-3 h-10 text-sm font-medium text-muted-foreground bg-card border border-dashed border-input rounded-lg flex items-center justify-center gap-1.5 transition-colors"
 >
 <PlusIcon size={14} />
 {t("addVariant")}
 </button>
 </div>

 {!isNew ? (
 <div className="max-w-2xl mx-auto mt-6 flex justify-center">
 <button
 type="button"
 onClick={() => setConfirmOpen(true)}
 className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-red-600 rounded-lg transition-colors"
 >
 <TrashIcon size={13} />
 {t("deleteButton")}
 </button>
 </div>
 ) : null}

 <ConfirmDialog
 open={confirmOpen}
 title={t("deleteTitle")}
 message={deleting ? tc("deleting") : t("deleteMessage")}
 onConfirm={confirmDelete}
 onCancel={() => (deleting ? null : setConfirmOpen(false))}
 />

 <ConfirmDialog
 open={alert !== null}
 singleButton
 title={alert?.title}
 message={alert?.message}
 onCancel={() => setAlert(null)}
 />
 </div>
 );
}

function VariantRow({
 variant,
 lang,
 defaultLang,
 currencySymbol,
 isFirst,
 isLast,
 canRemove,
 onChange,
 onRemove,
 onMoveUp,
 onMoveDown,
}: {
 variant: OptionVariant;
 lang: string;
 defaultLang: string;
 currencySymbol: string;
 isFirst: boolean;
 isLast: boolean;
 canRemove: boolean;
 onChange: (patch: Partial<OptionVariant>) => void;
 onRemove: () => void;
 onMoveUp: () => void;
 onMoveDown: () => void;
}) {
 const tc = useTranslations("dashboard.common");
 const t = useTranslations("dashboard.optionForm");
 return (
 <div className="flex items-center gap-1 md:gap-2">
 <div className="flex items-center gap-0.5 shrink-0">
 <button type="button" onClick={onMoveUp} disabled={isFirst} className={iconBtn} aria-label={tc("moveUp")}>
 <ArrowUpIcon size={14} />
 </button>
 <button type="button" onClick={onMoveDown} disabled={isLast} className={iconBtn} aria-label={tc("moveDown")}>
 <ArrowDownIcon size={14} />
 </button>
 </div>
 <div className="flex-1 min-w-0">
 <input
 type="text"
 value={getMl(variant.name, lang)}
 onChange={(e) => onChange({ name: setMl(variant.name, lang, e.target.value) })}
 placeholder={
 lang !== defaultLang && getMl(variant.name, defaultLang)
 ? tc("willUse") + ": " + getMl(variant.name, defaultLang)
 : t("variantNamePlaceholder")
 }
 className={inputClass}
 />
 </div>
 <div className="w-16 md:w-20 shrink-0 relative">
 <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
 {currencySymbol}
 </span>
 <input
 type="text"
 inputMode="decimal"
 value={variant.priceDelta}
 onChange={(e) => onChange({ priceDelta: sanitizePriceInput(e.target.value) })}
 placeholder="0"
 title={t("priceModifier")}
 className={inputClass + " pl-5 pr-1 tabular-nums"}
 />
 </div>
 <button
 type="button"
 onClick={onRemove}
 disabled={!canRemove}
 className={iconBtn + " shrink-0"}
 aria-label={t("removeVariant")}
 >
 <TrashIcon size={14} />
 </button>
 </div>
 );
}

async function persistDishOptions(dish: Dish, nextOptions: DishOption[], defaultLang: string) {
 const namePrimary = (dish.name[defaultLang] || "").trim();
 const descPrimary = (dish.description[defaultLang] || "").trim() || null;
 const translations = buildItemTranslations(dish.name, dish.description, defaultLang);
 await updateItem(dish.id, {
 name: namePrimary,
 description: descPrimary,
 price: parseFloat(dish.price),
 imageUrl: dish.photoUrl,
 categoryId: dish.categoryId,
 isActive: dish.visible,
 translations,
 allergens: dish.allergens,
 options: nextOptions,
 });
}

function UnsavedChangesDialog({
 open,
 saving,
 onDiscard,
 onSave,
 onClose,
}: {
 open: boolean;
 saving: boolean;
 onDiscard: () => void;
 onSave: () => void | Promise<void>;
 onClose: () => void;
}) {
 const t = useTranslations("dashboard.common");
 useScrollLock(open);
 if (!open) return null;
 return (
 <div onClick={() => !saving && onClose()} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
 <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl">
 <div className="px-5 py-4 border-b border-border">
 <h3 className="text-base font-semibold text-foreground">{t("unsavedTitle")}</h3>
 </div>
 <p className="px-5 py-4 text-sm text-muted-foreground leading-relaxed">{t("unsavedMessage")}</p>
 <div className="px-5 py-4 border-t border-border flex items-center gap-2">
 <button
 type="button"
 onClick={onDiscard}
 disabled={saving}
 className="flex-1 h-10 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-muted/40 disabled:opacity-50"
 >
 {t("discard")}
 </button>
 <button
 type="button"
 onClick={() => void onSave()}
 disabled={saving}
 className="flex-1 h-10 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 inline-flex items-center justify-center gap-2 disabled:opacity-60"
 >
 {saving ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
 {t("save")}
 </button>
 </div>
 </div>
 </div>
 );
}
