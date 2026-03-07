import type { PptxAction } from "pptx-viewer-core";
import type { ViewerMode } from "../../types";

// ---------------------------------------------------------------------------
// Presentation action handler
// ---------------------------------------------------------------------------

export interface PresentationActionDeps {
  movePresentationSlide: (direction: 1 | -1) => void;
  navigateToSlide: (slideIndex: number) => void;
  onPlayActionSound?: (soundPath: string) => void;
  onSetMode: (mode: ViewerMode) => void;
  slidesLength: number;
}

/**
 * Handle a presentation action (action buttons, hyperlinks, slide jumps).
 * Extracted from the main hook to keep file sizes manageable.
 */
export function handlePresentationActionImpl(
  action: PptxAction,
  deps: PresentationActionDeps,
): void {
  const actionStr = action.action || "";
  if (action.soundPath && deps.onPlayActionSound) {
    deps.onPlayActionSound(action.soundPath);
  }

  // Internal slide jump via targetSlideIndex
  if (typeof action.targetSlideIndex === "number") {
    deps.navigateToSlide(action.targetSlideIndex);
    return;
  }

  // OOXML show-jump actions: ppaction://hlinkshowjump?jump=<verb>
  if (actionStr.includes("hlinkshowjump")) {
    const lower = actionStr.toLowerCase();
    if (lower.includes("nextslide")) {
      deps.movePresentationSlide(1);
    } else if (lower.includes("previousslide")) {
      deps.movePresentationSlide(-1);
    } else if (lower.includes("firstslide")) {
      deps.navigateToSlide(0);
    } else if (lower.includes("lastslide")) {
      deps.navigateToSlide(deps.slidesLength - 1);
    } else if (lower.includes("endshow")) {
      deps.onSetMode("edit");
    }
    return;
  }

  // Slide-jump action (ppaction://hlinksldjump) without targetSlideIndex
  // falls through — the targetSlideIndex case above should handle it,
  // but if for some reason it wasn't resolved, ignore gracefully.
  if (actionStr.includes("hlinksldjump")) {
    return;
  }

  // External URL — open in a new tab/window
  if (action.url && !actionStr.includes("hlinksldjump")) {
    window.open(action.url, "_blank", "noopener,noreferrer");
    return;
  }
}
