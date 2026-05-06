"use client";

import { useState, useRef, useCallback } from "react";
import { Modal } from "./ui";
import { primaryBtn } from "./tokens";
import { scanMenuParse, scanMenuSave, type ScanMenuCategory } from "./api";

const MAX_SIZE = 100 * 1024 * 1024;
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
 const fileInputRef = useRef<HTMLInputElement>(null);

 const [stage, setStage] = useState<Stage>("upload");
 const [photoPool, setPhotoPool] = useState<PoolPhoto[]>([]);
 const [error, setError] = useState("");
 const [parsed, setParsed] = useState<ScanMenuCategory[]>([]);
 const [selected, setSelected] = useState<Record<string, boolean>>({});
 const [resultMessage, setResultMessage] = useState("");

 function handleClose() {
  photoPool.forEach((p) => {
   if (p.preview.startsWith("blob:")) URL.revokeObjectURL(p.preview);
  });
  setStage("upload");
  setPhotoPool([]);
  setError("");
  setParsed([]);
  setSelected({});
  setResultMessage("");
  onClose();
 }

 function addFilesToPool(files: FileList | null) {
  if (!files || files.length === 0) return;
  const remaining = MAX_FILES - photoPool.length;
  if (remaining <= 0) {
   setError("Maximum 5 files");
   return;
  }
  const accepted = Array.from(files).slice(0, remaining);
  for (const file of accepted) {
   if (file.size > MAX_SIZE) {
    setError("File too large (max 100 MB)");
    return;
   }
  }
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
  setPhotoPool((prev) => {
   const removed = prev.find((p) => p.id === id);
   if (removed && removed.preview.startsWith("blob:")) URL.revokeObjectURL(removed.preview);
   return prev.filter((p) => p.id !== id);
  });
 }

 const handleStartScan = useCallback(async () => {
  if (photoPool.length === 0) return;
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
    if (result.error === "not_a_menu") setError("Image is not a menu");
    else if (result.error === "too_large") setError("File too large");
    else if (result.error === "too_many_images") setError("Maximum 5 files");
    else setError("Failed to scan menu");
    setStage("upload");
    return;
   }
   const categories = result.categories;
   setParsed(categories);
   const sel: Record<string, boolean> = {};
   categories.forEach((cat, i) => {
    cat.items.forEach((_, j) => {
     sel[`${i}:${j}`] = true;
    });
   });
   setSelected(sel);
   setStage("review");
  } catch {
   setError("Failed to scan menu");
   setStage("upload");
  }
 }, [photoPool]);

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
  if (existingRealItemsCount > 0) {
   setStage("confirm");
  } else {
   void save(false);
  }
 }

 async function save(replaceExisting: boolean) {
  const categories = buildSelectedCategories();
  if (categories.length === 0) return;
  setStage("saving");
  const result = await scanMenuSave(categories, replaceExisting);
  if (!result.ok) {
   setError(result.error);
   setStage("review");
   return;
  }
  setResultMessage(`Added ${result.itemsCount} items in ${result.categoriesCount} categories`);
  onSaved();
  handleClose();
 }

 const selectedCount = getSelectedCount();
 const totalItems = parsed.reduce((sum, c) => sum + c.items.length, 0);

 const title =
  stage === "upload" ? "Upload menu" :
  stage === "loading" ? "Analyzing menu…" :
  stage === "review" ? "Review parsed menu" :
  stage === "confirm" ? "Replace existing menu?" :
  "Saving…";

 return (
  <Modal open={open} onClose={handleClose} title={title} size="lg">
   {stage === "upload" && (
    <div className="flex flex-col gap-3">
     <p className="text-sm text-muted-foreground">
      Upload photos or a PDF of your paper menu. AI will parse it into categories and items.
     </p>
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
       <div key={photo.id} className="flex items-center gap-3 w-full rounded-xl border border-border bg-muted/30 p-3">
        {photo.preview === "pdf" || photo.preview === "heic" ? (
         <span className="text-xs font-mono text-muted-foreground">
          {photo.preview === "pdf" ? "PDF" : "…"}
         </span>
        ) : (
         // eslint-disable-next-line @next/next/no-img-element
         <img src={photo.preview} alt="" className="w-8 h-8 shrink-0 rounded-lg object-cover" />
        )}
        <p className="text-sm font-medium truncate min-w-0 flex-1">{photo.file.name}</p>
        <button
         type="button"
         onClick={() => removeFromPool(photo.id)}
         className="h-8 w-8 shrink-0 rounded-md hover:bg-muted/50 inline-flex items-center justify-center text-muted-foreground"
        >
         ×
        </button>
       </div>
      ))}
      {photoPool.length < MAX_FILES && (
       <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-border p-4 hover:border-muted-foreground/30 transition-all"
       >
        <span className="text-sm font-medium text-muted-foreground/70">+ Add file</span>
       </button>
      )}
     </div>
     {error && <p className="text-sm text-destructive font-medium text-center">{error}</p>}
     <button
      type="button"
      className={primaryBtn + " w-full h-10"}
      disabled={photoPool.length === 0}
      onClick={() => void handleStartScan()}
     >
      Scan
     </button>
    </div>
   )}

   {stage === "loading" && (
    <div className="flex flex-col items-center gap-4 py-12">
     <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
     <p className="text-sm font-medium">Analyzing your menu…</p>
     <p className="text-xs text-muted-foreground/60">This may take up to a minute</p>
    </div>
   )}

   {stage === "review" && (
    <div className="flex flex-col gap-4">
     <p className="text-sm text-muted-foreground">
      AI parsed {totalItems} items in {parsed.length} categories. Uncheck the ones you don&apos;t want.
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
     <button
      type="button"
      className={primaryBtn + " w-full h-10"}
      disabled={selectedCount === 0}
      onClick={proceedFromReview}
     >
      Continue ({selectedCount} selected)
     </button>
    </div>
   )}

   {stage === "confirm" && (
    <div className="flex flex-col gap-4 py-2">
     <p className="text-sm">
      You have <span className="font-semibold">{existingRealItemsCount}</span> items already in your menu.
      What should happen with them?
     </p>
     <div className="flex flex-col gap-2">
      <button
       type="button"
       onClick={() => void save(true)}
       className="w-full rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 p-4 text-left transition-colors"
      >
       <div className="text-sm font-semibold text-destructive">Replace existing menu</div>
       <div className="text-xs text-muted-foreground mt-1">
        Delete all {existingRealItemsCount} existing items and keep only the new {selectedCount}.
       </div>
      </button>
      <button
       type="button"
       onClick={() => void save(false)}
       className="w-full rounded-xl border border-border hover:bg-muted/30 p-4 text-left transition-colors"
      >
       <div className="text-sm font-semibold">Keep existing &amp; add new</div>
       <div className="text-xs text-muted-foreground mt-1">
        Add the new {selectedCount} items on top of your current menu.
       </div>
      </button>
     </div>
     <p className="text-[11px] text-muted-foreground text-center">
      Example items will be removed in both cases.
     </p>
    </div>
   )}

   {stage === "saving" && (
    <div className="flex flex-col items-center gap-4 py-12">
     <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
     <p className="text-sm font-medium">{resultMessage || "Saving menu…"}</p>
    </div>
   )}
  </Modal>
 );
}
