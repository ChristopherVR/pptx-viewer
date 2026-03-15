/**
 * useIsMobile — Detects viewport size and touch capability for responsive layout.
 *
 * Provides reactive breakpoint flags (`isMobile`, `isTablet`, `isDesktop`) and
 * a `isTouchDevice` flag. Uses `ResizeObserver` on the container element (if
 * provided) or the viewport width as a fallback, so the detection adapts when
 * the viewer is embedded inside a narrow host container.
 *
 * Also detects virtual keyboard visibility on mobile devices and reports
 * device orientation.
 *
 * Breakpoints (container-width based):
 *   mobile:  < 768px
 *   tablet:  768px .. 1023px
 *   desktop: >= 1024px
 *
 * @module useIsMobile
 */
import { useState, useEffect, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mobile breakpoint — below this width is considered mobile. */
export const MOBILE_BREAKPOINT = 768;

/** Tablet breakpoint — below this width (but >= MOBILE) is tablet. */
export const TABLET_BREAKPOINT = 1024;

/** Minimum touch target size (px) per WCAG accessibility guidelines. */
export const MIN_TOUCH_TARGET = 44;

// ---------------------------------------------------------------------------
// Touch capability detection
// ---------------------------------------------------------------------------

function getIsTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error — legacy IE/Edge check
    (navigator.msMaxTouchPoints != null && navigator.msMaxTouchPoints > 0)
  );
}

function subscribeTouchCapability(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // Touch capability doesn't change at runtime, but a hybrid device
  // might connect/disconnect a touch screen. We re-check on pointer events.
  const handler = () => callback();
  window.addEventListener("pointerdown", handler, { once: true });
  return () => window.removeEventListener("pointerdown", handler);
}

// ---------------------------------------------------------------------------
// Orientation detection
// ---------------------------------------------------------------------------

export type DeviceOrientation = "portrait" | "landscape";

function getOrientation(): DeviceOrientation {
  if (typeof window === "undefined") return "landscape";
  if (typeof screen !== "undefined" && screen.orientation) {
    return screen.orientation.type.startsWith("portrait")
      ? "portrait"
      : "landscape";
  }
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
}

// ---------------------------------------------------------------------------
// Hook output
// ---------------------------------------------------------------------------

export interface UseIsMobileResult {
  /** True when container/viewport width is below 768px. */
  isMobile: boolean;
  /** True when container/viewport width is 768..1023px. */
  isTablet: boolean;
  /** True when container/viewport width is >= 1024px. */
  isDesktop: boolean;
  /** True on devices with touch capability. */
  isTouchDevice: boolean;
  /** Current device orientation (portrait or landscape). */
  orientation: DeviceOrientation;
  /** True when the virtual keyboard is likely visible (viewport height shrank significantly). */
  isVirtualKeyboardOpen: boolean;
  /** The measured container width in pixels. */
  containerWidth: number;
}

export interface UseIsMobileInput {
  /** Optional ref to the container element for container-based breakpoints. */
  containerRef?: React.RefObject<HTMLElement | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIsMobile(input?: UseIsMobileInput): UseIsMobileResult {
  const containerRef = input?.containerRef;

  // Touch capability — uses useSyncExternalStore for SSR safety
  const isTouchDevice = useSyncExternalStore(
    subscribeTouchCapability,
    getIsTouchDevice,
    () => false, // server snapshot
  );

  // Container/viewport width
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window === "undefined") return 1024;
    return containerRef?.current?.clientWidth ?? window.innerWidth;
  });

  // Orientation
  const [orientation, setOrientation] = useState<DeviceOrientation>(
    getOrientation,
  );

  // Virtual keyboard detection
  const [isVirtualKeyboardOpen, setIsVirtualKeyboardOpen] = useState(false);
  const [initialViewportHeight] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  // Container width tracking
  useEffect(() => {
    const el = containerRef?.current;

    if (el) {
      // Use ResizeObserver on the container
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(el);
      setContainerWidth(el.clientWidth);
      return () => observer.disconnect();
    }

    // Fallback: track window width
    const handleResize = () => {
      setContainerWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [containerRef]);

  // Orientation change tracking
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOrientationChange = () => {
      setOrientation(getOrientation());
    };

    if (screen.orientation) {
      screen.orientation.addEventListener("change", handleOrientationChange);
    }
    window.addEventListener("resize", handleOrientationChange);

    return () => {
      if (screen.orientation) {
        screen.orientation.removeEventListener(
          "change",
          handleOrientationChange,
        );
      }
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, []);

  // Virtual keyboard detection — when viewport height shrinks by > 30% on a
  // touch device, it's very likely the virtual keyboard appeared.
  useEffect(() => {
    if (!isTouchDevice || typeof window === "undefined") return;

    const handleResize = () => {
      const currentHeight = window.visualViewport?.height ?? window.innerHeight;
      const shrinkRatio = currentHeight / initialViewportHeight;
      setIsVirtualKeyboardOpen(shrinkRatio < 0.7);
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", handleResize);
      return () => vv.removeEventListener("resize", handleResize);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isTouchDevice, initialViewportHeight]);

  // Derived breakpoint flags
  const isMobile = containerWidth < MOBILE_BREAKPOINT;
  const isTablet =
    containerWidth >= MOBILE_BREAKPOINT && containerWidth < TABLET_BREAKPOINT;
  const isDesktop = containerWidth >= TABLET_BREAKPOINT;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice,
    orientation,
    isVirtualKeyboardOpen,
    containerWidth,
  };
}
