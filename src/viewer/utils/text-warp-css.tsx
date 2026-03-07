import type { TextStyle } from "../../core";

/**
 * Maps OOXML prstTxWarp presets to CSS transform approximations.
 * Full path-based warps are not possible in CSS; these are visual hints.
 */
export function getTextWarpStyle(
  textStyle: TextStyle | undefined,
): React.CSSProperties | undefined {
  const preset = textStyle?.textWarpPreset;
  if (!preset || preset === "textNoShape" || preset === "textPlain") {
    return undefined;
  }

  switch (preset) {
    // Arch shapes
    case "textArchUp":
    case "textArchUpPour":
      return {
        transform: "perspective(400px) rotateX(-12deg)",
        transformOrigin: "center bottom",
      };
    case "textArchDown":
    case "textArchDownPour":
      return {
        transform: "perspective(400px) rotateX(12deg)",
        transformOrigin: "center top",
      };
    // Button shapes (concave/convex)
    case "textButton":
    case "textButtonPour":
      return {
        transform: "perspective(500px) rotateX(8deg)",
        transformOrigin: "center top",
      };
    // Chevron / arrow
    case "textChevron":
    case "textChevronInverted":
      return {
        transform: "perspective(600px) rotateY(6deg)",
        transformOrigin: "center center",
      };
    // Circle
    case "textCircle":
    case "textCirclePour":
      return {
        transform: "perspective(350px) rotateX(-5deg) rotateY(5deg)",
        borderRadius: "50%",
      };
    // Slant
    case "textSlantUp":
      return {
        transform: "perspective(500px) rotateY(8deg) skewY(-4deg)",
        transformOrigin: "left center",
      };
    case "textSlantDown":
      return {
        transform: "perspective(500px) rotateY(-8deg) skewY(4deg)",
        transformOrigin: "right center",
      };
    // Fade
    case "textFadeUp":
      return {
        transform: "perspective(400px) rotateX(-10deg)",
        transformOrigin: "center bottom",
      };
    case "textFadeDown":
      return {
        transform: "perspective(400px) rotateX(10deg)",
        transformOrigin: "center top",
      };
    case "textFadeLeft":
      return {
        transform: "perspective(400px) rotateY(10deg)",
        transformOrigin: "right center",
      };
    case "textFadeRight":
      return {
        transform: "perspective(400px) rotateY(-10deg)",
        transformOrigin: "left center",
      };
    // Inflate / Deflate
    case "textInflate":
    case "textInflateBottom":
    case "textInflateTop":
      return {
        transform: "scaleY(1.15) scaleX(1.05)",
        transformOrigin: "center center",
      };
    case "textDeflate":
    case "textDeflateBottom":
    case "textDeflateTop":
      return {
        transform: "scaleY(0.88) scaleX(0.95)",
        transformOrigin: "center center",
      };
    // Wave
    case "textWave1":
    case "textWave2":
    case "textWave4":
      return {
        transform: "perspective(600px) rotateX(-3deg) skewX(3deg)",
        transformOrigin: "center center",
      };
    case "textDoubleWave1":
      return {
        transform: "perspective(600px) rotateX(-2deg) skewX(4deg)",
        transformOrigin: "center center",
      };
    // Triangle / Trapezoid
    case "textTriangle":
    case "textTriangleInverted":
      return {
        transform: "perspective(500px) rotateX(-6deg)",
        transformOrigin: "center bottom",
      };
    // Ring
    case "textRingInside":
    case "textRingOutside":
      return {
        transform: "perspective(350px) rotateX(-4deg) rotateY(4deg)",
        transformOrigin: "center center",
      };
    // Can
    case "textCanUp":
    case "textCanDown":
      return {
        transform: "perspective(400px) rotateX(-6deg)",
        transformOrigin: "center center",
      };
    // Cascade
    case "textCascadeUp":
      return {
        transform: "skewY(-8deg)",
        transformOrigin: "left top",
      };
    case "textCascadeDown":
      return {
        transform: "skewY(8deg)",
        transformOrigin: "left top",
      };
    // Curve
    case "textCurveUp":
      return {
        transform: "perspective(500px) rotateX(-8deg)",
        transformOrigin: "center bottom",
      };
    case "textCurveDown":
      return {
        transform: "perspective(500px) rotateX(8deg)",
        transformOrigin: "center top",
      };
    // Inflate/Deflate compound variants
    case "textDeflateInflate":
      return {
        transform: "scaleY(0.92) scaleX(1.04)",
        transformOrigin: "center center",
      };
    case "textDeflateInflateDeflate":
      return {
        transform: "scaleY(0.85) scaleX(1.06)",
        transformOrigin: "center center",
      };
    // Stop / Octagon
    case "textStop":
      return {
        transform: "scaleX(0.9) scaleY(0.9)",
        transformOrigin: "center center",
      };
    default:
      return undefined;
  }
}
