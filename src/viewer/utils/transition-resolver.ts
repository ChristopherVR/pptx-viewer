/**
 * Main resolver that maps PptxTransitionType + direction/orient/spokes
 * to concrete CSS animation descriptors for outgoing and incoming layers.
 */
import type { PptxTransitionType } from "../../core";

import type { SlideTransitionAnimations } from "./transition-keyframes";
import {
  type ResolvedDirection,
  type ResolvedDirection8,
  resolveDirection,
  resolveDirection8,
  resolveOrientation,
  RANDOM_ELIGIBLE_TYPES,
  INSTANT,
} from "./transition-helpers";

/**
 * Return CSS animation descriptors for the outgoing (old) and incoming (new)
 * slide layers based on the transition type, duration, and direction.
 */
export function getSlideTransitionAnimations(
  type: PptxTransitionType,
  durationMs: number,
  direction: string | undefined,
  orient?: string | undefined,
  spokes?: number | undefined,
): SlideTransitionAnimations {
  const dur = `${durationMs}ms`;
  const ease = "ease-in-out";

  switch (type) {
    case "none":
    case "cut":
      return INSTANT;

    // ── Fade ────────────────────────────────────────────────────────
    case "fade":
      return {
        outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-fade-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };

    // ── Push ────────────────────────────────────────────────────────
    case "push": {
      const dir = resolveDirection(direction, "left");
      const configs: Record<ResolvedDirection, SlideTransitionAnimations> = {
        left: {
          outgoing: `pptx-tr-push-out-to-left ${dur} ${ease} forwards`,
          incoming: `pptx-tr-push-in-from-right ${dur} ${ease} forwards`,
          outgoingOnTop: false,
        },
        right: {
          outgoing: `pptx-tr-push-out-to-right ${dur} ${ease} forwards`,
          incoming: `pptx-tr-push-in-from-left ${dur} ${ease} forwards`,
          outgoingOnTop: false,
        },
        up: {
          outgoing: `pptx-tr-push-out-to-top ${dur} ${ease} forwards`,
          incoming: `pptx-tr-push-in-from-bottom ${dur} ${ease} forwards`,
          outgoingOnTop: false,
        },
        down: {
          outgoing: `pptx-tr-push-out-to-bottom ${dur} ${ease} forwards`,
          incoming: `pptx-tr-push-in-from-top ${dur} ${ease} forwards`,
          outgoingOnTop: false,
        },
      };
      return configs[dir];
    }

    // ── Wipe ────────────────────────────────────────────────────────
    case "wipe": {
      const dir = resolveDirection(direction, "left");
      const wipeNames: Record<ResolvedDirection, string> = {
        left: `pptx-tr-wipe-from-left ${dur} ${ease} forwards`,
        right: `pptx-tr-wipe-from-right ${dur} ${ease} forwards`,
        up: `pptx-tr-wipe-from-top ${dur} ${ease} forwards`,
        down: `pptx-tr-wipe-from-bottom ${dur} ${ease} forwards`,
      };
      return {
        outgoing: "none",
        incoming: wipeNames[dir],
        outgoingOnTop: false,
      };
    }

    // ── Cover (with diagonal support) ───────────────────────────────
    case "cover": {
      const dir = resolveDirection8(direction, "left");
      const coverMap: Record<ResolvedDirection8, string> = {
        left: `pptx-tr-cover-from-left ${dur} ${ease} forwards`,
        right: `pptx-tr-cover-from-right ${dur} ${ease} forwards`,
        up: `pptx-tr-cover-from-top ${dur} ${ease} forwards`,
        down: `pptx-tr-cover-from-bottom ${dur} ${ease} forwards`,
        lu: `pptx-tr-cover-from-lu ${dur} ${ease} forwards`,
        ld: `pptx-tr-cover-from-ld ${dur} ${ease} forwards`,
        ru: `pptx-tr-cover-from-ru ${dur} ${ease} forwards`,
        rd: `pptx-tr-cover-from-rd ${dur} ${ease} forwards`,
      };
      return {
        outgoing: "none",
        incoming: coverMap[dir],
        outgoingOnTop: false,
      };
    }

    // ── Uncover (with diagonal support) ─────────────────────────────
    case "uncover": {
      const dir = resolveDirection8(direction, "left");
      const uncoverMap: Record<ResolvedDirection8, string> = {
        left: `pptx-tr-uncover-to-left ${dur} ${ease} forwards`,
        right: `pptx-tr-uncover-to-right ${dur} ${ease} forwards`,
        up: `pptx-tr-uncover-to-top ${dur} ${ease} forwards`,
        down: `pptx-tr-uncover-to-bottom ${dur} ${ease} forwards`,
        lu: `pptx-tr-uncover-to-lu ${dur} ${ease} forwards`,
        ld: `pptx-tr-uncover-to-ld ${dur} ${ease} forwards`,
        ru: `pptx-tr-uncover-to-ru ${dur} ${ease} forwards`,
        rd: `pptx-tr-uncover-to-rd ${dur} ${ease} forwards`,
      };
      return {
        outgoing: uncoverMap[dir],
        incoming: "none",
        outgoingOnTop: true,
      };
    }

    // ── Split (in/out + horz/vert) ───────────────────────────────────
    case "split": {
      const o = resolveOrientation(undefined, orient);
      const isOut = direction !== "in";
      if (isOut) {
        return {
          outgoing: "none",
          incoming:
            o === "vert"
              ? `pptx-tr-split-v-out ${dur} ${ease} forwards`
              : `pptx-tr-split-h-out ${dur} ${ease} forwards`,
          outgoingOnTop: false,
        };
      }
      return {
        outgoing:
          o === "vert"
            ? `pptx-tr-split-v-in ${dur} ${ease} forwards`
            : `pptx-tr-split-h-in ${dur} ${ease} forwards`,
        incoming: "none",
        outgoingOnTop: true,
      };
    }

    // ── Dissolve ────────────────────────────────────────────────────
    case "dissolve":
      return {
        outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-dissolve-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };

    // ── Clip-path shape transitions ─────────────────────────────────
    case "circle":
      return {
        outgoing: "none",
        incoming: `pptx-tr-circle-in ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    case "diamond":
      return {
        outgoing: "none",
        incoming: `pptx-tr-diamond-in ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    case "plus":
      return {
        outgoing: "none",
        incoming: `pptx-tr-plus-in ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    case "wedge":
      return {
        outgoing: "none",
        incoming: `pptx-tr-wedge-in ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    case "wheel":
      return {
        outgoing: "none",
        incoming: `pptx-tr-wheel-in ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };

    // ── Zoom ────────────────────────────────────────────────────────
    case "zoom":
      return {
        outgoing: `pptx-tr-zoom-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-zoom-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };

    // ── Blinds (orientation-aware) ──────────────────────────────────
    case "blinds": {
      const o = resolveOrientation(direction, orient);
      return {
        outgoing: "none",
        incoming:
          o === "vert"
            ? `pptx-tr-blinds-v ${dur} ${ease} forwards`
            : `pptx-tr-blinds-h ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    }

    // ── Checker ─────────────────────────────────────────────────────
    case "checker":
      return {
        outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-checker-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };

    // ── Comb (orientation-aware) ────────────────────────────────────
    case "comb": {
      const o = resolveOrientation(direction, orient);
      return {
        outgoing: "none",
        incoming:
          o === "vert"
            ? `pptx-tr-comb-v ${dur} ${ease} forwards`
            : `pptx-tr-comb-h ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    }

    // ── Strips (direction-aware diagonals) ──────────────────────────
    case "strips": {
      const stripDir =
        direction === "lu" ||
        direction === "ld" ||
        direction === "ru" ||
        direction === "rd"
          ? direction
          : "lu";
      return {
        outgoing: "none",
        incoming: `pptx-tr-strips-${stripDir} ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    }

    // ── RandomBar (orientation-aware) ────────────────────────────────
    case "randomBar": {
      const o = resolveOrientation(direction, orient);
      return {
        outgoing: "none",
        incoming:
          o === "vert"
            ? `pptx-tr-randombar-v ${dur} ${ease} forwards`
            : `pptx-tr-randombar-h ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    }

    // ── Newsflash ───────────────────────────────────────────────────
    case "newsflash":
      return {
        outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-newsflash-in ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };

    // ── Pull (alias for uncover) ────────────────────────────────────
    case "pull":
      return getSlideTransitionAnimations(
        "uncover",
        durationMs,
        direction,
        orient,
        spokes,
      );

    // ── Morph (fallback to crossfade) ───────────────────────────────
    case "morph":
      return {
        outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-fade-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };

    // ── Random ──────────────────────────────────────────────────────
    case "random": {
      const randomType =
        RANDOM_ELIGIBLE_TYPES[
          Math.floor(Math.random() * RANDOM_ELIGIBLE_TYPES.length)
        ];
      return getSlideTransitionAnimations(
        randomType,
        durationMs,
        direction,
        orient,
        spokes,
      );
    }

    // ── Fallback (unknown type) ─────────────────────────────────────
    default:
      return {
        outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-fade-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };
  }
}
