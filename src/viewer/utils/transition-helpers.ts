/**
 * Helper types and direction-resolution utilities for slide transitions.
 */
import type { PptxTransitionType } from "../../core";

import type { SlideTransitionAnimations } from "./transition-keyframes";

// ---------------------------------------------------------------------------
// Direction types
// ---------------------------------------------------------------------------

export type ResolvedDirection = "left" | "right" | "up" | "down";

export type ResolvedDirection8 = ResolvedDirection | "lu" | "ld" | "ru" | "rd";

// ---------------------------------------------------------------------------
// Direction resolvers
// ---------------------------------------------------------------------------

export function resolveDirection(
  direction: string | undefined,
  defaultDir: ResolvedDirection,
): ResolvedDirection {
  switch (direction) {
    case "l":
      return "left";
    case "r":
      return "right";
    case "u":
      return "up";
    case "d":
      return "down";
    default:
      return defaultDir;
  }
}

export function resolveDirection8(
  direction: string | undefined,
  defaultDir: ResolvedDirection,
): ResolvedDirection8 {
  switch (direction) {
    case "l":
      return "left";
    case "r":
      return "right";
    case "u":
      return "up";
    case "d":
      return "down";
    case "lu":
    case "ld":
    case "ru":
    case "rd":
      return direction;
    default:
      return defaultDir;
  }
}

export function resolveOrientation(
  direction: string | undefined,
  orient: string | undefined,
): "horz" | "vert" {
  if (orient === "horz" || orient === "vert") return orient;
  if (direction === "horz" || direction === "vert") return direction;
  return "horz";
}

// ---------------------------------------------------------------------------
// Transition types eligible for random selection
// ---------------------------------------------------------------------------

export const RANDOM_ELIGIBLE_TYPES: PptxTransitionType[] = [
  "fade",
  "push",
  "wipe",
  "cover",
  "dissolve",
  "circle",
  "zoom",
];

// ---------------------------------------------------------------------------
// No-animation sentinel
// ---------------------------------------------------------------------------

export const INSTANT: SlideTransitionAnimations = {
  outgoing: "none",
  incoming: "none",
  outgoingOnTop: true,
};
