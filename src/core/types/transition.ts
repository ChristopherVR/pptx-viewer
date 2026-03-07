/**
 * Slide transition types and the {@link PptxSlideTransition} data structure.
 *
 * Represents the `<p:transition>` element on each slide, including
 * transition type, duration, direction, and advance timing.
 *
 * @module pptx-types/transition
 */

// ==========================================================================
// Slide transition types
// ==========================================================================

import type { XmlObject } from "./common";

/**
 * Available slide transition effects.
 *
 * Maps to the OOXML child element names under `<p:transition>` / `<p14:transition>`.
 *
 * @example
 * ```ts
 * const t: PptxTransitionType = "morph";
 * // => "morph" — one of 40+ transition effects
 * ```
 */
export type PptxTransitionType =
  | "none"
  | "cut"
  | "fade"
  | "push"
  | "wipe"
  | "split"
  | "randomBar"
  | "blinds"
  | "checker"
  | "circle"
  | "comb"
  | "cover"
  | "diamond"
  | "dissolve"
  | "plus"
  | "pull"
  | "random"
  | "strips"
  | "uncover"
  | "wedge"
  | "wheel"
  | "zoom"
  | "newsflash"
  | "morph"
  | "conveyor"
  | "doors"
  | "ferris"
  | "flash"
  | "flythrough"
  | "gallery"
  | "glitter"
  | "honeycomb"
  | "pan"
  | "prism"
  | "reveal"
  | "ripple"
  | "shred"
  | "switch"
  | "vortex"
  | "warp"
  | "wheelReverse"
  | "window";

/** Cardinal direction tokens from OOXML transition `@_dir`. */
export type PptxTransitionDirection4 = "l" | "r" | "u" | "d";

/** 8-way direction tokens (cardinal + diagonal) for cover/uncover. */
export type PptxTransitionDirection8 =
  | PptxTransitionDirection4
  | "lu"
  | "ld"
  | "ru"
  | "rd";

/** Strip direction tokens from OOXML. */
export type PptxStripDirection = "lu" | "ld" | "ru" | "rd";

/** Split orientation from OOXML `@_orient`. */
export type PptxSplitOrientation = "horz" | "vert";

/** Split in/out direction from OOXML `@_dir`. */
export type PptxSplitDirection = "in" | "out";

/** Valid direction sets per transition type. */
export const TRANSITION_VALID_DIRECTIONS: Readonly<
  Partial<Record<PptxTransitionType, readonly string[]>>
> = {
  push: ["l", "r", "u", "d"] as const,
  wipe: ["l", "r", "u", "d"] as const,
  cover: ["l", "r", "u", "d", "lu", "ld", "ru", "rd"] as const,
  uncover: ["l", "r", "u", "d", "lu", "ld", "ru", "rd"] as const,
  pull: ["l", "r", "u", "d", "lu", "ld", "ru", "rd"] as const,
  strips: ["lu", "ld", "ru", "rd"] as const,
  split: ["in", "out"] as const,
  blinds: ["horz", "vert"] as const,
  checker: ["horz", "vert"] as const,
  comb: ["horz", "vert"] as const,
  randomBar: ["horz", "vert"] as const,
};

/**
 * Slide transition configuration.
 *
 * @example
 * ```ts
 * const transition: PptxSlideTransition = {
 *   type: "fade",
 *   durationMs: 700,
 *   advanceOnClick: true,
 *   advanceAfterMs: 5000,
 * };
 * // => { type: "fade", durationMs: 700, advanceOnClick: true, advanceAfterMs: 5000 }
 * ```
 */
export interface PptxSlideTransition {
  type: PptxTransitionType;
  durationMs?: number;
  direction?: string;
  advanceOnClick?: boolean;
  advanceAfterMs?: number;
  /** Number of spokes for wheel transition (1-8). */
  spokes?: number;
  /** Pattern type for shred transition. */
  pattern?: string;
  /** Through-black flag for blinds/checker (OOXML `@_thruBlk`). */
  thruBlk?: boolean;
  /** Split orientation (horz/vert) parsed from `@_orient`. */
  orient?: PptxSplitOrientation;
  /** Relationship ID of transition sound from `p:sndAc/p:stSnd/@r:embed` when present. */
  soundRId?: string;
  /** Resolved transition sound media path within the package. */
  soundPath?: string;
  /** Human-readable sound file name (extracted from soundPath). */
  soundFileName?: string;
  /** Preserved sound-action XML node from `p:sndAc` for lossless round-trip. */
  rawSoundAction?: XmlObject;
  /** Preserved extension-list XML node from `p:extLst` within the transition for lossless round-trip. */
  rawExtLst?: XmlObject;
}
