/**
 * OOXML built-in action button presets and default action map.
 */

import type { ActionButtonPreset } from "../../core";

export const ACTION_BUTTON_PRESETS: ActionButtonPreset[] = [
  {
    shapeType: "actionButtonBackPrevious",
    label: "Back / Previous",
    defaultAction: "prevSlide",
    iconPath: "M16 4 L4 12 L16 20 Z",
  },
  {
    shapeType: "actionButtonForwardNext",
    label: "Forward / Next",
    defaultAction: "nextSlide",
    iconPath: "M8 4 L20 12 L8 20 Z",
  },
  {
    shapeType: "actionButtonBeginning",
    label: "Home / First",
    defaultAction: "firstSlide",
    iconPath: "M4 4 L4 20 M6 12 L18 4 L18 20 Z",
  },
  {
    shapeType: "actionButtonEnd",
    label: "End / Last",
    defaultAction: "lastSlide",
    iconPath: "M20 4 L20 20 M18 12 L6 4 L6 20 Z",
  },
  {
    shapeType: "actionButtonReturn",
    label: "Return",
    defaultAction: "prevSlide",
    iconPath: "M18 8 L18 14 L6 14 M6 14 L10 10 M6 14 L10 18",
  },
];

/** Map from action button shape type to its default action type. */
export const ACTION_BUTTON_DEFAULT_ACTIONS: Record<
  string,
  ActionButtonPreset["defaultAction"]
> = Object.fromEntries(
  ACTION_BUTTON_PRESETS.map((p) => [p.shapeType, p.defaultAction]),
);
