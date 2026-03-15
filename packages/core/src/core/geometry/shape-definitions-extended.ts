/**
 * Extended shape definitions: Arrows, Callouts, Flowchart, and Action Buttons.
 *
 * Each entry in the array is a {@link PresetShapeDefinition} with:
 * - `name` — The canonical OOXML preset geometry name (camelCase).
 * - `label` — A human-readable display label for the shape picker UI.
 * - `category` — The {@link PresetShapeCategory} grouping.
 *
 * This file contains the second half of shape definitions. The first
 * half (basic, rectangles, stars, math, other) lives in
 * `shape-definitions-primary.ts`.
 */
import type { PresetShapeDefinition } from "./preset-shape-types";

/**
 * Shape definitions for arrows, callouts, flowchart symbols, and action buttons.
 */
export const EXTENDED_SHAPE_DEFINITIONS: PresetShapeDefinition[] = [
  // ── Lines & Connectors ─────────────────────────────────────────────────
  { name: "line", label: "Line", category: "other" },
  { name: "lineInv", label: "Line Inverse", category: "other" },
  { name: "straightConnector1", label: "Straight Connector", category: "other" },

  // ── Arrows ────────────────────────────────────────────────────────────
  { name: "rightArrow", label: "Right Arrow", category: "arrows" },
  { name: "leftArrow", label: "Left Arrow", category: "arrows" },
  { name: "upArrow", label: "Up Arrow", category: "arrows" },
  { name: "downArrow", label: "Down Arrow", category: "arrows" },
  { name: "leftRightArrow", label: "Left-Right Arrow", category: "arrows" },
  { name: "upDownArrow", label: "Up-Down Arrow", category: "arrows" },
  { name: "quadArrow", label: "Quad Arrow", category: "arrows" },
  {
    name: "leftRightUpArrow",
    label: "Left-Right-Up Arrow",
    category: "arrows",
  },
  { name: "bentUpArrow", label: "Bent-Up Arrow", category: "arrows" },
  { name: "bentArrow", label: "Bent Arrow", category: "arrows" },
  { name: "uturnArrow", label: "U-Turn Arrow", category: "arrows" },
  {
    name: "stripedRightArrow",
    label: "Striped Right Arrow",
    category: "arrows",
  },
  {
    name: "notchedRightArrow",
    label: "Notched Right Arrow",
    category: "arrows",
  },
  { name: "homePlate", label: "Home Plate", category: "arrows" },
  { name: "chevron", label: "Chevron", category: "arrows" },
  {
    name: "rightArrowCallout",
    label: "Right Arrow Callout",
    category: "arrows",
  },
  { name: "leftArrowCallout", label: "Left Arrow Callout", category: "arrows" },
  { name: "upArrowCallout", label: "Up Arrow Callout", category: "arrows" },
  { name: "downArrowCallout", label: "Down Arrow Callout", category: "arrows" },
  {
    name: "leftRightArrowCallout",
    label: "Left-Right Arrow Callout",
    category: "arrows",
  },
  {
    name: "upDownArrowCallout",
    label: "Up-Down Arrow Callout",
    category: "arrows",
  },
  { name: "quadArrowCallout", label: "Quad Arrow Callout", category: "arrows" },
  { name: "curvedRightArrow", label: "Curved Right Arrow", category: "arrows" },
  { name: "curvedLeftArrow", label: "Curved Left Arrow", category: "arrows" },
  { name: "curvedUpArrow", label: "Curved Up Arrow", category: "arrows" },
  { name: "curvedDownArrow", label: "Curved Down Arrow", category: "arrows" },
  { name: "swooshArrow", label: "Swoosh Arrow", category: "arrows" },
  { name: "leftUpArrow", label: "Left-Up Arrow", category: "arrows" },
  { name: "circularArrow", label: "Circular Arrow", category: "arrows" },
  {
    name: "leftCircularArrow",
    label: "Left Circular Arrow",
    category: "arrows",
  },
  {
    name: "leftRightCircularArrow",
    label: "Left-Right Circular Arrow",
    category: "arrows",
  },

  // ── Callouts ──────────────────────────────────────────────────────────
  {
    name: "wedgeRectCallout",
    label: "Rectangular Callout",
    category: "callouts",
  },
  {
    name: "wedgeRoundRectCallout",
    label: "Rounded Rectangular Callout",
    category: "callouts",
  },
  { name: "wedgeEllipseCallout", label: "Oval Callout", category: "callouts" },
  { name: "cloudCallout", label: "Cloud Callout", category: "callouts" },
  { name: "callout1", label: "Line Callout 1", category: "callouts" },
  { name: "callout2", label: "Line Callout 2", category: "callouts" },
  { name: "callout3", label: "Line Callout 3", category: "callouts" },
  { name: "borderCallout1", label: "Border Callout 1", category: "callouts" },
  { name: "borderCallout2", label: "Border Callout 2", category: "callouts" },
  { name: "borderCallout3", label: "Border Callout 3", category: "callouts" },
  { name: "accentCallout1", label: "Accent Callout 1", category: "callouts" },
  { name: "accentCallout2", label: "Accent Callout 2", category: "callouts" },
  { name: "accentCallout3", label: "Accent Callout 3", category: "callouts" },
  {
    name: "accentBorderCallout1",
    label: "Accent Border Callout 1",
    category: "callouts",
  },
  {
    name: "accentBorderCallout2",
    label: "Accent Border Callout 2",
    category: "callouts",
  },
  {
    name: "accentBorderCallout3",
    label: "Accent Border Callout 3",
    category: "callouts",
  },

  // ── Flowchart ─────────────────────────────────────────────────────────
  { name: "flowChartProcess", label: "Process", category: "flowchart" },
  {
    name: "flowChartAlternateProcess",
    label: "Alternate Process",
    category: "flowchart",
  },
  { name: "flowChartDecision", label: "Decision", category: "flowchart" },
  {
    name: "flowChartInputOutput",
    label: "Input/Output",
    category: "flowchart",
  },
  {
    name: "flowChartPredefinedProcess",
    label: "Predefined Process",
    category: "flowchart",
  },
  {
    name: "flowChartInternalStorage",
    label: "Internal Storage",
    category: "flowchart",
  },
  { name: "flowChartDocument", label: "Document", category: "flowchart" },
  {
    name: "flowChartMultidocument",
    label: "Multi-Document",
    category: "flowchart",
  },
  { name: "flowChartTerminator", label: "Terminator", category: "flowchart" },
  { name: "flowChartPreparation", label: "Preparation", category: "flowchart" },
  {
    name: "flowChartManualInput",
    label: "Manual Input",
    category: "flowchart",
  },
  {
    name: "flowChartManualOperation",
    label: "Manual Operation",
    category: "flowchart",
  },
  { name: "flowChartConnector", label: "Connector", category: "flowchart" },
  {
    name: "flowChartOffpageConnector",
    label: "Off-Page Connector",
    category: "flowchart",
  },
  { name: "flowChartPunchedCard", label: "Card", category: "flowchart" },
  {
    name: "flowChartPunchedTape",
    label: "Punched Tape",
    category: "flowchart",
  },
  {
    name: "flowChartSummingJunction",
    label: "Summing Junction",
    category: "flowchart",
  },
  { name: "flowChartOr", label: "Or", category: "flowchart" },
  { name: "flowChartCollate", label: "Collate", category: "flowchart" },
  { name: "flowChartSort", label: "Sort", category: "flowchart" },
  { name: "flowChartExtract", label: "Extract", category: "flowchart" },
  { name: "flowChartMerge", label: "Merge", category: "flowchart" },
  {
    name: "flowChartOnlineStorage",
    label: "Online Storage",
    category: "flowchart",
  },
  {
    name: "flowChartOfflineStorage",
    label: "Offline Storage",
    category: "flowchart",
  },
  {
    name: "flowChartMagneticDisk",
    label: "Magnetic Disk",
    category: "flowchart",
  },
  {
    name: "flowChartMagneticDrum",
    label: "Magnetic Drum",
    category: "flowchart",
  },
  {
    name: "flowChartMagneticTape",
    label: "Magnetic Tape",
    category: "flowchart",
  },
  { name: "flowChartDisplay", label: "Display", category: "flowchart" },
  { name: "flowChartDelay", label: "Delay", category: "flowchart" },
  { name: "flowChartData", label: "Data", category: "flowchart" },
  {
    name: "flowChartDirectData",
    label: "Direct Access Storage",
    category: "flowchart",
  },
  {
    name: "flowChartSequentialAccessStorage",
    label: "Sequential Access",
    category: "flowchart",
  },
  {
    name: "flowChartStoredData",
    label: "Stored Data",
    category: "flowchart",
  },

  // ── Action Buttons ────────────────────────────────────────────────────
  { name: "actionButtonBlank", label: "Action: Blank", category: "action" },
  { name: "actionButtonHome", label: "Action: Home", category: "action" },
  { name: "actionButtonHelp", label: "Action: Help", category: "action" },
  {
    name: "actionButtonInformation",
    label: "Action: Information",
    category: "action",
  },
  {
    name: "actionButtonBackOrPrevious",
    label: "Action: Back",
    category: "action",
  },
  {
    name: "actionButtonForwardOrNext",
    label: "Action: Forward",
    category: "action",
  },
  {
    name: "actionButtonBeginning",
    label: "Action: Beginning",
    category: "action",
  },
  { name: "actionButtonEnd", label: "Action: End", category: "action" },
  { name: "actionButtonReturn", label: "Action: Return", category: "action" },
  {
    name: "actionButtonDocument",
    label: "Action: Document",
    category: "action",
  },
  { name: "actionButtonSound", label: "Action: Sound", category: "action" },
  { name: "actionButtonMovie", label: "Action: Movie", category: "action" },
  {
    name: "actionButtonBackPrevious",
    label: "Action: Back",
    category: "action",
  },
  {
    name: "actionButtonForwardNext",
    label: "Action: Forward",
    category: "action",
  },
];
