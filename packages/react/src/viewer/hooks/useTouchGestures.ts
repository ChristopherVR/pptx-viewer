/**
 * useTouchGestures — Multi-touch gesture detection for the viewer canvas.
 *
 * Supports:
 *   - **Pinch-to-zoom**: Two-finger spread/pinch to zoom in/out.
 *   - **Swipe**: Single-finger horizontal swipe (for slide navigation in
 *     presentation mode).
 *   - **Long-press**: Single-finger press held for 500ms (context menu trigger).
 *
 * The hook attaches native `touch*` listeners with `{ passive: false }` so it
 * can call `preventDefault()` to prevent the browser's default pinch-zoom
 * while the custom handler is active.
 *
 * @module useTouchGestures
 */
import { useEffect, useRef, useCallback } from "react";
import { MIN_ZOOM_SCALE, MAX_ZOOM_SCALE } from "../constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TouchGestureCallbacks {
  /** Called continuously during a pinch gesture with the new scale value. */
  onPinchZoom?: (newScale: number) => void;
  /** Called when a horizontal swipe is detected. direction: -1 = left, 1 = right. */
  onSwipe?: (direction: -1 | 1) => void;
  /** Called when a long-press (500ms hold) is detected. */
  onLongPress?: (clientX: number, clientY: number) => void;
}

export interface UseTouchGesturesInput {
  /** The element to attach touch listeners to. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Current zoom scale — used as the baseline for pinch gestures. */
  currentScale: number;
  /** Callbacks for gesture events. */
  callbacks: TouchGestureCallbacks;
  /** Set to false to disable all gesture handling. Default: true. */
  enabled?: boolean;
}

/** Exported for testing: the minimum finger distance delta to recognise a swipe. */
export const SWIPE_THRESHOLD_PX = 50;

/** Exported for testing: maximum vertical deviation for a swipe to still count. */
export const SWIPE_MAX_VERTICAL_PX = 100;

/** Exported for testing: the hold duration for a long-press (ms). */
export const LONG_PRESS_DURATION_MS = 500;

/** Exported for testing: if finger moves more than this during a hold, cancel long-press. */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Compute distance between two touch points. */
export function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Clamp a scale value to the allowed zoom range. */
export function clampScale(value: number): number {
  return Math.min(Math.max(value, MIN_ZOOM_SCALE), MAX_ZOOM_SCALE);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTouchGestures(input: UseTouchGesturesInput): void {
  const { targetRef, currentScale, callbacks, enabled = true } = input;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const scaleRef = useRef(currentScale);
  scaleRef.current = currentScale;

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) return;

    // ── Pinch state ────────────────────────────────────────────────
    let initialPinchDistance = 0;
    let pinchBaseScale = 1;
    let isPinching = false;

    // ── Swipe state ────────────────────────────────────────────────
    let swipeStartX = 0;
    let swipeStartY = 0;

    // ── Long-press state ───────────────────────────────────────────
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressStartX = 0;
    let longPressStartY = 0;

    const cancelLongPress = () => {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    // ── Handlers ───────────────────────────────────────────────────

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Start pinch
        isPinching = true;
        initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        pinchBaseScale = scaleRef.current;
        cancelLongPress();
        e.preventDefault();
      } else if (e.touches.length === 1) {
        // Potential swipe or long-press
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;

        longPressStartX = e.touches[0].clientX;
        longPressStartY = e.touches[0].clientY;

        cancelLongPress();
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          callbacksRef.current.onLongPress?.(longPressStartX, longPressStartY);
        }, LONG_PRESS_DURATION_MS);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        if (initialPinchDistance > 0) {
          const ratio = currentDistance / initialPinchDistance;
          const newScale = clampScale(pinchBaseScale * ratio);
          callbacksRef.current.onPinchZoom?.(newScale);
        }
      } else if (e.touches.length === 1) {
        // Check if finger moved too far for long-press
        const dx = e.touches[0].clientX - longPressStartX;
        const dy = e.touches[0].clientY - longPressStartY;
        if (
          Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE_PX ||
          Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE_PX
        ) {
          cancelLongPress();
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isPinching) {
        isPinching = false;
        initialPinchDistance = 0;
        return;
      }

      cancelLongPress();

      // Detect swipe from the touch that just ended
      if (e.changedTouches.length === 1 && e.touches.length === 0) {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const deltaX = endX - swipeStartX;
        const deltaY = endY - swipeStartY;

        if (
          Math.abs(deltaX) >= SWIPE_THRESHOLD_PX &&
          Math.abs(deltaY) < SWIPE_MAX_VERTICAL_PX
        ) {
          callbacksRef.current.onSwipe?.(deltaX > 0 ? 1 : -1);
        }
      }
    };

    const handleTouchCancel = () => {
      isPinching = false;
      initialPinchDistance = 0;
      cancelLongPress();
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchCancel);
      cancelLongPress();
    };
  }, [targetRef, enabled]);
}
