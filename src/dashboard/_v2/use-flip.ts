import { useLayoutEffect, useRef } from "react";

const REDUCED_MOTION = typeof window !== "undefined"
 && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useFlip<T extends HTMLElement>(deps: unknown[]) {
 const ref = useRef<T>(null);
 const prev = useRef<Map<string, DOMRect>>(new Map());

 useLayoutEffect(() => {
   const root = ref.current;
   if (!root) return;
   const children = root.querySelectorAll<HTMLElement>(":scope > [data-flip-id]");
   const next = new Map<string, DOMRect>();
   children.forEach((el) => next.set(el.dataset.flipId!, el.getBoundingClientRect()));
   if (!REDUCED_MOTION) {
     children.forEach((el) => {
       const id = el.dataset.flipId!;
       const before = prev.current.get(id);
       const after = next.get(id)!;
       if (!before) return;
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
