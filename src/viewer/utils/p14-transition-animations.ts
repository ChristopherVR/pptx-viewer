/**
 * Animation resolvers for Office 2010 (p14 namespace) slide transitions.
 *
 * Maps p14 transition types to CSS animation descriptors following the same
 * pattern as the core `getSlideTransitionAnimations` in `slide-transitions.ts`.
 */
import type { PptxTransitionType } from "../../core";
import type { SlideTransitionAnimations } from "./slide-transitions";

// ---------------------------------------------------------------------------
// Direction helpers
// ---------------------------------------------------------------------------

type LR = "l" | "r";

function resolveLR(direction: string | undefined): LR {
  if (direction === "l" || direction === "r") return direction;
  return "l";
}

function resolveOrientation(
  direction: string | undefined,
  orient: string | undefined,
): "horz" | "vert" {
  if (orient === "horz" || orient === "vert") return orient;
  if (direction === "horz" || direction === "vert") return direction;
  return "horz";
}

type CardinalDir = "left" | "right" | "up" | "down";

function resolveCardinal(direction: string | undefined): CardinalDir {
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
      return "left";
  }
}

/** Build directional transition pair given per-direction keyframe name prefix. */
function directionalPair(
  direction: string | undefined,
  prefix: string,
  dur: string,
  ease: string,
): SlideTransitionAnimations {
  const dir = resolveCardinal(direction);
  const opposites: Record<CardinalDir, [string, string]> = {
    left: ["to-left", "from-right"],
    right: ["to-right", "from-left"],
    up: ["to-top", "from-bottom"],
    down: ["to-bottom", "from-top"],
  };
  const [outSuffix, inSuffix] = opposites[dir];
  return {
    outgoing: `${prefix}-${outSuffix} ${dur} ${ease} forwards`,
    incoming: `${prefix}-${inSuffix} ${dur} ${ease} forwards`,
    outgoingOnTop: false,
  };
}

// ---------------------------------------------------------------------------
// Main p14 resolver
// ---------------------------------------------------------------------------

/**
 * Return CSS animation descriptors for p14 transition types.
 * Returns `undefined` if the type is not a p14 transition.
 */
export function getP14TransitionAnimations(
  type: PptxTransitionType,
  durationMs: number,
  direction: string | undefined,
  orient?: string | undefined,
): SlideTransitionAnimations | undefined {
  const dur = `${durationMs}ms`;
  const ease = "ease-in-out";

  switch (type) {
    case "conveyor": {
      const lr = resolveLR(direction);
      if (lr === "l") {
        return {
          outgoing: `pptx-tr-conveyor-out-to-left ${dur} ${ease} forwards`,
          incoming: `pptx-tr-conveyor-in-from-right ${dur} ${ease} forwards`,
          outgoingOnTop: false,
        };
      }
      return {
        outgoing: `pptx-tr-conveyor-out-to-right ${dur} ${ease} forwards`,
        incoming: `pptx-tr-conveyor-in-from-left ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    }

    case "doors": {
      const o = resolveOrientation(direction, orient);
      return {
        outgoing: "none",
        incoming:
          o === "vert"
            ? `pptx-tr-doors-vert ${dur} ${ease} forwards`
            : `pptx-tr-doors-horz ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    }

    case "ferris": {
      const lr = resolveLR(direction);
      if (lr === "l") {
        return {
          outgoing: `pptx-tr-ferris-out-to-left ${dur} ${ease} forwards`,
          incoming: `pptx-tr-ferris-in-from-right ${dur} ${ease} forwards`,
          outgoingOnTop: false,
        };
      }
      return {
        outgoing: `pptx-tr-ferris-out-to-right ${dur} ${ease} forwards`,
        incoming: `pptx-tr-ferris-in-from-left ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    }

    case "flash":
      return {
        outgoing: `pptx-tr-flash-white ${dur} ${ease} forwards`,
        incoming: `pptx-tr-flash-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };

    case "flythrough": {
      const isOut = direction === "out";
      if (isOut) {
        return {
          outgoing: `pptx-tr-flythrough-reverse-out ${dur} ${ease} forwards`,
          incoming: `pptx-tr-flythrough-reverse-in ${dur} ${ease} forwards`,
          outgoingOnTop: true,
        };
      }
      return {
        outgoing: `pptx-tr-flythrough-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-flythrough-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };
    }

    case "gallery": {
      const lr = resolveLR(direction);
      if (lr === "l") {
        return {
          outgoing: `pptx-tr-gallery-out-to-left ${dur} ${ease} forwards`,
          incoming: `pptx-tr-gallery-in-from-right ${dur} ${ease} forwards`,
          outgoingOnTop: false,
        };
      }
      return {
        outgoing: `pptx-tr-gallery-out-to-right ${dur} ${ease} forwards`,
        incoming: `pptx-tr-gallery-in-from-left ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    }

    case "glitter":
      return {
        outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-glitter-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };

    case "honeycomb":
      return {
        outgoing: `pptx-tr-honeycomb-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-honeycomb-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };

    case "pan":
      return directionalPair(direction, "pptx-tr-pan", dur, ease);

    case "prism":
      return directionalPair(direction, "pptx-tr-prism", dur, ease);

    case "reveal": {
      const lr = resolveLR(direction);
      return {
        outgoing:
          lr === "l"
            ? `pptx-tr-reveal-out-to-left ${dur} ${ease} forwards`
            : `pptx-tr-reveal-out-to-right ${dur} ${ease} forwards`,
        incoming: `pptx-tr-reveal-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };
    }

    case "ripple":
      return {
        outgoing: "none",
        incoming: `pptx-tr-ripple-in ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };

    case "shred": {
      const pattern = direction === "rectangles" ? "rectangles" : "strips";
      return {
        outgoing: `pptx-tr-shred-out ${dur} ${ease} forwards`,
        incoming:
          pattern === "rectangles"
            ? `pptx-tr-shred-rectangles-in ${dur} ${ease} forwards`
            : `pptx-tr-shred-strips-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };
    }

    case "switch": {
      const lr = resolveLR(direction);
      if (lr === "l") {
        return {
          outgoing: `pptx-tr-switch-out-to-left ${dur} ${ease} forwards`,
          incoming: `pptx-tr-switch-in-from-right ${dur} ${ease} forwards`,
          outgoingOnTop: false,
        };
      }
      return {
        outgoing: `pptx-tr-switch-out-to-right ${dur} ${ease} forwards`,
        incoming: `pptx-tr-switch-in-from-left ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };
    }

    case "vortex":
      return {
        outgoing: `pptx-tr-vortex-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-vortex-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };

    case "warp": {
      const isOut = direction === "out";
      if (isOut) {
        return {
          outgoing: `pptx-tr-warp-reverse-out ${dur} ${ease} forwards`,
          incoming: `pptx-tr-warp-reverse-in ${dur} ${ease} forwards`,
          outgoingOnTop: true,
        };
      }
      return {
        outgoing: `pptx-tr-warp-out ${dur} ${ease} forwards`,
        incoming: `pptx-tr-warp-in ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };
    }

    case "wheelReverse":
      return {
        outgoing: "none",
        incoming: `pptx-tr-wheel-reverse-in ${dur} ${ease} forwards`,
        outgoingOnTop: false,
      };

    case "window": {
      const o = resolveOrientation(direction, orient);
      return {
        outgoing: `pptx-tr-window-out ${dur} ${ease} forwards`,
        incoming:
          o === "vert"
            ? `pptx-tr-window-vert ${dur} ${ease} forwards`
            : `pptx-tr-window-horz ${dur} ${ease} forwards`,
        outgoingOnTop: true,
      };
    }

    default:
      return undefined;
  }
}
