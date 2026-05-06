"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, X } from "lucide-react";
import { Modal } from "./ui";
import { primaryBtn } from "./tokens";
import { dismissScanBanner, scanMenuParse, scanMenuSave, type ScanMenuCategory } from "./api";
import { track } from "@/lib/dashboard-events";

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 5;

interface PoolPhoto {
 id: string;
 file: File;
 preview: string;
}

type Stage = "upload" | "loading" | "review" | "confirm" | "saving";

interface ScanModalProps {
 open: boolean;
 onClose: () => void;
 existingRealItemsCount: number;
 onSaved: () => void;
}

function isHeic(file: File): boolean {
 return (
  file.type === "image/heic" ||
  file.type === "image/heif" ||
  file.name.toLowerCase().endsWith(".heic") ||
  file.name.toLowerCase().endsWith(".heif")
 );
}

function fileToBase64(file: File): Promise<string> {
 return new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
 });
}

async function convertHeicToBase64(file: File): Promise<string> {
 const heic2any = (await import("heic2any")).default as (opts: {
  blob: Blob;
  toType: string;
  quality?: number;
 }) => Promise<Blob | Blob[]>;
 const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
 const jpegBlob = Array.isArray(blob) ? blob[0] : blob;
 return fileToBase64(new File([jpegBlob], "photo.jpg", { type: "image/jpeg" }));
}

function fileToJpegBase64(file: File): Promise<string> {
 return isHeic(file) ? convertHeicToBase64(file) : fileToBase64(file);
}

export function ScanModal({ open, onClose, existingRealItemsCount, onSaved }: ScanModalProps) {
 const t = useTranslations("dashboard.menu.scan");
 const fileInputRef = useRef<HTMLInputElement>(null);

 const [stage, setStage] = useState<Stage>("upload");
 const [photoPool, setPhotoPool] = useState<PoolPhoto[]>([]);
 const [error, setError] = useState("");
 const [parsed, setParsed] = useState<ScanMenuCategory[]>([]);
 const [selected, setSelected] = useState<Record<string, boolean>>({});

 useEffect(() => {
  if (open) track("dash_scan_modal_open");
 }, [open]);

 function handleClose() {
  track("dash_scan_modal_close", { stage });
  photoPool.forEach((p) => {
   if (p.preview.startsWith("blob:")) URL.revokeObjectURL(p.preview);
  });
  setStage("upload");
  setPhotoPool([]);
  setError("");
  setParsed([]);
  setSelected({});
  onClose();
 }

 function addFilesToPool(files: FileList | null) {
  if (!files || files.length === 0) return;
  const remaining = MAX_FILES - photoPool.length;
  if (remaining <= 0) {
   track("dash_scan_file_error", { reason: "too_many" });
   setError(t("upload.errorTooMany"));
   return;
  }
  const accepted = Array.from(files).slice(0, remaining);
  for (const file of accepted) {
   if (file.size > MAX_SIZE) {
    track("dash_scan_file_error", { reason: "too_large" });
    setError(t("upload.errorTooLarge"));
    return;
   }
  }
  track("dash_scan_file_added", { count: String(accepted.length) });
  const newPhotos: PoolPhoto[] = accepted.map((file) => {
   const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
   return {
    id: Math.random().toString(36).substring(2, 10),
    file,
    preview: isPdf ? "pdf" : isHeic(file) ? "heic" : URL.createObjectURL(file),
   };
  });
  setPhotoPool((prev) => [...prev, ...newPhotos]);
  setError("");

  const heicPhotos = newPhotos.filter((p) => p.preview === "heic");
  if (heicPhotos.length > 0) {
   void Promise.all(
    heicPhotos.map(async (p) => {
     try {
      const base64 = await convertHeicToBase64(p.file);
      setPhotoPool((prev) => prev.map((item) => (item.id === p.id ? { ...item, preview: base64 } : item)));
     } catch {
      // fallback — file stays as "heic" placeholder
     }
    }),
   );
  }
  if (fileInputRef.current) fileInputRef.current.value = "";
 }

 function removeFromPool(id: string) {
  track("dash_scan_file_removed");
  setPhotoPool((prev) => {
   const removed = prev.find((p) => p.id === id);
   if (removed && removed.preview.startsWith("blob:")) URL.revokeObjectURL(removed.preview);
   return prev.filter((p) => p.id !== id);
  });
 }

 const handleStartScan = useCallback(async () => {
  if (photoPool.length === 0) return;
  track("dash_scan_start", { files: String(photoPool.length) });
  setError("");
  setStage("loading");
  try {
   const images = await Promise.all(
    photoPool.map((p) => {
     const isPdf = p.file.type === "application/pdf" || p.file.name.toLowerCase().endsWith(".pdf");
     return isPdf ? fileToBase64(p.file) : fileToJpegBase64(p.file);
    }),
   );
   const result = await scanMenuParse(images);
   if (!result.ok) {
    track("dash_scan_parse_error", { error: result.error });
    if (result.error === "not_a_menu") setError(t("upload.errorNotMenu"));
    else if (result.error === "too_large") setError(t("upload.errorTooLarge"));
    else if (result.error === "too_many_images") setError(t("upload.errorTooMany"));
    else setError(t("upload.errorScan"));
    setStage("upload");
    return;
   }
   const categories = result.categories;
   const totalItems = categories.reduce((s, c) => s + c.items.length, 0);
   track("dash_scan_parse_success", { cats: String(categories.length), items: String(totalItems) });
   setParsed(categories);
   const sel: Record<string, boolean> = {};
   categories.forEach((cat, i) => {
    cat.items.forEach((_, j) => {
     sel[`${i}:${j}`] = true;
    });
   });
   setSelected(sel);
   setStage("review");
  } catch (e) {
   track("dash_scan_parse_error", { error: "exception", detail: String(e) });
   setError(t("upload.errorScan"));
   setStage("upload");
  }
 }, [photoPool, t]);

 function toggleItem(key: string) {
  setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
 }

 function getSelectedCount() {
  return Object.values(selected).filter(Boolean).length;
 }

 function buildSelectedCategories(): ScanMenuCategory[] {
  return parsed
   .map((cat, i) => ({
    name: cat.name,
    items: cat.items.filter((_, j) => selected[`${i}:${j}`]),
   }))
   .filter((c) => c.items.length > 0);
 }

 function proceedFromReview() {
  if (getSelectedCount() === 0) return;
  track("dash_scan_review_continue", {
   selected: String(getSelectedCount()),
   needsConfirm: existingRealItemsCount > 0 ? "1" : "0",
  });
  if (existingRealItemsCount > 0) {
   setStage("confirm");
  } else {
   void save(false);
  }
 }

 async function save(replaceExisting: boolean) {
  const categories = buildSelectedCategories();
  if (categories.length === 0) return;
  track("dash_scan_save_start", {
   mode: replaceExisting ? "replace" : "keep",
   cats: String(categories.length),
  });
  setStage("saving");
  const result = await scanMenuSave(categories, replaceExisting);
  if (!result.ok) {
   track("dash_scan_save_error", { error: result.error });
   setError(result.error);
   setStage("review");
   return;
  }
  track("dash_scan_save_success", {
   mode: replaceExisting ? "replace" : "keep",
   cats: String(result.categoriesCount),
   items: String(result.itemsCount),
  });
  // Auto-dismiss banner after a successful scan — user is done with the feature.
  try { await dismissScanBanner(); } catch { /* ignore */ }
  onSaved();
  handleClose();
 }

 const selectedCount = getSelectedCount();
 const totalItems = parsed.reduce((sum, c) => sum + c.items.length, 0);

 const title =
  stage === "upload" ? t("title.upload") :
  stage === "loading" ? t("title.loading") :
  stage === "review" ? t("title.review") :
  stage === "confirm" ? t("title.confirm") :
  t("title.saving");

 const footer =
  stage === "upload" ? (
   <button
    type="button"
    className={primaryBtn + " w-full h-10 hover:bg-primary/90 active:scale-[0.99] transition-all disabled:bg-input disabled:text-muted-foreground disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:bg-input"}
    disabled={photoPool.length === 0}
    onClick={() => void handleStartScan()}
   >
    {t("upload.scan")}
   </button>
  ) : stage === "review" ? (
   <button
    type="button"
    className={primaryBtn + " w-full h-10"}
    disabled={selectedCount === 0}
    onClick={proceedFromReview}
   >
    {t("review.continue", { n: selectedCount })}
   </button>
  ) : null;

 return (
  <Modal open={open} onClose={handleClose} title={title} size="md" footer={footer}>
   {stage === "upload" && (
    <div className="flex flex-col gap-3">
     <p className="text-sm text-muted-foreground leading-relaxed">{t("upload.description")}</p>
     <input
      ref={fileInputRef}
      type="file"
      accept="image/*,.heic,.heif,image/heic,image/heif,.pdf,application/pdf"
      multiple
      className="hidden"
      onChange={(e) => addFilesToPool(e.target.files)}
     />
     <div className="flex flex-col gap-2">
      {photoPool.map((photo) => (
       <div
        key={photo.id}
        className="flex items-center gap-3 w-full h-12 rounded-xl border border-border bg-muted/30 pl-2 pr-1"
       >
        {photo.preview === "pdf" || photo.preview === "heic" ? (
         <span className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg bg-muted text-[10px] font-mono font-semibold text-muted-foreground">
          {photo.preview === "pdf" ? "PDF" : "HEIC"}
         </span>
        ) : (
         // eslint-disable-next-line @next/next/no-img-element
         <img src={photo.preview} alt="" className="w-8 h-8 shrink-0 rounded-lg object-cover" />
        )}
        <p className="text-sm font-medium truncate min-w-0 flex-1">{photo.file.name}</p>
        <button
         type="button"
         aria-label="Remove"
         onClick={() => removeFromPool(photo.id)}
         className="h-8 w-8 shrink-0 rounded-md hover:bg-muted/60 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
         <X className="w-4 h-4" strokeWidth={2} />
        </button>
       </div>
      ))}
      {photoPool.length < MAX_FILES && (
       <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40 px-4 transition-all"
       >
        <ImagePlus className="w-5 h-5 text-muted-foreground/70" strokeWidth={1.5} />
        <span className="text-sm font-medium text-foreground/80">{t("upload.addFile")}</span>
       </button>
      )}
     </div>
     {photoPool.length < MAX_FILES && (
      <p className="text-xs text-muted-foreground/70 text-center leading-relaxed px-2">
       {t("upload.hint")}
      </p>
     )}
     {error && <p className="text-sm text-destructive font-medium text-center">{error}</p>}
    </div>
   )}

   {stage === "loading" && (
    <div className="flex flex-col items-center gap-4 py-12">
     <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
     <p className="text-sm font-medium">{t("loading.primary")}</p>
     <p className="text-xs text-muted-foreground/60">{t("loading.secondary")}</p>
    </div>
   )}

   {stage === "review" && (
    <div className="flex flex-col gap-4">
     <p className="text-sm text-muted-foreground">
      {t("review.description", { total: totalItems, cats: parsed.length })}
     </p>
     {parsed.map((cat, i) => (
      <div key={i} className="rounded-xl border border-border overflow-hidden">
       <div className="px-3 py-2 bg-muted/50 text-sm font-semibold">{cat.name}</div>
       <div className="divide-y divide-border">
        {cat.items.map((item, j) => {
         const key = `${i}:${j}`;
         const checked = !!selected[key];
         return (
          <label key={j} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30">
           <input
            type="checkbox"
            checked={checked}
            onChange={() => toggleItem(key)}
            className="w-4 h-4 mt-0.5 shrink-0 accent-primary"
           />
           <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
             <span className="text-sm font-medium truncate">{item.name}</span>
             {item.price > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">{item.price.toFixed(2)}</span>
             )}
            </div>
            {item.description && (
             <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
            )}
           </div>
          </label>
         );
        })}
       </div>
      </div>
     ))}
     {error && <p className="text-sm text-destructive font-medium text-center">{error}</p>}
    </div>
   )}

   {stage === "confirm" && (
    <div className="flex flex-col gap-4 py-2">
     <p className="text-sm">{t("confirm.prompt", { existing: existingRealItemsCount })}</p>
     <div className="flex flex-col gap-2">
      <button
       type="button"
       onClick={() => void save(true)}
       className="w-full rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 p-4 text-left transition-colors"
      >
       <div className="text-sm font-semibold text-destructive">{t("confirm.replaceTitle")}</div>
       <div className="text-xs text-muted-foreground mt-1">
        {t("confirm.replaceDescription", { existing: existingRealItemsCount, selected: selectedCount })}
       </div>
      </button>
      <button
       type="button"
       onClick={() => void save(false)}
       className="w-full rounded-xl border border-border hover:bg-muted/30 p-4 text-left transition-colors"
      >
       <div className="text-sm font-semibold">{t("confirm.keepTitle")}</div>
       <div className="text-xs text-muted-foreground mt-1">
        {t("confirm.keepDescription", { selected: selectedCount })}
       </div>
      </button>
     </div>
     <p className="text-[11px] text-muted-foreground text-center">{t("confirm.examplesNote")}</p>
    </div>
   )}

   {stage === "saving" && (
    <div className="flex flex-col items-center gap-4 py-12">
     <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
     <p className="text-sm font-medium">{t("saving.primary")}</p>
    </div>
   )}
  </Modal>
 );
}
