/**
 * useReducedMotion — Reactive hook for the `prefers-reduced-motion` media query.
 *
 * Provides both OS-level detection and a manual override toggle.
 * When reduced motion is active (either via OS preference or manual toggle),
 * animations, transitions, and slide transition effects should be skipped.
 *
 * @module useReducedMotion
 */
import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// OS-level media query subscription
// ---------------------------------------------------------------------------

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

// ---------------------------------------------------------------------------
// Hook output
// ---------------------------------------------------------------------------

export interface UseReducedMotionResult {
  /** Whether the OS reports prefers-reduced-motion: reduce. */
  osReducedMotion: boolean;
  /** Whether the user has manually toggled reduced motion on. */
  manualReducedMotion: boolean;
  /** Effective value: true when either OS or manual toggle is active. */
  reducedMotion: boolean;
  /** Toggle the manual override on/off. */
  toggleReducedMotion: () => void;
  /** Set the manual override to a specific value. */
  setManualReducedMotion: (value: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Detects the OS `prefers-reduced-motion` media query and provides a
 * manual toggle for users who want to disable animations in the viewer
 * without changing their OS settings.
 *
 * @returns {@link UseReducedMotionResult}
 */
export function useReducedMotion(): UseReducedMotionResult {
  const osReducedMotion = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const [manualReducedMotion, setManualReducedMotion] = useState(false);

  const reducedMotion = osReducedMotion || manualReducedMotion;

  const toggleReducedMotion = useCallback(() => {
    setManualReducedMotion((prev) => !prev);
  }, []);

  // Apply a CSS class to the document root so global CSS rules can respond
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.classList.add("pptx-reduced-motion");
    } else {
      root.classList.remove("pptx-reduced-motion");
    }
    return () => {
      root.classList.remove("pptx-reduced-motion");
    };
  }, [reducedMotion]);

  return {
    osReducedMotion,
    manualReducedMotion,
    reducedMotion,
    toggleReducedMotion,
    setManualReducedMotion,
  };
}
