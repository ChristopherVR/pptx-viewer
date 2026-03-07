/**
 * Pre-defined shape quick-style presets (inspired by PowerPoint's Shape Styles gallery).
 */

import type { ShapeQuickStyle } from "../types";

export const SHAPE_QUICK_STYLES: ShapeQuickStyle[] = [
  // Row 1 — Solid fills (theme-inspired palette)
  {
    name: "Blue Fill",
    style: {
      fillMode: "solid",
      fillColor: "#4472C4",
      strokeColor: "#2F5597",
      strokeWidth: 1,
    },
  },
  {
    name: "Orange Fill",
    style: {
      fillMode: "solid",
      fillColor: "#ED7D31",
      strokeColor: "#C55A11",
      strokeWidth: 1,
    },
  },
  {
    name: "Grey Fill",
    style: {
      fillMode: "solid",
      fillColor: "#A5A5A5",
      strokeColor: "#7F7F7F",
      strokeWidth: 1,
    },
  },
  {
    name: "Gold Fill",
    style: {
      fillMode: "solid",
      fillColor: "#FFC000",
      strokeColor: "#BF9000",
      strokeWidth: 1,
    },
  },
  {
    name: "Green Fill",
    style: {
      fillMode: "solid",
      fillColor: "#70AD47",
      strokeColor: "#548235",
      strokeWidth: 1,
    },
  },
  {
    name: "Teal Fill",
    style: {
      fillMode: "solid",
      fillColor: "#5B9BD5",
      strokeColor: "#2E75B6",
      strokeWidth: 1,
    },
  },
  // Row 2 — Outline-only styles
  {
    name: "Blue Outline",
    style: {
      fillMode: "none",
      fillColor: "transparent",
      strokeColor: "#4472C4",
      strokeWidth: 2,
    },
  },
  {
    name: "Orange Outline",
    style: {
      fillMode: "none",
      fillColor: "transparent",
      strokeColor: "#ED7D31",
      strokeWidth: 2,
    },
  },
  {
    name: "Grey Outline",
    style: {
      fillMode: "none",
      fillColor: "transparent",
      strokeColor: "#A5A5A5",
      strokeWidth: 2,
    },
  },
  {
    name: "Gold Outline",
    style: {
      fillMode: "none",
      fillColor: "transparent",
      strokeColor: "#FFC000",
      strokeWidth: 2,
    },
  },
  {
    name: "Green Outline",
    style: {
      fillMode: "none",
      fillColor: "transparent",
      strokeColor: "#70AD47",
      strokeWidth: 2,
    },
  },
  {
    name: "Teal Outline",
    style: {
      fillMode: "none",
      fillColor: "transparent",
      strokeColor: "#5B9BD5",
      strokeWidth: 2,
    },
  },
  // Row 3 — Fills with shadow
  {
    name: "Blue Shadow",
    style: {
      fillMode: "solid",
      fillColor: "#4472C4",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.35)",
      shadowBlur: 6,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
    },
  },
  {
    name: "Orange Shadow",
    style: {
      fillMode: "solid",
      fillColor: "#ED7D31",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.35)",
      shadowBlur: 6,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
    },
  },
  {
    name: "Dark Fill",
    style: {
      fillMode: "solid",
      fillColor: "#2F5597",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.4)",
      shadowBlur: 8,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
    },
  },
  {
    name: "Dark Orange",
    style: {
      fillMode: "solid",
      fillColor: "#C55A11",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.4)",
      shadowBlur: 8,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
    },
  },
  {
    name: "Dark Green",
    style: {
      fillMode: "solid",
      fillColor: "#548235",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.4)",
      shadowBlur: 8,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
    },
  },
  {
    name: "White Fill",
    style: {
      fillMode: "solid",
      fillColor: "#FFFFFF",
      strokeColor: "#D9D9D9",
      strokeWidth: 1,
      shadowColor: "rgba(0,0,0,0.2)",
      shadowBlur: 4,
      shadowOffsetX: 1,
      shadowOffsetY: 1,
    },
  },
];
