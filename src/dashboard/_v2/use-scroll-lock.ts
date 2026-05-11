import { useEffect } from "react";

// Counts how many modal-style overlays are open. While count > 0 we lock
// overflow on BOTH <html> and <body> so background content can't scroll
// behind a modal (the dashboard chrome forces overflow-y:scroll on <html>,
// so locking body alone isn't enough).
let lockCount = 0;
let prevHtmlOverflow: string | null = null;
let prevBodyOverflow: string | null = null;
let prevBodyPaddingRight: string | null = null;

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;
    if (lockCount === 0) {
      const body = document.body;
      const html = document.documentElement;
      const scrollbarWidth = window.innerWidth - html.clientWidth;
      prevHtmlOverflow = html.style.overflow;
      prevBodyOverflow = body.style.overflow;
      prevBodyPaddingRight = body.style.paddingRight;
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        const current = parseInt(body.style.paddingRight || "0", 10) || 0;
        body.style.paddingRight = `${current + scrollbarWidth}px`;
      }
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.documentElement.style.overflow = prevHtmlOverflow ?? "";
        document.body.style.overflow = prevBodyOverflow ?? "";
        document.body.style.paddingRight = prevBodyPaddingRight ?? "";
        prevHtmlOverflow = null;
        prevBodyOverflow = null;
        prevBodyPaddingRight = null;
      }
    };
  }, [active]);
}
