/**
 * Action ↔ PptxAction conversion helpers for element click/hover actions.
 */

import type {
  PptxElement,
  PptxAction,
  ElementAction,
  ElementActionType,
} from "../types";

// ---------------------------------------------------------------------------
// Action ↔ PptxAction conversion helpers
// ---------------------------------------------------------------------------

/** OOXML ppaction:// jump verbs mapped to ElementActionType. */
const JUMP_VERB_MAP: Record<string, ElementActionType> = {
  nextslide: "nextSlide",
  previousslide: "prevSlide",
  firstslide: "firstSlide",
  lastslide: "lastSlide",
  endshow: "endShow",
};

/**
 * Derive a high-level `ElementAction` from a low-level `PptxAction`.
 */
export function pptxActionToElementAction(
  pptxAction: PptxAction,
  trigger: "click" | "hover",
): ElementAction {
  const actionStr = (pptxAction.action ?? "").toLowerCase();

  // Slide jump via ppaction://hlinksldjump
  if (
    actionStr.includes("hlinksldjump") &&
    typeof pptxAction.targetSlideIndex === "number"
  ) {
    return { trigger, type: "slide", slideIndex: pptxAction.targetSlideIndex };
  }

  // Show-jump verbs (ppaction://hlinkshowjump?jump=<verb>)
  if (actionStr.includes("hlinkshowjump")) {
    for (const [verb, actionType] of Object.entries(JUMP_VERB_MAP)) {
      if (actionStr.includes(verb)) {
        return { trigger, type: actionType };
      }
    }
  }

  // External URL
  if (pptxAction.url && !actionStr.includes("hlinksldjump")) {
    return { trigger, type: "url", url: pptxAction.url };
  }

  return { trigger, type: "none" };
}

/**
 * Convert a high-level `ElementAction` to a low-level `PptxAction`.
 * Returns `undefined` when the action type is `'none'`.
 */
export function elementActionToPptxAction(
  ea: ElementAction,
): PptxAction | undefined {
  if (ea.type === "none") return undefined;

  const action: PptxAction = {};

  switch (ea.type) {
    case "url":
      if (ea.url) action.url = ea.url;
      break;
    case "slide":
      action.action = "ppaction://hlinksldjump";
      if (typeof ea.slideIndex === "number") {
        action.targetSlideIndex = ea.slideIndex;
      }
      break;
    case "firstSlide":
      action.action = "ppaction://hlinkshowjump?jump=firstslide";
      break;
    case "lastSlide":
      action.action = "ppaction://hlinkshowjump?jump=lastslide";
      break;
    case "prevSlide":
      action.action = "ppaction://hlinkshowjump?jump=previousslide";
      break;
    case "nextSlide":
      action.action = "ppaction://hlinkshowjump?jump=nextslide";
      break;
    case "endShow":
      action.action = "ppaction://hlinkshowjump?jump=endshow";
      break;
  }

  return action;
}

/**
 * Check if an element has any configured action (click or hover).
 */
export function elementHasAction(element: PptxElement): boolean {
  return Boolean(element.actionClick || element.actionHover);
}
