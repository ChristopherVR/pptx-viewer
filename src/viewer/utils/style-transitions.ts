/**
 * Build CSS style for presentation-mode slide transitions.
 * Maps OOXML transition types to visually distinct CSS transform+opacity animations.
 */
export function getPresentationTransitionStyle(
  visible: boolean,
  transitionType: string | undefined,
  durationMs: number | undefined,
  direction: string | undefined,
): React.CSSProperties {
  const duration = Math.max(120, durationMs || 320);
  const transition = `opacity ${duration}ms ease, transform ${duration}ms ease, clip-path ${duration}ms ease, filter ${duration}ms ease`;

  if (!visible) {
    // Exit animation — each type gets a visually distinct hidden state
    switch (transitionType) {
      case "push": {
        const dir = direction || "l";
        const translate =
          dir === "r"
            ? "-100%, 0"
            : dir === "u"
              ? "0, 100%"
              : dir === "d"
                ? "0, -100%"
                : "100%, 0";
        return { opacity: 0, transform: `translate(${translate})`, transition };
      }
      case "cover": {
        // Cover: new slide covers old — old stays, fades slightly
        const dir = direction || "l";
        const translate =
          dir === "r"
            ? "30%, 0"
            : dir === "u"
              ? "0, -30%"
              : dir === "d"
                ? "0, 30%"
                : "-30%, 0";
        return {
          opacity: 0.2,
          transform: `translate(${translate})`,
          transition,
        };
      }
      case "uncover": {
        // Uncover: old slide moves away to reveal new
        const dir = direction || "l";
        const translate =
          dir === "r"
            ? "-100%, 0"
            : dir === "u"
              ? "0, 100%"
              : dir === "d"
                ? "0, -100%"
                : "100%, 0";
        return { opacity: 0, transform: `translate(${translate})`, transition };
      }
      case "wipe": {
        // Wipe: reveal via progressive clip from one edge
        const dir = direction || "l";
        const clip =
          dir === "r"
            ? "inset(0 0 0 100%)"
            : dir === "u"
              ? "inset(0 0 100% 0)"
              : dir === "d"
                ? "inset(100% 0 0 0)"
                : "inset(0 100% 0 0)";
        return { opacity: 1, clipPath: clip, transition };
      }
      case "blinds": {
        // Blinds: horizontal slat reveal (simulate with repeating clip)
        const dir = direction || "horz";
        if (dir === "vert") {
          return {
            opacity: 0,
            clipPath: "inset(0 0 0 100%)",
            transition: `opacity ${duration}ms steps(6), clip-path ${duration}ms ease`,
          };
        }
        return {
          opacity: 0,
          clipPath: "inset(100% 0 0 0)",
          transition: `opacity ${duration}ms steps(6), clip-path ${duration}ms ease`,
        };
      }
      case "checker": {
        // Checker: dissolve via opacity stepping (checkerboard approximation)
        return {
          opacity: 0,
          filter: "grayscale(100%)",
          transition: `opacity ${duration}ms steps(8), filter ${duration}ms ease`,
        };
      }
      case "comb": {
        // Comb: alternating strips slide in
        const dir = direction || "horz";
        if (dir === "vert") {
          return {
            opacity: 0,
            clipPath: "inset(100% 0 0 0)",
            transition: `opacity ${duration}ms steps(10), clip-path ${duration}ms ease`,
          };
        }
        return {
          opacity: 0,
          clipPath: "inset(0 100% 0 0)",
          transition: `opacity ${duration}ms steps(10), clip-path ${duration}ms ease`,
        };
      }
      case "randomBar": {
        // Random bars: appear in random strips (simulate with stepped opacity)
        return {
          opacity: 0,
          transition: `opacity ${duration}ms steps(12)`,
        };
      }
      case "strips": {
        // Strips: diagonal reveal
        const dir = direction || "ld";
        const clip =
          dir === "ru"
            ? "polygon(100% 0%, 100% 0%, 100% 0%)"
            : dir === "lu"
              ? "polygon(0% 0%, 0% 0%, 0% 0%)"
              : dir === "rd"
                ? "polygon(100% 100%, 100% 100%, 100% 100%)"
                : "polygon(0% 100%, 0% 100%, 0% 100%)";
        return { opacity: 0, clipPath: clip, transition };
      }
      case "split": {
        const dir = direction || "horz";
        if (dir === "vert") {
          return { opacity: 0, clipPath: "inset(50% 0 50% 0)", transition };
        }
        return { opacity: 0, clipPath: "inset(0 50% 0 50%)", transition };
      }
      case "circle":
        return { opacity: 0, clipPath: "circle(0% at 50% 50%)", transition };
      case "diamond":
        return {
          opacity: 0,
          clipPath: "polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)",
          transition,
        };
      case "zoom":
        return { opacity: 0, transform: "scale(0.01)", transition };
      case "morph":
        return {
          opacity: 0,
          transform: "scale(0.85)",
          filter: "blur(4px)",
          transition,
        };
      case "wedge":
        // Wedge: triangular reveal expanding from center-top
        return {
          opacity: 0,
          clipPath: "polygon(50% 0%, 50% 0%, 50% 0%)",
          transition,
        };
      case "wheel": {
        // Wheel: circular sweep (approximated with expanding polygon)
        return {
          opacity: 0,
          clipPath: "polygon(50% 50%, 50% 0%, 50% 0%)",
          transition,
        };
      }
      case "newsflash":
        // Newsflash: spin + zoom in
        return { opacity: 0, transform: "rotate(720deg) scale(0)", transition };
      case "dissolve":
        return { opacity: 0, filter: "blur(8px)", transition };
      case "random":
        // Random: use a generic fade+scale
        return {
          opacity: 0,
          transform: "scale(0.9)",
          filter: "blur(2px)",
          transition,
        };
      case "fade":
      default:
        return { opacity: 0, transition };
    }
  }

  // Enter animation — visible state (rest position)
  const baseEnter: React.CSSProperties = {
    opacity: 1,
    transform: "translate(0, 0) scale(1) rotate(0deg)",
    filter: "none",
    transition,
  };

  // Some types need specific clip-path in their visible end-state
  switch (transitionType) {
    case "circle":
      baseEnter.clipPath = "circle(100% at 50% 50%)";
      break;
    case "diamond":
      baseEnter.clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
      break;
    case "split":
      baseEnter.clipPath = "inset(0 0 0 0)";
      break;
    case "wedge":
      baseEnter.clipPath = "polygon(50% 0%, 100% 100%, 0% 100%)";
      break;
    case "wheel":
      baseEnter.clipPath =
        "polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 50% 0%)";
      break;
    case "wipe":
    case "blinds":
    case "comb":
    case "strips":
      baseEnter.clipPath = "inset(0 0 0 0)";
      break;
  }

  return baseEnter;
}
