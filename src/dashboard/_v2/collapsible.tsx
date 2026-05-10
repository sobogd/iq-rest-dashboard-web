import { useLayoutEffect, useRef } from "react";

const REDUCED_MOTION = typeof window !== "undefined"
 && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const DURATION = 200;
const EASING = "cubic-bezier(0.2, 0, 0, 1)";

export function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
 const outerRef = useRef<HTMLDivElement>(null);
 const innerRef = useRef<HTMLDivElement>(null);
 const isFirstRun = useRef(true);

 useLayoutEffect(() => {
   const outer = outerRef.current;
   const inner = innerRef.current;
   if (!outer || !inner) return;

   if (isFirstRun.current) {
     isFirstRun.current = false;
     outer.style.height = open ? "auto" : "0px";
     return;
   }

   if (REDUCED_MOTION) {
     outer.style.height = open ? "auto" : "0px";
     return;
   }

   // Capture current rendered height (handles in-flight animations).
   const currentH = outer.getBoundingClientRect().height;
   const targetH = open ? inner.scrollHeight : 0;

   if (currentH === targetH) {
     outer.style.height = open ? "auto" : "0px";
     return;
   }

   const anim = outer.animate(
     [{ height: currentH + "px" }, { height: targetH + "px" }],
     { duration: DURATION, easing: EASING, fill: "forwards" },
   );
   anim.onfinish = () => {
     anim.cancel();
     outer.style.height = open ? "auto" : "0px";
   };

   return () => {
     // Component unmount or open changes again — cancel and let next effect take over.
     anim.cancel();
   };
 }, [open]);

 return (
   <div ref={outerRef} style={{ overflow: "hidden" }}>
     <div ref={innerRef}>{children}</div>
   </div>
 );
}
