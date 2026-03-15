/**
 * SVG path generators for WordArt text warp presets.
 *
 * Each generator produces an SVG path `d` attribute for a single text line
 * at a given normalised vertical position (t: 0 = top, 1 = bottom).
 */
import type { PptxTextWarpPreset } from "pptx-viewer-core";
import { cascadeUpPath, cascadeDownPath } from "./warp-path-cascade";

/** Produces an SVG path `d` attribute for a single text line.
 *  Optional adj/adj2 are OOXML adjustment values (raw 1/60000th units). */
export type WarpPathGenerator = (w: number, h: number, t: number, adj?: number, adj2?: number) => string;

/** Presets that require SVG textPath rendering (all others fall back to CSS). */
export const SVG_WARP_PRESETS: ReadonlySet<string> = new Set([
  // Priority 1
  "textArchUp",
  "textArchDown",
  "textCircle",
  "textWave1",
  "textInflate",
  "textDeflate",
  "textCurveUp",
  "textCurveDown",
  // Priority 2
  "textWave2",
  "textWave4",
  "textDoubleWave1",
  "textCanUp",
  "textCanDown",
  "textButton",
  "textRingInside",
  "textRingOutside",
  "textCascadeUp",
  "textCascadeDown",
  // Priority 3
  "textTriangle",
  "textTriangleInverted",
  "textStop",
  "textChevron",
  "textChevronInverted",
  "textInflateBottom",
  "textInflateTop",
  "textDeflateBottom",
  "textDeflateTop",
  // Priority 4 – slant, fade, pour, and compound deflate/inflate
  "textSlantUp",
  "textSlantDown",
  "textFadeRight",
  "textFadeLeft",
  "textFadeUp",
  "textFadeDown",
  "textArchUpPour",
  "textArchDownPour",
  "textCirclePour",
  "textButtonPour",
  "textDeflateInflate",
  "textDeflateInflateDeflate",
]);

// ── Priority 1 path generators ─────────────────────────────────────────

/** Concentric upward arcs from (0, h) → (w, h).  t=0 is the tallest arch.
 *  adj (default 10800000) controls the arch height — higher values = taller arch. */
function archUpPath(w: number, h: number, t: number, adj?: number): string {
  // adj is in 60000ths of a degree; default ~10800000 (180 degrees).
  // Normalise to 0..1 where 0.5 is default (half-circle).
  const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
  const maxArch = 0.85 * adjNorm / 0.5;
  const archH = h * Math.max(0, maxArch - t * 0.7);
  if (archH < 1) return `M 0,${h} L ${w},${h}`;
  return `M 0,${h} A ${w / 2},${archH} 0 0,1 ${w},${h}`;
}

/** Concentric downward arcs from (0, 0) → (w, 0).  t=1 is the deepest.
 *  adj (default 10800000) controls the arch depth. */
function archDownPath(w: number, h: number, t: number, adj?: number): string {
  const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
  const baseDepth = 0.15 * adjNorm / 0.5;
  const archH = h * (baseDepth + t * 0.7);
  if (archH < 1) return `M 0,0 L ${w},0`;
  return `M 0,0 A ${w / 2},${archH} 0 0,0 ${w},0`;
}

/** Full ellipse - concentric ellipses shrink towards centre.
 *  adj (default 10800000) controls the arc span angle in 60000ths of a degree. */
function circlePath(w: number, h: number, t: number, adj?: number): string {
  const cx = w / 2;
  const cy = h / 2;
  // adj controls how much of the circle is used; default 10800000 = 180 degrees
  const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
  const baseScale = 0.45 + adjNorm * 1.1; // range ~0.45..1.55, default ~1.0
  const scale = Math.min(1, baseScale) - t * 0.55;
  const rx = Math.max(1, (w / 2) * scale);
  const ry = Math.max(1, (h / 2) * scale);
  return (
    `M ${cx},${cy - ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
  );
}

/** Single sine-wave from left to right using a cubic Bézier.
 *  adj (default 12500) controls wave amplitude.
 *  adj2 (default 0) controls horizontal phase shift. */
function wave1Path(w: number, h: number, t: number, adj?: number, adj2?: number): string {
  const yMid = h * (0.25 + t * 0.5);
  // adj default is 12500 (out of 100000); normalise to a proportion.
  const adjFactor = adj !== undefined ? adj / 12500 : 1;
  const amp = h * 0.2 * Math.max(0, Math.min(adjFactor, 4));
  // adj2 shifts control points horizontally; default 0 means no shift.
  // adj2 range is -100000..100000; normalise to -1..1
  const hShift = adj2 !== undefined ? (adj2 / 100000) * w * 0.3 : 0;
  const cp1x = w / 3 + hShift;
  const cp2x = (2 * w) / 3 + hShift;
  return (
    `M 0,${yMid} ` +
    `C ${cp1x},${yMid - amp} ${cp2x},${yMid + amp} ${w},${yMid}`
  );
}

/** Inflate - top lines bow upward, bottom lines bow downward.
 *  adj (default 18750) controls bulge amount. */
function inflatePath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  // adj default is 18750 (out of 100000); normalise to a proportion of the default bulge.
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const bulge = h * 0.3 * (1 - 2 * t) * Math.max(0, Math.min(adjFactor, 4));
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate - opposite of inflate.
 *  adj (default 18750) controls pinch amount. */
function deflatePath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const pinch = h * 0.3 * (2 * t - 1) * Math.max(0, Math.min(adjFactor, 4));
  return `M 0,${yBase} Q ${w / 2},${yBase - pinch} ${w},${yBase}`;
}

/** Gentle upward curve.
 *  adj (default 45977) controls curve height. */
function curveUpPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.35 + t * 0.55);
  const adjFactor = adj !== undefined ? adj / 45977 : 1;
  const curve = h * 0.4 * (1 - t * 0.3) * Math.max(0, Math.min(adjFactor, 4));
  return `M 0,${yBase} Q ${w / 2},${yBase - curve} ${w},${yBase}`;
}

/** Gentle downward curve.
 *  adj (default 45977) controls curve depth. */
function curveDownPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.1 + t * 0.55);
  const adjFactor = adj !== undefined ? adj / 45977 : 1;
  const curve = h * 0.4 * (1 - (1 - t) * 0.3) * Math.max(0, Math.min(adjFactor, 4));
  return `M 0,${yBase} Q ${w / 2},${yBase + curve} ${w},${yBase}`;
}

// ── Priority 2 path generators ─────────────────────────────────────────

/** Inverted single wave (phase-shifted wave1).
 *  adj (default 12500) controls wave amplitude.
 *  adj2 (default 0) controls horizontal phase shift. */
function wave2Path(w: number, h: number, t: number, adj?: number, adj2?: number): string {
  const yMid = h * (0.25 + t * 0.5);
  const adjFactor = adj !== undefined ? adj / 12500 : 1;
  const amp = h * 0.2 * Math.max(0, Math.min(adjFactor, 4));
  const hShift = adj2 !== undefined ? (adj2 / 100000) * w * 0.3 : 0;
  const cp1x = w / 3 + hShift;
  const cp2x = (2 * w) / 3 + hShift;
  return (
    `M 0,${yMid} ` +
    `C ${cp1x},${yMid + amp} ${cp2x},${yMid - amp} ${w},${yMid}`
  );
}

/** Double wave - two full wave cycles across the width.
 *  adj (default 12500) controls wave amplitude.
 *  adj2 (default 0) controls horizontal phase shift. */
function wave4Path(w: number, h: number, t: number, adj?: number, adj2?: number): string {
  const yMid = h * (0.25 + t * 0.5);
  const adjFactor = adj !== undefined ? adj / 12500 : 1;
  const amp = h * 0.15 * Math.max(0, Math.min(adjFactor, 4));
  const hShift = adj2 !== undefined ? (adj2 / 100000) * w * 0.15 : 0;
  const q = w / 4;
  return (
    `M 0,${yMid} ` +
    `C ${q + hShift},${yMid - amp} ${2 * q + hShift},${yMid + amp} ${w / 2},${yMid} ` +
    `C ${w / 2 + q + hShift},${yMid - amp} ${w - q + hShift},${yMid + amp} ${w},${yMid}`
  );
}

/** Double wave with alternating rhythm.
 *  adj (default 6250) controls wave amplitude.
 *  adj2 (default 0) controls horizontal phase shift. */
function doubleWave1Path(w: number, h: number, t: number, adj?: number, adj2?: number): string {
  const yMid = h * (0.25 + t * 0.5);
  const adjFactor = adj !== undefined ? adj / 6250 : 1;
  const amp = h * 0.18 * Math.max(0, Math.min(adjFactor, 4));
  const hShift = adj2 !== undefined ? (adj2 / 100000) * w * 0.15 : 0;
  const q = w / 4;
  return (
    `M 0,${yMid} ` +
    `C ${q + hShift},${yMid - amp} ${2 * q + hShift},${yMid + amp} ${w / 2},${yMid} ` +
    `C ${w / 2 + q + hShift},${yMid + amp} ${w - q + hShift},${yMid - amp} ${w},${yMid}`
  );
}

/** Cylindrical text - upward.
 *  adj (default 18750) controls the cylinder curvature. */
function canUpPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const curvature = Math.max(0, Math.min(adjFactor, 4));
  const archH = h * (0.35 - t * 0.25) * curvature;
  if (archH < 1) return `M 0,${h} L ${w},${h}`;
  return `M 0,${h} A ${w / 2},${archH} 0 0,1 ${w},${h}`;
}

/** Cylindrical text - downward.
 *  adj (default 18750) controls the cylinder curvature. */
function canDownPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const curvature = Math.max(0, Math.min(adjFactor, 4));
  const archH = h * (0.1 + t * 0.25) * curvature;
  if (archH < 1) return `M 0,0 L ${w},0`;
  return `M 0,0 A ${w / 2},${archH} 0 0,0 ${w},0`;
}

/** Button shape - convex top / concave bottom.
 *  adj (default 18750) controls the curve amount. */
function buttonPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.1 + t * 0.8);
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const bulge = h * 0.15 * (1 - 2 * t) * Math.max(0, Math.min(adjFactor, 4));
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Ring inside - concentric ellipses scaled inward.
 *  adj (default 18750) controls ring thickness. */
function ringInsidePath(w: number, h: number, t: number, adj?: number): string {
  const cx = w / 2;
  const cy = h / 2;
  // adj controls thickness of the ring; higher = thicker band, shrinks inner radius more
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const thickness = 0.35 * Math.max(0, Math.min(adjFactor, 4));
  const scale = 0.7 - t * thickness;
  const rx = Math.max(1, (w / 2) * scale);
  const ry = Math.max(1, (h / 2) * scale);
  return (
    `M ${cx},${cy - ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
  );
}

/** Ring outside - concentric ellipses scaled outward.
 *  adj (default 18750) controls ring thickness. */
function ringOutsidePath(w: number, h: number, t: number, adj?: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const thickness = 0.35 * Math.max(0, Math.min(adjFactor, 4));
  const scale = 1 - t * thickness;
  const rx = Math.max(1, (w / 2) * scale);
  const ry = Math.max(1, (h / 2) * scale);
  return (
    `M ${cx},${cy - ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
  );
}

// ── Priority 3 path generators ─────────────────────────────────────────

/** Triangle / trapezoid - top line narrow, bottom line full width.
 *  adj (default 50000) controls the narrowness at the top (0 = point, 100000 = full width). */
function trianglePath(w: number, h: number, t: number, adj?: number): string {
  // adj default 50000 maps to narrowW = w * 0.15 at default; scale with adj
  const adjRatio = adj !== undefined ? adj / 100000 : 0.5;
  const narrowW = w * (1 - Math.max(0, Math.min(adjRatio, 1))) * 0.3;
  const lineW = narrowW + t * (w - narrowW);
  const xStart = (w - lineW) / 2;
  const yBase = h * (0.1 + t * 0.8);
  return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Inverted triangle - top line full width, bottom line narrow.
 *  adj (default 50000) controls the narrowness at the bottom. */
function triangleInvertedPath(w: number, h: number, t: number, adj?: number): string {
  const adjRatio = adj !== undefined ? adj / 100000 : 0.5;
  const narrowW = w * (1 - Math.max(0, Math.min(adjRatio, 1))) * 0.3;
  const lineW = w - t * (w - narrowW);
  const xStart = (w - lineW) / 2;
  const yBase = h * (0.1 + t * 0.8);
  return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Stop / octagon - lines narrow at top and bottom, widest in centre.
 *  adj (default 25000) controls the amount of corner inset. */
function stopPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 25000 : 1;
  const insetScale = Math.max(0, Math.min(adjFactor, 4));
  const inset = w * 0.15 * (1 - Math.pow(1 - 2 * Math.abs(t - 0.5), 2)) * insetScale;
  const yBase = h * (0.1 + t * 0.8);
  return `M ${inset},${yBase} L ${w - inset},${yBase}`;
}

/** Chevron - V-shape pointing down.
 *  adj (default 25000) controls chevron point height. */
function chevronPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 25000 : 1;
  const dip = h * 0.2 * (1 - t) * Math.max(0, Math.min(adjFactor, 4));
  return `M 0,${yBase} L ${w / 2},${yBase + dip} L ${w},${yBase}`;
}

/** Inverted chevron - V-shape pointing up.
 *  adj (default 25000) controls chevron point height. */
function chevronInvertedPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 25000 : 1;
  const rise = h * 0.2 * t * Math.max(0, Math.min(adjFactor, 4));
  return `M 0,${yBase} L ${w / 2},${yBase - rise} L ${w},${yBase}`;
}

/** Inflate bottom only.
 *  adj (default 18750) controls bulge amount. */
function inflateBottomPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const bulge = t > 0.4 ? h * 0.25 * ((t - 0.4) / 0.6) * Math.max(0, Math.min(adjFactor, 4)) : 0;
  return `M 0,${yBase} Q ${w / 2},${yBase + bulge} ${w},${yBase}`;
}

/** Inflate top only.
 *  adj (default 18750) controls bulge amount. */
function inflateTopPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const bulge = t < 0.6 ? h * 0.25 * ((0.6 - t) / 0.6) * Math.max(0, Math.min(adjFactor, 4)) : 0;
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate bottom only.
 *  adj (default 18750) controls pinch amount. */
function deflateBottomPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const pinch = t > 0.4 ? h * 0.2 * ((t - 0.4) / 0.6) * Math.max(0, Math.min(adjFactor, 4)) : 0;
  return `M 0,${yBase} Q ${w / 2},${yBase - pinch} ${w},${yBase}`;
}

/** Deflate top only.
 *  adj (default 18750) controls pinch amount. */
function deflateTopPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const pinch = t < 0.6 ? h * 0.2 * ((0.6 - t) / 0.6) * Math.max(0, Math.min(adjFactor, 4)) : 0;
  return `M 0,${yBase} Q ${w / 2},${yBase + pinch} ${w},${yBase}`;
}

// ── Priority 4 path generators ─────────────────────────────────────────

/** Slant up — baseline rises from left to right.
 *  adj (default 55000) controls the slant angle. */
function slantUpPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 55000 : 1;
  const slant = 0.25 * Math.max(0, Math.min(adjFactor, 4));
  const yMid = h * (0.175 + t * 0.55);
  const yStart = yMid + h * slant / 2;
  const yEnd = yMid - h * slant / 2;
  return `M 0,${yStart} L ${w},${yEnd}`;
}

/** Slant down — baseline falls from left to right.
 *  adj (default 55000) controls the slant angle. */
function slantDownPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 55000 : 1;
  const slant = 0.25 * Math.max(0, Math.min(adjFactor, 4));
  const yMid = h * (0.175 + t * 0.55);
  const yStart = yMid - h * slant / 2;
  const yEnd = yMid + h * slant / 2;
  return `M 0,${yStart} L ${w},${yEnd}`;
}

/** Fade right — text narrows towards the right (trapezoid).
 *  adj (default 50000) controls the fade/squeeze amount. */
function fadeRightPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 50000 : 1;
  const squeezeScale = Math.max(0, Math.min(adjFactor, 4));
  const yLeft = h * (0.1 + t * 0.8);
  const squeeze = 0.35 * (1 - 2 * t) * squeezeScale;
  const yRight = h * (0.5 + squeeze * 0.4);
  return `M 0,${yLeft} L ${w},${yRight}`;
}

/** Fade left — text narrows towards the left (trapezoid).
 *  adj (default 50000) controls the fade/squeeze amount. */
function fadeLeftPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 50000 : 1;
  const squeezeScale = Math.max(0, Math.min(adjFactor, 4));
  const squeeze = 0.35 * (1 - 2 * t) * squeezeScale;
  const yLeft = h * (0.5 + squeeze * 0.4);
  const yRight = h * (0.1 + t * 0.8);
  return `M 0,${yLeft} L ${w},${yRight}`;
}

/** Fade up — text narrows towards the top.
 *  adj (default 50000) controls the fade/taper amount. */
function fadeUpPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 50000 : 1;
  const taperScale = Math.max(0, Math.min(adjFactor, 4));
  const narrowFraction = 1 - 0.7 * taperScale; // default: 0.3
  const narrowW = w * Math.max(0, narrowFraction);
  const lineW = narrowW + t * (w - narrowW);
  const xStart = (w - lineW) / 2;
  const yBase = h * (0.1 + t * 0.8);
  return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Fade down — text narrows towards the bottom.
 *  adj (default 50000) controls the fade/taper amount. */
function fadeDownPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 50000 : 1;
  const taperScale = Math.max(0, Math.min(adjFactor, 4));
  const narrowFraction = 1 - 0.7 * taperScale; // default: 0.3
  const narrowW = w * Math.max(0, narrowFraction);
  const lineW = w - t * (w - narrowW);
  const xStart = (w - lineW) / 2;
  const yBase = h * (0.1 + t * 0.8);
  return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Arch up pour — hollowed arch upward (like archUp but with inner hole).
 *  adj (default 10800000) controls the arch height in 60000ths of a degree. */
function archUpPourPath(w: number, h: number, t: number, adj?: number): string {
  const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
  const maxArch = 0.7 * adjNorm / 0.5;
  const archH = h * Math.max(0, maxArch - t * 0.5);
  if (archH < 1) return `M 0,${h} L ${w},${h}`;
  return `M 0,${h} A ${w / 2},${archH} 0 0,1 ${w},${h}`;
}

/** Arch down pour — hollowed arch downward.
 *  adj (default 10800000) controls the arch depth in 60000ths of a degree. */
function archDownPourPath(w: number, h: number, t: number, adj?: number): string {
  const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
  const baseDepth = 0.2 * adjNorm / 0.5;
  const archH = h * (baseDepth + t * 0.5);
  if (archH < 1) return `M 0,0 L ${w},0`;
  return `M 0,0 A ${w / 2},${archH} 0 0,0 ${w},0`;
}

/** Circle pour — concentric ellipses (like circle but with an inner gap).
 *  adj (default 10800000) controls the arc span angle in 60000ths of a degree. */
function circlePourPath(w: number, h: number, t: number, adj?: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
  const baseScale = 0.35 + adjNorm * 1.0; // range ~0.35..1.35, default ~0.85
  const scale = Math.min(1, baseScale) - t * 0.45;
  const rx = Math.max(1, (w / 2) * scale);
  const ry = Math.max(1, (h / 2) * scale);
  return (
    `M ${cx},${cy - ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
    `A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
  );
}

/** Button pour — convex top / concave bottom with larger margins.
 *  adj (default 18750) controls the curve amount. */
function buttonPourPath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const bulge = h * 0.12 * (1 - 2 * t) * Math.max(0, Math.min(adjFactor, 4));
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate-inflate — pinched in centre top/bottom, expanded at edges.
 *  adj (default 18750) controls the oscillation amplitude. */
function deflateInflatePath(w: number, h: number, t: number, adj?: number): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const factor = Math.sin(t * Math.PI);
  const bulge = h * 0.2 * (factor - 0.5) * Math.max(0, Math.min(adjFactor, 4));
  return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate-inflate-deflate — triple oscillation.
 *  adj (default 18750) controls the oscillation amplitude. */
function deflateInflateDeflatePath(
  w: number,
  h: number,
  t: number,
  adj?: number,
): string {
  const yBase = h * (0.15 + t * 0.7);
  const adjFactor = adj !== undefined ? adj / 18750 : 1;
  const ampScale = Math.max(0, Math.min(adjFactor, 4));
  const factor = Math.sin(t * Math.PI * 2);
  const bulge = h * 0.15 * factor * ampScale;
  const q1 = w / 3;
  const q2 = (2 * w) / 3;
  return (
    `M 0,${yBase} ` +
    `Q ${q1},${yBase - bulge} ${w / 2},${yBase} ` +
    `Q ${q2},${yBase + bulge} ${w},${yBase}`
  );
}

// ── Generator look-up table ────────────────────────────────────────────

export const WARP_PATH_GENERATORS: Readonly<Record<string, WarpPathGenerator>> =
  {
    textArchUp: archUpPath,
    textArchDown: archDownPath,
    textCircle: circlePath,
    textWave1: wave1Path,
    textInflate: inflatePath,
    textDeflate: deflatePath,
    textCurveUp: curveUpPath,
    textCurveDown: curveDownPath,
    textWave2: wave2Path,
    textWave4: wave4Path,
    textDoubleWave1: doubleWave1Path,
    textCanUp: canUpPath,
    textCanDown: canDownPath,
    textButton: buttonPath,
    textRingInside: ringInsidePath,
    textRingOutside: ringOutsidePath,
    textCascadeUp: cascadeUpPath,
    textCascadeDown: cascadeDownPath,
    textTriangle: trianglePath,
    textTriangleInverted: triangleInvertedPath,
    textStop: stopPath,
    textChevron: chevronPath,
    textChevronInverted: chevronInvertedPath,
    textInflateBottom: inflateBottomPath,
    textInflateTop: inflateTopPath,
    textDeflateBottom: deflateBottomPath,
    textDeflateTop: deflateTopPath,
    textSlantUp: slantUpPath,
    textSlantDown: slantDownPath,
    textFadeRight: fadeRightPath,
    textFadeLeft: fadeLeftPath,
    textFadeUp: fadeUpPath,
    textFadeDown: fadeDownPath,
    textArchUpPour: archUpPourPath,
    textArchDownPour: archDownPourPath,
    textCirclePour: circlePourPath,
    textButtonPour: buttonPourPath,
    textDeflateInflate: deflateInflatePath,
    textDeflateInflateDeflate: deflateInflateDeflatePath,
  };

// ── Public API ─────────────────────────────────────────────────────────

/** Returns `true` when the preset should use SVG `<textPath>` rendering. */
export function shouldUseSvgWarp(
  preset: PptxTextWarpPreset | undefined,
): boolean {
  if (!preset || preset === "textNoShape" || preset === "textPlain") {
    return false;
  }
  return SVG_WARP_PRESETS.has(preset);
}

/** Generate an SVG path `d` attribute for a warp preset at a given line position.
 *  Optional adj/adj2 are raw OOXML adjustment values (1/60000th units). */
export function getWarpPath(
  preset: PptxTextWarpPreset,
  width: number,
  height: number,
  lineIndex: number,
  lineCount: number,
  adj?: number,
  adj2?: number,
): string {
  const t = lineCount <= 1 ? 0.5 : lineIndex / (lineCount - 1);
  const generator = WARP_PATH_GENERATORS[preset];
  if (generator) {
    return generator(width, height, t, adj, adj2);
  }
  const y = height * (0.2 + t * 0.6);
  return `M 0,${y} L ${width},${y}`;
}
