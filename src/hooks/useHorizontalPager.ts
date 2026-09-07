import { useEffect, useLayoutEffect, useRef } from "react";
import { useMediaQuery } from "./useMediaQuery";

const LOCK_PX = 10;
const CLICK_PX = 8;
const SNAP_RATIO = 0.35;
const VELOCITY = 0.45;
const RUBBER = 0.32;
const SETTLE_MS = 280;
const SETTLE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

export function translateX(offset: number) {
  return `translate3d(${offset}px, 0, 0)`;
}

export function translateXFromMiddle(offset: number) {
  return `translate3d(calc(-33.333% + ${offset}px), 0, 0)`;
}

export function useHorizontalPager({
  enabled = true,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  resetKey,
  restTransform = translateX,
}: {
  enabled?: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  resetKey?: string | number;
  restTransform?: (offset: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const restTransformRef = useRef(restTransform);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  const canGoPrevRef = useRef(canGoPrev);
  const canGoNextRef = useRef(canGoNext);
  const enabledRef = useRef(enabled);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reducedRef = useRef(reducedMotion);

  restTransformRef.current = restTransform;
  onPrevRef.current = onPrev;
  onNextRef.current = onNext;
  canGoPrevRef.current = canGoPrev;
  canGoNextRef.current = canGoNext;
  enabledRef.current = enabled;
  reducedRef.current = reducedMotion;

  function apply(offset: number, animate: boolean) {
    offsetRef.current = offset;
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? `transform ${SETTLE_MS}ms ${SETTLE_EASE}`
      : "none";
    track.style.transform = restTransformRef.current(offset);
  }

  useLayoutEffect(() => {
    apply(0, false);
    const track = trackRef.current;
    if (track) track.style.willChange = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (enabled) return;
    apply(0, false);
    const track = trackRef.current;
    if (track) track.style.willChange = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const container: HTMLDivElement = node;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let axis: "undecided" | "x" | "y" = "undecided";
    let moved = 0;
    let settling = false;
    let settleTimer = 0;

    function width() {
      return container.getBoundingClientRect().width || 1;
    }

    function rubber(delta: number) {
      if (delta > 0 && !canGoPrevRef.current) return delta * RUBBER;
      if (delta < 0 && !canGoNextRef.current) return delta * RUBBER;
      return delta;
    }

    function suppressClick() {
      const stop = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        cleanup();
      };
      const cleanup = () => {
        document.removeEventListener("click", stop, true);
        window.clearTimeout(timer);
      };
      document.addEventListener("click", stop, true);
      const timer = window.setTimeout(cleanup, 400);
    }

    function finish(commit: -1 | 0 | 1) {
      settling = false;
      const track = trackRef.current;
      if (commit === 0) {
        apply(0, false);
        if (track) track.style.willChange = "";
        return;
      }
      // Keep the settled offset until React paints the new page, then
      // resetKey's layout effect snaps transform back to rest.
      if (commit === 1) onNextRef.current();
      else onPrevRef.current();
    }

    function settle(commit: -1 | 0 | 1) {
      const target = commit === 1 ? -width() : commit === -1 ? width() : 0;
      if (reducedRef.current || target === offsetRef.current) {
        finish(commit);
        return;
      }
      settling = true;
      apply(target, true);
      const track = trackRef.current;
      let closed = false;
      const done = () => {
        if (closed) return;
        closed = true;
        window.clearTimeout(settleTimer);
        track?.removeEventListener("transitionend", onEnd);
        finish(commit);
      };
      const onEnd = (event: TransitionEvent) => {
        if (event.target !== track || event.propertyName !== "transform") return;
        done();
      };
      track?.addEventListener("transitionend", onEnd);
      settleTimer = window.setTimeout(done, SETTLE_MS + 60);
    }

    function onPointerDown(event: PointerEvent) {
      if (!enabledRef.current || settling) return;
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      lastX = event.clientX;
      lastT = event.timeStamp;
      velocity = 0;
      axis = "undecided";
      moved = 0;
    }

    function onPointerMove(event: PointerEvent) {
      if (pointerId !== event.pointerId || settling) return;
      if (!enabledRef.current) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      moved = Math.max(moved, Math.hypot(dx, dy));

      if (axis === "undecided") {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axis === "x") {
          container.setPointerCapture(event.pointerId);
          const track = trackRef.current;
          if (track) track.style.willChange = "transform";
        }
      }
      if (axis !== "x") return;
      if (event.cancelable) event.preventDefault();

      const dt = event.timeStamp - lastT;
      if (dt > 0) velocity = (event.clientX - lastX) / dt;
      lastX = event.clientX;
      lastT = event.timeStamp;

      if (!reducedRef.current) apply(rubber(dx), false);
    }

    function onPointerUp(event: PointerEvent) {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      if (axis === "x" && moved >= CLICK_PX) suppressClick();
      if (axis !== "x") {
        axis = "undecided";
        return;
      }
      axis = "undecided";
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }

      const dx = rubber(event.clientX - startX);
      const w = width();
      const flickedNext = velocity < -VELOCITY;
      const flickedPrev = velocity > VELOCITY;
      const draggedNext = dx < 0 && Math.abs(dx) > w * SNAP_RATIO;
      const draggedPrev = dx > 0 && Math.abs(dx) > w * SNAP_RATIO;
      const goNext = canGoNextRef.current && (draggedNext || flickedNext);
      const goPrev = canGoPrevRef.current && (draggedPrev || flickedPrev);

      if (goNext && dx <= 0) settle(1);
      else if (goPrev && dx >= 0) settle(-1);
      else settle(0);
    }

    function onPointerCancel(event: PointerEvent) {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      axis = "undecided";
      if (!settling) settle(0);
    }

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove, { passive: false });
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.clearTimeout(settleTimer);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, trackRef };
}
