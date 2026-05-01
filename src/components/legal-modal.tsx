import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  COOKIE_POLICY_TITLE,
  COOKIE_POLICY_SECTIONS,
  TERMS_TITLE,
  TERMS_SECTIONS,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_SECTIONS,
} from "@/lib/legal-text";

export type LegalView = "policy" | "terms" | "privacy" | null;

interface LegalModalProps {
  view: LegalView;
  onClose: () => void;
}

/** Self-contained modal that overlays the auth/create-flow wizard with the full English Cookie
 *  Policy or Terms of Service. ESC, backdrop click, and the close button all dismiss. */
export function LegalModal({ view, onClose }: LegalModalProps) {
  // Keep onClose in a ref so the effect below only re-runs when `view` flips, not on every
  // parent render. Otherwise the cleanup that restores body.overflow could run mid-open and
  // leave the body locked, which would intercept clicks even after the modal closes.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (view === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [view]);

  if (view === null) return null;

  const sections =
    view === "policy" ? COOKIE_POLICY_SECTIONS :
    view === "privacy" ? PRIVACY_POLICY_SECTIONS :
    TERMS_SECTIONS;
  const title =
    view === "policy" ? COOKIE_POLICY_TITLE :
    view === "privacy" ? PRIVACY_POLICY_TITLE :
    TERMS_TITLE;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm leading-relaxed">
          {sections.map((sec, i) => (
            <section key={i} className="space-y-2">
              {sec.heading && (
                <h3 className="text-base font-semibold text-foreground mt-4">{sec.heading}</h3>
              )}
              {sec.paragraphs.map((p, j) => (
                <p key={j} className="text-muted-foreground whitespace-pre-line">{p}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
