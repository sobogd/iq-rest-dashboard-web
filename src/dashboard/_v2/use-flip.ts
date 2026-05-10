import { useLayoutEffect, useRef } from "react";

const REDUCED_MOTION = typeof window !== "undefined"
 && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useFlip<T extends HTMLElement>(deps: unknown[]) {
 const ref = useRef<T>(null);
 const prev = useRef<Map<string, { top: number; height: number }>>(new Map());

 useLayoutEffect(() => {
   const root = ref.current;
   if (!root) return;
   // If the container is hidden (e.g. inside a collapsed accordion), child
   // rects are unreliable — skip capturing entirely so the next visible
   // run gets fresh measurements.
   const rootRect = root.getBoundingClientRect();
   if (rootRect.width === 0 || rootRect.height === 0) return;
   // Measure positions RELATIVE to the root container, not the viewport.
   // Viewport-relative rects shift on scroll, which makes the first reorder
   // after scrolling animate every child by scrollDelta instead of only the
   // ones that actually moved.
   const rootTop = rootRect.top;
   const children = root.querySelectorAll<HTMLElement>(":scope > [data-flip-id]");
   const next = new Map<string, { top: number; height: number }>();
   children.forEach((el) => {
     const r = el.getBoundingClientRect();
     next.set(el.dataset.flipId!, { top: r.top - rootTop, height: r.height });
   });
   if (!REDUCED_MOTION) {
     children.forEach((el) => {
       const id = el.dataset.flipId!;
       const before = prev.current.get(id);
       const after = next.get(id)!;
       if (!before) return;
       if (before.height === 0 || after.height === 0) return;
       const dy = before.top - after.top;
       if (dy === 0) return;
       el.animate(
         [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
         { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" },
       );
     });
   }
   prev.current = next;
 }, deps);

 return ref;
}
