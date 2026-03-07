import type { SmartArtLayout } from "../../core";

// ── SmartArt types ───────────────────────────────────────────────────────────

export type SmartArtCategory =
  | "list"
  | "process"
  | "cycle"
  | "hierarchy"
  | "relationship";

export interface SmartArtPreset {
  layout: SmartArtLayout;
  label: string;
  category: SmartArtCategory;
  /** Default items to insert. */
  defaultItems: string[];
}

// ── Layout presets ───────────────────────────────────────────────────────────

export const PRESETS: SmartArtPreset[] = [
  // List
  {
    layout: "basicBlockList",
    label: "Basic Block List",
    category: "list",
    defaultItems: ["Item 1", "Item 2", "Item 3"],
  },
  {
    layout: "stackedList",
    label: "Stacked List",
    category: "list",
    defaultItems: ["Item 1", "Item 2", "Item 3"],
  },
  {
    layout: "horizontalBulletList",
    label: "Horizontal Bullet List",
    category: "list",
    defaultItems: ["Topic 1", "Topic 2", "Topic 3"],
  },
  {
    layout: "tableList",
    label: "Table List",
    category: "list",
    defaultItems: ["Row 1", "Row 2", "Row 3"],
  },
  // Process
  {
    layout: "basicChevronProcess",
    label: "Chevron Process",
    category: "process",
    defaultItems: ["Step 1", "Step 2", "Step 3"],
  },
  {
    layout: "segmentedProcess",
    label: "Segmented Process",
    category: "process",
    defaultItems: ["Phase 1", "Phase 2", "Phase 3"],
  },
  {
    layout: "continuousBlockProcess",
    label: "Continuous Block Process",
    category: "process",
    defaultItems: ["Start", "Middle", "End"],
  },
  {
    layout: "upwardArrow",
    label: "Upward Arrow",
    category: "process",
    defaultItems: ["Stage 1", "Stage 2", "Stage 3"],
  },
  // Cycle
  {
    layout: "basicCycle",
    label: "Basic Cycle",
    category: "cycle",
    defaultItems: ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
  },
  {
    layout: "basicRadial",
    label: "Basic Radial",
    category: "cycle",
    defaultItems: ["Center", "Spoke 1", "Spoke 2", "Spoke 3"],
  },
  {
    layout: "basicPie",
    label: "Basic Pie",
    category: "cycle",
    defaultItems: ["Segment 1", "Segment 2", "Segment 3"],
  },
  {
    layout: "convergingRadial",
    label: "Converging Radial",
    category: "cycle",
    defaultItems: ["Goal", "Input 1", "Input 2", "Input 3"],
  },
  // Hierarchy
  {
    layout: "hierarchy",
    label: "Hierarchy",
    category: "hierarchy",
    defaultItems: ["Manager", "Lead A", "Lead B"],
  },
  // Relationship
  {
    layout: "basicVenn",
    label: "Basic Venn",
    category: "relationship",
    defaultItems: ["Set A", "Set B", "Set C"],
  },
  {
    layout: "linearVenn",
    label: "Linear Venn",
    category: "relationship",
    defaultItems: ["Group 1", "Group 2", "Group 3"],
  },
  {
    layout: "alternatingHexagons",
    label: "Alternating Hexagons",
    category: "relationship",
    defaultItems: ["Hex 1", "Hex 2", "Hex 3"],
  },
  {
    layout: "trapezoidList",
    label: "Trapezoid List",
    category: "relationship",
    defaultItems: ["Level 1", "Level 2", "Level 3"],
  },
];

// ── Category sidebar entries ─────────────────────────────────────────────────

export const CATEGORIES: Array<{ id: SmartArtCategory; label: string }> = [
  { id: "list", label: "pptx.smartart.category.list" },
  { id: "process", label: "pptx.smartart.category.process" },
  { id: "cycle", label: "pptx.smartart.category.cycle" },
  { id: "hierarchy", label: "pptx.smartart.category.hierarchy" },
  { id: "relationship", label: "pptx.smartart.category.relationship" },
];
