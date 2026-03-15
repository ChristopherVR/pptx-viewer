/**
 * Pure helper functions extracted from usePresentationKeyboard for testability.
 */

// ---------------------------------------------------------------------------
// Key action mapping
// ---------------------------------------------------------------------------

export type PresentationKeyAction =
  | { action: "exit" }
  | { action: "next" }
  | { action: "prev" }
  | { action: "toggleLaser" }
  | { action: "togglePen" }
  | { action: "toggleEraser" }
  | { action: "toggleToolbar" }
  | { action: "togglePresenterView" }
  | { action: "none" };

/**
 * Map a keyboard event to a presentation-mode action.
 * Returns the logical action for a given key and modifier state.
 */
export function mapKeyToPresentationAction(
  key: string,
  ctrlKey: boolean,
): PresentationKeyAction {
  if (key === "Escape") return { action: "exit" };

  if (key === "ArrowRight" || key === "PageDown" || key === " ") {
    return { action: "next" };
  }

  if (key === "ArrowLeft" || key === "PageUp") {
    return { action: "prev" };
  }

  if (key === "l" || key === "L") return { action: "toggleLaser" };
  if (key === "p" || key === "P") return { action: "togglePen" };
  if (key === "e" || key === "E") return { action: "toggleEraser" };

  if (key === "m" && ctrlKey) return { action: "toggleToolbar" };

  // Toggle presenter view (split-screen with notes) during presentation
  if (key === "n" || key === "N") return { action: "togglePresenterView" };

  return { action: "none" };
}

// ---------------------------------------------------------------------------
// Navigation keys
// ---------------------------------------------------------------------------

/** Keys that advance to the next slide. */
export const NEXT_SLIDE_KEYS = ["ArrowRight", "PageDown", " "] as const;

/** Keys that go to the previous slide. */
export const PREV_SLIDE_KEYS = ["ArrowLeft", "PageUp"] as const;

/**
 * Returns true when the given key is a slide navigation key
 * (either forward or backward).
 */
export function isNavigationKey(key: string): boolean {
  return (
    (NEXT_SLIDE_KEYS as readonly string[]).includes(key) ||
    (PREV_SLIDE_KEYS as readonly string[]).includes(key)
  );
}
