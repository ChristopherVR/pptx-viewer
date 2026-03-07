/**
 * Action conversion helpers for element click/hover actions.
 *
 * Converts between the low-level {@link PptxAction} (which mirrors
 * the OOXML `ppaction://` URI scheme) and the high-level
 * {@link ElementAction} (which the editor UI works with).
 *
 * OOXML action URIs follow the pattern:
 *   `ppaction://hlinksldjump`   — navigate to a specific slide
 *   `ppaction://hlinkshowjump?jump=<verb>` — navigate first/last/next/prev/end
 *
 * @module element-actions
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

/**
 * Maps OOXML `hlinkshowjump` verb strings (lowercase) to their
 * corresponding high-level {@link ElementActionType} values.
 */
const JUMP_VERB_MAP: Record<string, ElementActionType> = {
  nextslide: "nextSlide",
  previousslide: "prevSlide",
  firstslide: "firstSlide",
  lastslide: "lastSlide",
  endshow: "endShow",
};

/**
 * Derive a high-level {@link ElementAction} from a low-level
 * {@link PptxAction}. Inspects the `action` URI string to determine
 * the action type (slide jump, show jump, or external URL).
 *
 * @param pptxAction - The low-level PPTX action from the XML model.
 * @param trigger - Whether this action fires on `"click"` or `"hover"`.
 * @returns A high-level {@link ElementAction} for the editor UI.
 */
export function pptxActionToElementAction(
  pptxAction: PptxAction,
  trigger: "click" | "hover",
): ElementAction {
  const actionStr = (pptxAction.action ?? "").toLowerCase();

  // Slide jump via ppaction://hlinksldjump — navigates to a specific slide
  if (
    actionStr.includes("hlinksldjump") &&
    typeof pptxAction.targetSlideIndex === "number"
  ) {
    return { trigger, type: "slide", slideIndex: pptxAction.targetSlideIndex };
  }

  // Show-jump verbs (ppaction://hlinkshowjump?jump=<verb>) — navigational actions
  if (actionStr.includes("hlinkshowjump")) {
    for (const [verb, actionType] of Object.entries(JUMP_VERB_MAP)) {
      if (actionStr.includes(verb)) {
        return { trigger, type: actionType };
      }
    }
  }

  // External URL (only when not a slide jump to avoid false positives)
  if (pptxAction.url && !actionStr.includes("hlinksldjump")) {
    return { trigger, type: "url", url: pptxAction.url };
  }

  return { trigger, type: "none" };
}

/**
 * Convert a high-level {@link ElementAction} back to a low-level
 * {@link PptxAction} for serialisation into OOXML.
 *
 * Returns `undefined` when the action type is `"none"` (no action configured).
 *
 * @param ea - The high-level element action.
 * @returns A {@link PptxAction} for XML serialisation, or `undefined`.
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
 * Check if an element has any configured interactive action
 * (either click or hover).
 *
 * @param element - The element to check.
 * @returns `true` if the element has a click or hover action.
 */
export function elementHasAction(element: PptxElement): boolean {
  return Boolean(element.actionClick || element.actionHover);
}
