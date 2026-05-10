import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { primaryBtn, secondaryBtn } from "./tokens";
import { ChevronRightIcon } from "./icons";
import { track } from "@/lib/dashboard-events";

const STORAGE_KEY = "iq-onboarding:menu:v3";

interface Step {
 name: string;
 selector: string;
 textKey: string;
}

const STEPS: Step[] = [
 { name: "add-category", selector: '[data-onboarding-target="add-category"]', textKey: "step.addCategory" },
 { name: "add-dish", selector: '[data-onboarding-target="add-dish"]', textKey: "step.addDish" },
 { name: "edit", selector: '[data-onboarding-target="edit"]', textKey: "step.edit" },
 { name: "toggle-dish", selector: '[data-onboarding-target="toggle-dish"]', textKey: "step.toggleDish" },
 { name: "sort", selector: '[data-onboarding-target="sort"]', textKey: "step.sort" },
 { name: "preview", selector: '[data-onboarding-target="preview"]', textKey: "step.preview" },
 { name: "share", selector: '[data-onboarding-target="share"]', textKey: "step.share" },
];

export function MenuOnboarding({ onActive }: { onActive?: () => void } = {}) {
 const t = useTranslations("dashboard.menu.onboarding");
 const [done, setDone] = useState<boolean>(() => {
 if (typeof window === "undefined") return true;
 try {
 return window.localStorage.getItem(STORAGE_KEY) === "1";
 } catch {
 return true;
 }
 });
 const [stepIdx, setStepIdx] = useState(0);
 const [rect, setRect] = useState<DOMRect | null>(null);

 const step = STEPS[stepIdx];
 const isLast = stepIdx === STEPS.length - 1;

 useLayoutEffect(() => {
 if (done) return;
 let skipTimer = 0;
 let trackRaf = 0;
 const update = () => {
 const el = document.querySelector(step.selector) as HTMLElement | null;
 if (!el) {
 setRect(null);
 return;
 }
 setRect(el.getBoundingClientRect());
 };
 update();

 // Track rect for ~500ms after step changes to follow accordion expand
 // animations and other layout shifts (e.g. Collapsible's height transition).
 const trackUntil = performance.now() + 500;
 const trackLoop = () => {
 update();
 if (performance.now() < trackUntil) {
 trackRaf = window.requestAnimationFrame(trackLoop);
 }
 };
 trackRaf = window.requestAnimationFrame(trackLoop);

 // If target is missing after ~400ms, skip this step
 skipTimer = window.setTimeout(() => {
 const el = document.querySelector(step.selector);
 if (!el) {
 if (isLast) {
 try {
 window.localStorage.setItem(STORAGE_KEY, "1");
 } catch {
 // ignore
 }
 setDone(true);
 } else {
 setStepIdx((i) => i + 1);
 setRect(null);
 }
 }
 }, 400);

 const onResize = () => update();
 window.addEventListener("resize", onResize);
 window.addEventListener("scroll", onResize, true);

 // Observe target subtree for layout changes (Collapsible expand etc).
 let resizeObs: ResizeObserver | null = null;
 const targetEl = document.querySelector(step.selector) as HTMLElement | null;
 if (targetEl && typeof ResizeObserver !== "undefined") {
 resizeObs = new ResizeObserver(() => update());
 // Observe target + nearest ancestors that could resize and shift target.
 resizeObs.observe(targetEl);
 let p: HTMLElement | null = targetEl.parentElement;
 let depth = 0;
 while (p && depth < 6) {
 resizeObs.observe(p);
 p = p.parentElement;
 depth++;
 }
 }

 return () => {
 window.cancelAnimationFrame(trackRaf);
 window.clearTimeout(skipTimer);
 window.removeEventListener("resize", onResize);
 window.removeEventListener("scroll", onResize, true);
 resizeObs?.disconnect();
 };
 }, [done, step.selector, isLast]);

 // Add big bottom padding while onboarding is active so any target can be
 // scrolled into the upper part of viewport, even if it sits at page bottom.
 // Also force instant scroll behavior — smooth scrolling fights the lock.
 useEffect(() => {
 if (done) return;
 const html = document.documentElement;
 const body = document.body;
 const prevPad = body.style.paddingBottom;
 const prevHtmlBehavior = html.style.scrollBehavior;
 const prevBodyBehavior = body.style.scrollBehavior;
 body.style.paddingBottom = "90vh";
 html.style.scrollBehavior = "auto";
 body.style.scrollBehavior = "auto";
 return () => {
 body.style.paddingBottom = prevPad;
 html.style.scrollBehavior = prevHtmlBehavior;
 body.style.scrollBehavior = prevBodyBehavior;
 };
 }, [done]);

 useEffect(() => {
 if (done) return;
 if (stepIdx !== 0) return;
 track("dash_onboarding_start");
 onActive?.();
 // Only fire once on first mount before user has finished
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // Scroll target into upper part of viewport, then lock scroll.
 // Sticky/fixed targets (preview + share buttons sit in a sticky header) are
 // always visible — auto-scroll on iOS misaligns the highlight overlay because
 // the rect we read changes mid-scroll. Skip scroll for those.
 //
 // Do NOT lock document scroll via overflow:hidden — that breaks `position:sticky`
 // (sticky elements fall back to their natural document position, the highlight
 // gets drawn around something halfway down the page). The dim overlay already
 // captures clicks; users can still scroll, and the existing scroll listener
 // re-measures rect so the highlight tracks the target.
 useEffect(() => {
 if (done) return;
 const el = document.querySelector(step.selector) as HTMLElement | null;
 if (!el) return;
 const body = document.body;

 const cs = window.getComputedStyle(el);
 const isPinned = cs.position === "sticky" || cs.position === "fixed";
 const inPinnedAncestor = (() => {
 let p: HTMLElement | null = el.parentElement;
 while (p && p !== body) {
 const pos = window.getComputedStyle(p).position;
 if (pos === "sticky" || pos === "fixed") return true;
 p = p.parentElement;
 }
 return false;
 })();

 // Wait a frame so the bottom-padding effect is applied first
 const raf = window.requestAnimationFrame(() => {
 if (!isPinned && !inPinnedAncestor) {
 const r = el.getBoundingClientRect();
 const targetY = r.top + window.scrollY - window.innerHeight * 0.2;
 window.scrollTo(0, Math.max(0, targetY));
 }
 });
 return () => {
 window.cancelAnimationFrame(raf);
 };
 }, [done, step.selector]);

 if (done) return null;
 if (typeof document === "undefined") return null;
 if (!rect) return null;

 const padding = 6;
 const hx = rect.left - padding;
 const hy = rect.top - padding;
 const hw = rect.width + padding * 2;
 const hh = rect.height + padding * 2;

 const vw = window.innerWidth;
 const vh = window.innerHeight;
 const bubbleWidth = Math.min(320, vw - 32);
 const spaceBelow = vh - (hy + hh);
 const placeBelow = spaceBelow > 180;
 // Floor: keep bubble below the top close+counter strip (~5dvh + 56px tall)
 const topStripBottom = vh * 0.05 + 56 + 12;
 const naturalBubbleTop = placeBelow ? hy + hh + 14 : Math.max(16, hy - 14 - 160);
 const bubbleTop = Math.max(naturalBubbleTop, topStripBottom);
 const bubbleLeft = Math.max(16, Math.min(vw - bubbleWidth - 16, hx));
 const arrowOffsetX = Math.max(16, Math.min(bubbleWidth - 24, hx + hw / 2 - bubbleLeft - 8));

 function persistDone() {
 try {
 window.localStorage.setItem(STORAGE_KEY, "1");
 } catch {
 // ignore
 }
 setDone(true);
 window.scrollTo({ top: 0, behavior: "auto" });
 }

 function next() {
 if (isLast) {
 track("dash_onboarding_done", { step: step.name });
 persistDone();
 return;
 }
 track("dash_onboarding_continue", { step: step.name });
 setStepIdx((i) => i + 1);
 setRect(null);
 }

 function back() {
 if (stepIdx === 0) return;
 track("dash_onboarding_back", { step: step.name });
 setStepIdx((i) => i - 1);
 setRect(null);
 }

 const dimCls = "fixed bg-black/90 pointer-events-auto";

 return createPortal(
 <div className="fixed inset-0 z-[9999]">
 {/* 4-side dim — leaves a transparent rectangle around the target */}
 <div className={dimCls} style={{ left: 0, top: 0, right: 0, height: Math.max(0, hy) }} />
 <div
 className={dimCls}
 style={{ left: 0, top: hy + hh, right: 0, bottom: 0 }}
 />
 <div
 className={dimCls}
 style={{ left: 0, top: hy, width: Math.max(0, hx), height: hh }}
 />
 <div
 className={dimCls}
 style={{ left: hx + hw, top: hy, right: 0, height: hh }}
 />

 {/* Highlight border around target — uses --primary (brand accent) */}
 <div
 className="fixed rounded-lg pointer-events-none"
 style={{
 left: hx,
 top: hy,
 width: hw,
 height: hh,
 boxShadow: "0 0 0 1px hsl(var(--primary) / 0.55), 0 0 32px 4px hsl(var(--primary) / 0.25)",
 }}
 />

 {/* Speech bubble */}
 <div
 className="fixed pointer-events-auto bg-card text-foreground border border-border rounded-xl shadow-2xl p-4"
 style={{ top: bubbleTop, left: bubbleLeft, width: bubbleWidth }}
 role="dialog"
 aria-live="polite"
 >
 {placeBelow ? (
 <div
 className="absolute -top-2 w-4 h-4 bg-card border-l border-t border-border rotate-45"
 style={{ left: arrowOffsetX }}
 />
 ) : (
 <div
 className="absolute -bottom-2 w-4 h-4 bg-card border-r border-b border-border rotate-45"
 style={{ left: arrowOffsetX }}
 />
 )}
 <p className="text-sm leading-relaxed relative">{t(step.textKey)}</p>
 </div>

 {/* Back + Continue — pinned 10% from bottom, 10dvw from right edge */}
 <div
 className="fixed pointer-events-auto flex items-center gap-3"
 style={{ bottom: "10dvh", right: "10dvw" }}
 >
 {stepIdx > 0 ? (
 <button
 type="button"
 onClick={back}
 className={secondaryBtn + " inline-flex items-center justify-center px-6 shadow-2xl"}
 >
 {t("button.back")}
 </button>
 ) : null}
 <button
 type="button"
 onClick={next}
 className={primaryBtn + " inline-flex items-center justify-center gap-2 px-8 shadow-2xl"}
 >
 {isLast ? t("button.done") : t("button.continue")}
 <ChevronRightIcon size={16} />
 </button>
 </div>
 </div>,
 document.body,
 );
}
