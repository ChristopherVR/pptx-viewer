/**
 * Primary shape definitions: Basic, Rectangles, Stars and Banners, Math, and Other.
 *
 * Each entry in the array is a {@link PresetShapeDefinition} with:
 * - `name` — The canonical OOXML preset geometry name (camelCase).
 * - `label` — A human-readable display label for the shape picker UI.
 * - `category` — The {@link PresetShapeCategory} grouping.
 *
 * This file contains the first half of shape definitions. The second
 * half (arrows, callouts, flowchart, action buttons) lives in
 * `shape-definitions-extended.ts`.
 */
import type { PresetShapeDefinition } from "./preset-shape-types";

/**
 * Shape definitions for basic shapes, rectangle variants, stars and banners,
 * math operators, and other miscellaneous shapes.
 */
export const PRIMARY_SHAPE_DEFINITIONS: PresetShapeDefinition[] = [
  // ── Basic Shapes ──────────────────────────────────────────────────────
  { name: "rect", label: "Rectangle", category: "basic" },
  { name: "roundRect", label: "Rounded Rectangle", category: "basic" },
  { name: "ellipse", label: "Ellipse", category: "basic" },
  { name: "triangle", label: "Triangle", category: "basic" },
  { name: "rtTriangle", label: "Right Triangle", category: "basic" },
  { name: "diamond", label: "Diamond", category: "basic" },
  { name: "parallelogram", label: "Parallelogram", category: "basic" },
  { name: "trapezoid", label: "Trapezoid", category: "basic" },
  { name: "pentagon", label: "Pentagon", category: "basic" },
  { name: "hexagon", label: "Hexagon", category: "basic" },
  { name: "heptagon", label: "Heptagon", category: "basic" },
  { name: "octagon", label: "Octagon", category: "basic" },
  { name: "decagon", label: "Decagon", category: "basic" },
  { name: "dodecagon", label: "Dodecagon", category: "basic" },
  { name: "cross", label: "Cross", category: "basic" },
  { name: "frame", label: "Frame", category: "basic" },
  { name: "halfFrame", label: "Half Frame", category: "basic" },
  { name: "corner", label: "Corner", category: "basic" },
  { name: "diagStripe", label: "Diagonal Stripe", category: "basic" },
  { name: "donut", label: "Donut", category: "basic" },
  { name: "noSmoking", label: "No Symbol", category: "basic" },
  { name: "blockArc", label: "Block Arc", category: "basic" },
  { name: "heart", label: "Heart", category: "basic" },
  { name: "lightningBolt", label: "Lightning Bolt", category: "basic" },
  { name: "sun", label: "Sun", category: "basic" },
  { name: "moon", label: "Moon", category: "basic" },
  { name: "cloud", label: "Cloud", category: "basic" },
  { name: "smileyFace", label: "Smiley Face", category: "basic" },
  { name: "foldedCorner", label: "Folded Corner", category: "basic" },
  { name: "can", label: "Cylinder", category: "basic" },
  { name: "cube", label: "Cube", category: "basic" },
  { name: "bevel", label: "Bevel", category: "basic" },
  { name: "funnel", label: "Funnel", category: "basic" },
  { name: "teardrop", label: "Teardrop", category: "basic" },
  { name: "plaque", label: "Plaque", category: "basic" },
  { name: "wave", label: "Wave", category: "basic" },
  { name: "doubleWave", label: "Double Wave", category: "basic" },

  // ── Rectangle Variants ────────────────────────────────────────────────
  { name: "round1Rect", label: "Round Single Corner", category: "rectangles" },
  {
    name: "round2SameRect",
    label: "Round Same-Side Corners",
    category: "rectangles",
  },
  {
    name: "round2DiagRect",
    label: "Round Diagonal Corners",
    category: "rectangles",
  },
  { name: "snip1Rect", label: "Snip Single Corner", category: "rectangles" },
  {
    name: "snip2SameRect",
    label: "Snip Same-Side Corners",
    category: "rectangles",
  },
  {
    name: "snip2DiagRect",
    label: "Snip Diagonal Corners",
    category: "rectangles",
  },
  {
    name: "snipRoundRect",
    label: "Snip and Round Corner",
    category: "rectangles",
  },
  {
    name: "nonIsoscelesTrapezoid",
    label: "Non-Isosceles Trapezoid",
    category: "rectangles",
  },

  // ── Stars & Banners ──────────────────────────────────────────────────
  { name: "star4", label: "4-Point Star", category: "stars" },
  { name: "star5", label: "5-Point Star", category: "stars" },
  { name: "star6", label: "6-Point Star", category: "stars" },
  { name: "star7", label: "7-Point Star", category: "stars" },
  { name: "star8", label: "8-Point Star", category: "stars" },
  { name: "star10", label: "10-Point Star", category: "stars" },
  { name: "star12", label: "12-Point Star", category: "stars" },
  { name: "star16", label: "16-Point Star", category: "stars" },
  { name: "star24", label: "24-Point Star", category: "stars" },
  { name: "star32", label: "32-Point Star", category: "stars" },
  { name: "ribbon", label: "Ribbon", category: "stars" },
  { name: "ribbon2", label: "Ribbon 2", category: "stars" },
  { name: "verticalScroll", label: "Vertical Scroll", category: "stars" },
  { name: "horizontalScroll", label: "Horizontal Scroll", category: "stars" },
  { name: "irregularSeal1", label: "Explosion 1", category: "stars" },
  { name: "irregularSeal2", label: "Explosion 2", category: "stars" },

  // ── Math ──────────────────────────────────────────────────────────────
  { name: "mathDivide", label: "Division", category: "math" },
  { name: "mathEqual", label: "Equal", category: "math" },
  { name: "mathNotEqual", label: "Not Equal", category: "math" },
  { name: "mathPlus", label: "Plus", category: "math" },
  { name: "mathMinus", label: "Minus", category: "math" },
  { name: "mathMultiply", label: "Multiply", category: "math" },

  // ── Other ─────────────────────────────────────────────────────────────
  { name: "gear6", label: "Gear (6 teeth)", category: "other" },
  { name: "gear9", label: "Gear (9 teeth)", category: "other" },
  { name: "leftRightRibbon", label: "Left-Right Ribbon", category: "other" },
  { name: "pie", label: "Pie", category: "other" },
  { name: "pieWedge", label: "Pie Wedge", category: "other" },
  { name: "leftBrace", label: "Left Brace", category: "other" },
  { name: "rightBrace", label: "Right Brace", category: "other" },
  { name: "leftBracket", label: "Left Bracket", category: "other" },
  { name: "rightBracket", label: "Right Bracket", category: "other" },
  { name: "bracePair", label: "Brace Pair", category: "other" },
  { name: "bracketPair", label: "Bracket Pair", category: "other" },
];
