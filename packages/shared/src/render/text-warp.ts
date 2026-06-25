/**
 * Text warp / WordArt logic — Vue port of the React
 * `viewer/utils/warp-path-generators.ts` + `text-warp-classifier.ts`.
 *
 * Pure, framework-agnostic helpers that classify an OOXML `prstTxWarp` preset
 * and build the SVG path `d` attribute for a single warped text baseline.
 *
 * A text element signals WordArt via `element.textStyle.textWarpPreset`
 * (`a:bodyPr/a:prstTxWarp/@prst`), with optional `textWarpAdj` / `textWarpAdj2`
 * adjustment values (raw OOXML 1/60000th units). Use {@link hasTextWarp} to
 * detect a warped element and {@link shouldUseSvgWarp} to decide whether the
 * SVG `<textPath>` renderer applies.
 */
import type { PptxElement, PptxTextWarpPreset, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

// ── Classifier ──────────────────────────────────────────────────────────

/**
 * Rendering-strategy category for a warp preset.
 *  - `path`:     renders along an SVG `<textPath>` (arcs, waves, circles…)
 *  - `envelope`: non-uniform vertical stretch (inflate/deflate/can)
 *  - `simple`:   basic 2D transforms (slant, fade, cascade)
 *  - `none`:     no warp (`textNoShape`, `textPlain`, unknown)
 */
export type WarpCategory = 'path' | 'envelope' | 'simple' | 'none';

const NONE_PRESETS: ReadonlySet<string> = new Set(['textNoShape', 'textPlain']);

/** Presets that render best with SVG textPath along curved/circular paths. */
const PATH_PRESETS: ReadonlySet<string> = new Set([
	'textArchUp',
	'textArchDown',
	'textCircle',
	'textWave1',
	'textWave2',
	'textWave4',
	'textDoubleWave1',
	'textCurveUp',
	'textCurveDown',
	'textArchUpPour',
	'textArchDownPour',
	'textCirclePour',
	'textButton',
	'textButtonPour',
	'textRingInside',
	'textRingOutside',
	'textTriangle',
	'textTriangleInverted',
	'textChevron',
	'textChevronInverted',
	'textStop',
]);

/** Presets that stretch text non-uniformly per line (inflate/deflate/can). */
const ENVELOPE_PRESETS: ReadonlySet<string> = new Set([
	'textInflate',
	'textDeflate',
	'textInflateBottom',
	'textInflateTop',
	'textDeflateBottom',
	'textDeflateTop',
	'textDeflateInflate',
	'textDeflateInflateDeflate',
	'textCanUp',
	'textCanDown',
]);

/** Presets approximated by basic 2D transforms (slant, fade, cascade). */
const SIMPLE_PRESETS: ReadonlySet<string> = new Set([
	'textSlantUp',
	'textSlantDown',
	'textFadeRight',
	'textFadeLeft',
	'textFadeUp',
	'textFadeDown',
	'textCascadeUp',
	'textCascadeDown',
]);

/**
 * Classify a warp preset into a rendering-strategy category.
 *
 * Returns `'none'` for empty/unknown presets so callers can skip rendering
 * without an explicit allowlist check.
 */
export function classifyTextWarp(preset: string | undefined): WarpCategory {
	if (!preset || NONE_PRESETS.has(preset)) {
		return 'none';
	}
	if (PATH_PRESETS.has(preset)) {
		return 'path';
	}
	if (ENVELOPE_PRESETS.has(preset)) {
		return 'envelope';
	}
	if (SIMPLE_PRESETS.has(preset)) {
		return 'simple';
	}
	return 'none';
}

/** All classified warp presets (excludes `none`). */
export const ALL_CLASSIFIED_PRESETS: ReadonlySet<string> = new Set([
	...NONE_PRESETS,
	...PATH_PRESETS,
	...ENVELOPE_PRESETS,
	...SIMPLE_PRESETS,
]);

// ── Paragraph splitter ──────────────────────────────────────────────────

/** A single warp/WordArt paragraph: the runs that flow along one baseline. */
export interface WarpParagraph {
	/** Text segments belonging to this paragraph (no paragraph-break segments). */
	segments: TextSegment[];
}

/** Minimal element shape the warp paragraph splitter needs. */
export interface WarpTextSource {
	text?: string;
	textSegments?: TextSegment[];
}

/**
 * Optional per-segment transform applied while grouping. Returns the segment to
 * emit for the given input segment; callers use it to substitute field text
 * (slide number / date / footer …). Returning the same segment is a no-op.
 */
export type WarpSegmentTransform = (segment: TextSegment) => TextSegment;

/**
 * Group an element's `textSegments` into paragraphs delimited by
 * `isParagraphBreak` segments (the break markers themselves are excluded).
 *
 * Falls back to a single synthetic paragraph carrying `element.text` when no
 * segments are present, and to an empty array when there is neither text nor
 * segments.
 *
 * When `transform` is supplied each non-break segment is passed through it
 * before being collected; this is how the React renderer substitutes field
 * values (slide number, date, footer, …) into warped text. The transform is a
 * separate concern kept out of this pure splitter so Vue/Angular can call it
 * without pulling in field-substitution logic.
 *
 * @param source    Element (or element-like) carrying `text` / `textSegments`.
 * @param transform Optional per-segment substitution callback.
 */
export function groupIntoParagraphs(
	source: WarpTextSource,
	transform?: WarpSegmentTransform,
): WarpParagraph[] {
	const segments = source.textSegments;
	if (!segments || segments.length === 0) {
		if (source.text) {
			return [{ segments: [{ text: source.text, style: {} }] }];
		}
		return [];
	}
	const paragraphs: WarpParagraph[] = [];
	let current: TextSegment[] = [];
	for (const seg of segments) {
		if (seg.isParagraphBreak) {
			if (current.length > 0) {
				paragraphs.push({ segments: current });
			}
			current = [];
		} else {
			current.push(transform ? transform(seg) : seg);
		}
	}
	if (current.length > 0) {
		paragraphs.push({ segments: current });
	}
	return paragraphs;
}

// ── Path generators ─────────────────────────────────────────────────────

/** Produces an SVG path `d` attribute for a single text line at vertical
 *  position `t` (0 = top, 1 = bottom). Optional adj/adj2 are raw OOXML units. */
export type WarpPathGenerator = (
	w: number,
	h: number,
	t: number,
	adj?: number,
	adj2?: number,
) => string;

/** Presets that require SVG textPath rendering (all others fall back to flat). */
export const SVG_WARP_PRESETS: ReadonlySet<string> = new Set([
	// Priority 1
	'textArchUp',
	'textArchDown',
	'textCircle',
	'textWave1',
	'textInflate',
	'textDeflate',
	'textCurveUp',
	'textCurveDown',
	// Priority 2
	'textWave2',
	'textWave4',
	'textDoubleWave1',
	'textCanUp',
	'textCanDown',
	'textButton',
	'textRingInside',
	'textRingOutside',
	'textCascadeUp',
	'textCascadeDown',
	// Priority 3
	'textTriangle',
	'textTriangleInverted',
	'textStop',
	'textChevron',
	'textChevronInverted',
	'textInflateBottom',
	'textInflateTop',
	'textDeflateBottom',
	'textDeflateTop',
	// Priority 4 – slant, fade, pour, and compound deflate/inflate
	'textSlantUp',
	'textSlantDown',
	'textFadeRight',
	'textFadeLeft',
	'textFadeUp',
	'textFadeDown',
	'textArchUpPour',
	'textArchDownPour',
	'textCirclePour',
	'textButtonPour',
	'textDeflateInflate',
	'textDeflateInflateDeflate',
]);

const clamp4 = (n: number): number => Math.max(0, Math.min(n, 4));

// ── Priority 1 ──────────────────────────────────────────────────────────

/** Concentric upward arcs. t=0 is the tallest arch. */
function archUpPath(w: number, h: number, t: number, adj?: number): string {
	const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
	const maxArch = (0.85 * adjNorm) / 0.5;
	const archH = h * Math.max(0, maxArch - t * 0.7);
	if (archH < 1) {
		return `M 0,${h} L ${w},${h}`;
	}
	return `M 0,${h} A ${w / 2},${archH} 0 0,1 ${w},${h}`;
}

/** Concentric downward arcs. t=1 is the deepest. */
function archDownPath(w: number, h: number, t: number, adj?: number): string {
	const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
	const baseDepth = (0.15 * adjNorm) / 0.5;
	const archH = h * (baseDepth + t * 0.7);
	if (archH < 1) {
		return `M 0,0 L ${w},0`;
	}
	return `M 0,0 A ${w / 2},${archH} 0 0,0 ${w},0`;
}

/** Full ellipse — concentric ellipses shrink towards centre. */
function circlePath(w: number, h: number, t: number, adj?: number): string {
	const cx = w / 2;
	const cy = h / 2;
	const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
	const baseScale = 0.45 + adjNorm * 1.1;
	const scale = Math.min(1, baseScale) - t * 0.55;
	const rx = Math.max(1, (w / 2) * scale);
	const ry = Math.max(1, (h / 2) * scale);
	return (
		`M ${cx},${cy - ry} ` +
		`A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
		`A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
	);
}

/** Single sine-wave via cubic Bézier. */
function wave1Path(w: number, h: number, t: number, adj?: number, adj2?: number): string {
	const yMid = h * (0.25 + t * 0.5);
	const adjFactor = adj !== undefined ? adj / 12500 : 1;
	const amp = h * 0.2 * clamp4(adjFactor);
	const hShift = adj2 !== undefined ? (adj2 / 100000) * w * 0.3 : 0;
	const cp1x = w / 3 + hShift;
	const cp2x = (2 * w) / 3 + hShift;
	return `M 0,${yMid} C ${cp1x},${yMid - amp} ${cp2x},${yMid + amp} ${w},${yMid}`;
}

/** Inflate — top lines bow up, bottom lines bow down. */
function inflatePath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const bulge = h * 0.3 * (1 - 2 * t) * clamp4(adjFactor);
	return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate — opposite of inflate. */
function deflatePath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const pinch = h * 0.3 * (2 * t - 1) * clamp4(adjFactor);
	return `M 0,${yBase} Q ${w / 2},${yBase - pinch} ${w},${yBase}`;
}

/** Gentle upward curve. */
function curveUpPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.35 + t * 0.55);
	const adjFactor = adj !== undefined ? adj / 45977 : 1;
	const curve = h * 0.4 * (1 - t * 0.3) * clamp4(adjFactor);
	return `M 0,${yBase} Q ${w / 2},${yBase - curve} ${w},${yBase}`;
}

/** Gentle downward curve. */
function curveDownPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.1 + t * 0.55);
	const adjFactor = adj !== undefined ? adj / 45977 : 1;
	const curve = h * 0.4 * (1 - (1 - t) * 0.3) * clamp4(adjFactor);
	return `M 0,${yBase} Q ${w / 2},${yBase + curve} ${w},${yBase}`;
}

// ── Priority 2 ──────────────────────────────────────────────────────────

/** Inverted single wave (phase-shifted wave1). */
function wave2Path(w: number, h: number, t: number, adj?: number, adj2?: number): string {
	const yMid = h * (0.25 + t * 0.5);
	const adjFactor = adj !== undefined ? adj / 12500 : 1;
	const amp = h * 0.2 * clamp4(adjFactor);
	const hShift = adj2 !== undefined ? (adj2 / 100000) * w * 0.3 : 0;
	const cp1x = w / 3 + hShift;
	const cp2x = (2 * w) / 3 + hShift;
	return `M 0,${yMid} C ${cp1x},${yMid + amp} ${cp2x},${yMid - amp} ${w},${yMid}`;
}

/** Double wave — two full cycles. */
function wave4Path(w: number, h: number, t: number, adj?: number, adj2?: number): string {
	const yMid = h * (0.25 + t * 0.5);
	const adjFactor = adj !== undefined ? adj / 12500 : 1;
	const amp = h * 0.15 * clamp4(adjFactor);
	const hShift = adj2 !== undefined ? (adj2 / 100000) * w * 0.15 : 0;
	const q = w / 4;
	return (
		`M 0,${yMid} ` +
		`C ${q + hShift},${yMid - amp} ${2 * q + hShift},${yMid + amp} ${w / 2},${yMid} ` +
		`C ${w / 2 + q + hShift},${yMid - amp} ${w - q + hShift},${yMid + amp} ${w},${yMid}`
	);
}

/** Double wave with alternating rhythm. */
function doubleWave1Path(w: number, h: number, t: number, adj?: number, adj2?: number): string {
	const yMid = h * (0.25 + t * 0.5);
	const adjFactor = adj !== undefined ? adj / 6250 : 1;
	const amp = h * 0.18 * clamp4(adjFactor);
	const hShift = adj2 !== undefined ? (adj2 / 100000) * w * 0.15 : 0;
	const q = w / 4;
	return (
		`M 0,${yMid} ` +
		`C ${q + hShift},${yMid - amp} ${2 * q + hShift},${yMid + amp} ${w / 2},${yMid} ` +
		`C ${w / 2 + q + hShift},${yMid + amp} ${w - q + hShift},${yMid - amp} ${w},${yMid}`
	);
}

/** Cylindrical text — upward. */
function canUpPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const curvature = clamp4(adjFactor);
	const archH = h * (0.35 - t * 0.25) * curvature;
	if (archH < 1) {
		return `M 0,${h} L ${w},${h}`;
	}
	return `M 0,${h} A ${w / 2},${archH} 0 0,1 ${w},${h}`;
}

/** Cylindrical text — downward. */
function canDownPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const curvature = clamp4(adjFactor);
	const archH = h * (0.1 + t * 0.25) * curvature;
	if (archH < 1) {
		return `M 0,0 L ${w},0`;
	}
	return `M 0,0 A ${w / 2},${archH} 0 0,0 ${w},0`;
}

/** Button — convex top / concave bottom. */
function buttonPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.1 + t * 0.8);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const bulge = h * 0.15 * (1 - 2 * t) * clamp4(adjFactor);
	return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Ring inside — concentric ellipses scaled inward. */
function ringInsidePath(w: number, h: number, t: number, adj?: number): string {
	const cx = w / 2;
	const cy = h / 2;
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const thickness = 0.35 * clamp4(adjFactor);
	const scale = 0.7 - t * thickness;
	const rx = Math.max(1, (w / 2) * scale);
	const ry = Math.max(1, (h / 2) * scale);
	return (
		`M ${cx},${cy - ry} ` +
		`A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
		`A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
	);
}

/** Ring outside — concentric ellipses scaled outward. */
function ringOutsidePath(w: number, h: number, t: number, adj?: number): string {
	const cx = w / 2;
	const cy = h / 2;
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const thickness = 0.35 * clamp4(adjFactor);
	const scale = 1 - t * thickness;
	const rx = Math.max(1, (w / 2) * scale);
	const ry = Math.max(1, (h / 2) * scale);
	return (
		`M ${cx},${cy - ry} ` +
		`A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
		`A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
	);
}

/** Cascading up — lines tilt from lower-left to upper-right. */
export function cascadeUpPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 44444 : 1;
	const tilt = 0.2 * clamp4(adjFactor);
	const yMid = h * (0.2 + t * 0.6);
	const yStart = yMid + (h * tilt) / 2;
	const yEnd = yMid - (h * tilt) / 2;
	return `M 0,${yStart} L ${w},${yEnd}`;
}

/** Cascading down — lines tilt from upper-left to lower-right. */
export function cascadeDownPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 44444 : 1;
	const tilt = 0.2 * clamp4(adjFactor);
	const yMid = h * (0.2 + t * 0.6);
	const yStart = yMid - (h * tilt) / 2;
	const yEnd = yMid + (h * tilt) / 2;
	return `M 0,${yStart} L ${w},${yEnd}`;
}

// ── Priority 3 ──────────────────────────────────────────────────────────

/** Triangle / trapezoid — top line narrow, bottom line full width. */
function trianglePath(w: number, h: number, t: number, adj?: number): string {
	const adjRatio = adj !== undefined ? adj / 100000 : 0.5;
	const narrowW = w * (1 - Math.max(0, Math.min(adjRatio, 1))) * 0.3;
	const lineW = narrowW + t * (w - narrowW);
	const xStart = (w - lineW) / 2;
	const yBase = h * (0.1 + t * 0.8);
	return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Inverted triangle — top line full width, bottom line narrow. */
function triangleInvertedPath(w: number, h: number, t: number, adj?: number): string {
	const adjRatio = adj !== undefined ? adj / 100000 : 0.5;
	const narrowW = w * (1 - Math.max(0, Math.min(adjRatio, 1))) * 0.3;
	const lineW = w - t * (w - narrowW);
	const xStart = (w - lineW) / 2;
	const yBase = h * (0.1 + t * 0.8);
	return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Stop / octagon — lines narrow at top and bottom, widest in centre. */
function stopPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 25000 : 1;
	const insetScale = clamp4(adjFactor);
	const inset = w * 0.15 * (1 - (1 - 2 * Math.abs(t - 0.5)) ** 2) * insetScale;
	const yBase = h * (0.1 + t * 0.8);
	return `M ${inset},${yBase} L ${w - inset},${yBase}`;
}

/** Chevron — V-shape pointing down. */
function chevronPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 25000 : 1;
	const dip = h * 0.2 * (1 - t) * clamp4(adjFactor);
	return `M 0,${yBase} L ${w / 2},${yBase + dip} L ${w},${yBase}`;
}

/** Inverted chevron — V-shape pointing up. */
function chevronInvertedPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 25000 : 1;
	const rise = h * 0.2 * t * clamp4(adjFactor);
	return `M 0,${yBase} L ${w / 2},${yBase - rise} L ${w},${yBase}`;
}

/** Inflate bottom only. */
function inflateBottomPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const bulge = t > 0.4 ? h * 0.25 * ((t - 0.4) / 0.6) * clamp4(adjFactor) : 0;
	return `M 0,${yBase} Q ${w / 2},${yBase + bulge} ${w},${yBase}`;
}

/** Inflate top only. */
function inflateTopPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const bulge = t < 0.6 ? h * 0.25 * ((0.6 - t) / 0.6) * clamp4(adjFactor) : 0;
	return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate bottom only. */
function deflateBottomPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const pinch = t > 0.4 ? h * 0.2 * ((t - 0.4) / 0.6) * clamp4(adjFactor) : 0;
	return `M 0,${yBase} Q ${w / 2},${yBase - pinch} ${w},${yBase}`;
}

/** Deflate top only. */
function deflateTopPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const pinch = t < 0.6 ? h * 0.2 * ((0.6 - t) / 0.6) * clamp4(adjFactor) : 0;
	return `M 0,${yBase} Q ${w / 2},${yBase + pinch} ${w},${yBase}`;
}

// ── Priority 4 ──────────────────────────────────────────────────────────

/** Slant up — baseline rises from left to right. */
function slantUpPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 55000 : 1;
	const slant = 0.25 * clamp4(adjFactor);
	const yMid = h * (0.175 + t * 0.55);
	const yStart = yMid + (h * slant) / 2;
	const yEnd = yMid - (h * slant) / 2;
	return `M 0,${yStart} L ${w},${yEnd}`;
}

/** Slant down — baseline falls from left to right. */
function slantDownPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 55000 : 1;
	const slant = 0.25 * clamp4(adjFactor);
	const yMid = h * (0.175 + t * 0.55);
	const yStart = yMid - (h * slant) / 2;
	const yEnd = yMid + (h * slant) / 2;
	return `M 0,${yStart} L ${w},${yEnd}`;
}

/** Fade right — text narrows towards the right (trapezoid). */
function fadeRightPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 50000 : 1;
	const squeezeScale = clamp4(adjFactor);
	const yLeft = h * (0.1 + t * 0.8);
	const squeeze = 0.35 * (1 - 2 * t) * squeezeScale;
	const yRight = h * (0.5 + squeeze * 0.4);
	return `M 0,${yLeft} L ${w},${yRight}`;
}

/** Fade left — text narrows towards the left (trapezoid). */
function fadeLeftPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 50000 : 1;
	const squeezeScale = clamp4(adjFactor);
	const squeeze = 0.35 * (1 - 2 * t) * squeezeScale;
	const yLeft = h * (0.5 + squeeze * 0.4);
	const yRight = h * (0.1 + t * 0.8);
	return `M 0,${yLeft} L ${w},${yRight}`;
}

/** Fade up — text narrows towards the top. */
function fadeUpPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 50000 : 1;
	const taperScale = clamp4(adjFactor);
	const narrowFraction = 1 - 0.7 * taperScale;
	const narrowW = w * Math.max(0, narrowFraction);
	const lineW = narrowW + t * (w - narrowW);
	const xStart = (w - lineW) / 2;
	const yBase = h * (0.1 + t * 0.8);
	return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Fade down — text narrows towards the bottom. */
function fadeDownPath(w: number, h: number, t: number, adj?: number): string {
	const adjFactor = adj !== undefined ? adj / 50000 : 1;
	const taperScale = clamp4(adjFactor);
	const narrowFraction = 1 - 0.7 * taperScale;
	const narrowW = w * Math.max(0, narrowFraction);
	const lineW = w - t * (w - narrowW);
	const xStart = (w - lineW) / 2;
	const yBase = h * (0.1 + t * 0.8);
	return `M ${xStart},${yBase} L ${xStart + lineW},${yBase}`;
}

/** Arch up pour — hollowed arch upward. */
function archUpPourPath(w: number, h: number, t: number, adj?: number): string {
	const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
	const maxArch = (0.7 * adjNorm) / 0.5;
	const archH = h * Math.max(0, maxArch - t * 0.5);
	if (archH < 1) {
		return `M 0,${h} L ${w},${h}`;
	}
	return `M 0,${h} A ${w / 2},${archH} 0 0,1 ${w},${h}`;
}

/** Arch down pour — hollowed arch downward. */
function archDownPourPath(w: number, h: number, t: number, adj?: number): string {
	const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
	const baseDepth = (0.2 * adjNorm) / 0.5;
	const archH = h * (baseDepth + t * 0.5);
	if (archH < 1) {
		return `M 0,0 L ${w},0`;
	}
	return `M 0,0 A ${w / 2},${archH} 0 0,0 ${w},0`;
}

/** Circle pour — concentric ellipses with an inner gap. */
function circlePourPath(w: number, h: number, t: number, adj?: number): string {
	const cx = w / 2;
	const cy = h / 2;
	const adjNorm = adj !== undefined ? Math.max(0, Math.min(adj / 21600000, 1)) : 0.5;
	const baseScale = 0.35 + Number(adjNorm);
	const scale = Math.min(1, baseScale) - t * 0.45;
	const rx = Math.max(1, (w / 2) * scale);
	const ry = Math.max(1, (h / 2) * scale);
	return (
		`M ${cx},${cy - ry} ` +
		`A ${rx},${ry} 0 1,1 ${cx},${cy + ry} ` +
		`A ${rx},${ry} 0 1,1 ${cx},${cy - ry}`
	);
}

/** Button pour — convex top / concave bottom with larger margins. */
function buttonPourPath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const bulge = h * 0.12 * (1 - 2 * t) * clamp4(adjFactor);
	return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate-inflate — pinched in centre top/bottom, expanded at edges. */
function deflateInflatePath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const factor = Math.sin(t * Math.PI);
	const bulge = h * 0.2 * (factor - 0.5) * clamp4(adjFactor);
	return `M 0,${yBase} Q ${w / 2},${yBase - bulge} ${w},${yBase}`;
}

/** Deflate-inflate-deflate — triple oscillation. */
function deflateInflateDeflatePath(w: number, h: number, t: number, adj?: number): string {
	const yBase = h * (0.15 + t * 0.7);
	const adjFactor = adj !== undefined ? adj / 18750 : 1;
	const ampScale = clamp4(adjFactor);
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

// ── Generator look-up table ─────────────────────────────────────────────

export const WARP_PATH_GENERATORS: Readonly<Record<string, WarpPathGenerator>> = {
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

// ── Public API ──────────────────────────────────────────────────────────

/** Returns `true` when the preset should use SVG `<textPath>` rendering. */
export function shouldUseSvgWarp(preset: PptxTextWarpPreset | undefined): boolean {
	if (!preset || preset === 'textNoShape' || preset === 'textPlain') {
		return false;
	}
	return SVG_WARP_PRESETS.has(preset);
}

/**
 * Predicate: does this element carry a WordArt/text-warp preset that the SVG
 * `<textPath>` renderer should handle? The warp field lives on
 * `element.textStyle.textWarpPreset`.
 */
export function hasTextWarp(element: PptxElement): boolean {
	if (!hasTextProperties(element)) {
		return false;
	}
	return shouldUseSvgWarp(element.textStyle?.textWarpPreset);
}

/**
 * Build the SVG path `d` attribute for a warp preset at a given line position.
 *
 * @param preset    OOXML `prstTxWarp` preset name.
 * @param width     Box width in px.
 * @param height    Box height in px.
 * @param lineIndex Zero-based index of the line/paragraph.
 * @param lineCount Total number of lines/paragraphs.
 * @param adj       Optional primary adjustment (raw OOXML 1/60000th units).
 * @param adj2      Optional secondary adjustment (raw OOXML 1/60000th units).
 */
export function buildWarpPath(
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

/**
 * Alias for {@link buildWarpPath}, kept under the original React/Angular symbol
 * name (`getWarpPath`) so binding renderers can import it directly from shared
 * without renaming their call sites.
 */
export const getWarpPath = buildWarpPath;

// ── CSS-transform approximation (envelope / simple) ─────────────────────

/**
 * Framework-agnostic CSS-transform approximation for a warp preset.
 *
 * `path` presets render along an SVG `<textPath>`; `envelope`/`simple`
 * presets cannot bend individual glyphs, so the visual effect is hinted with
 * a `transform` (perspective / rotateX / rotateY / skew / scale) plus the
 * `transform-origin` that anchors it. Port of the React `getEnvelopeCssTransform`
 * + `getSimpleCssTransform` generators (`viewer/utils/text-warp-classifier.ts`)
 * and the simpler `getTextWarpStyle` map (`viewer/utils/text-warp-css.tsx`).
 */
export interface WarpCssTransform {
	/** The CSS `transform` value. */
	transform: string;
	/** The CSS `transform-origin` value. */
	transformOrigin: string;
}

/**
 * Default OOXML adjustment values for envelope presets (raw 1/60000th units).
 * Default `adj1` of 18750 maps to an intensity factor of 1.
 */
const ENVELOPE_ADJ_DEFAULTS: Readonly<Record<string, number>> = {
	textInflate: 18750,
	textDeflate: 18750,
	textInflateBottom: 18750,
	textInflateTop: 18750,
	textDeflateBottom: 18750,
	textDeflateTop: 18750,
	textDeflateInflate: 18750,
	textDeflateInflateDeflate: 18750,
	textCanUp: 18750,
	textCanDown: 18750,
};

/**
 * CSS-transform approximation for an `envelope` preset (inflate/deflate/can).
 *
 * Envelope warps distort text non-uniformly (e.g. inflate widens the middle
 * lines, narrows the top/bottom). CSS cannot bend glyphs, so `scaleX`/`scaleY`,
 * `perspective`, and `rotateX` give a reasonable hint scaled by the `adj1`
 * intensity. Returns `undefined` for a non-envelope preset.
 *
 * @param preset One of the envelope warp preset names.
 * @param adj1   Optional first adjustment value (raw OOXML units).
 * @param adj2   Optional second adjustment value (raw OOXML units; reserved).
 */
export function getEnvelopeCssTransform(
	preset: string,
	adj1?: number,
	adj2?: number,
): WarpCssTransform | undefined {
	const defaultAdj1 = ENVELOPE_ADJ_DEFAULTS[preset] ?? 18750;
	const a1 = adj1 ?? defaultAdj1;
	void adj2;

	// Normalise adj1 to a 0..4 intensity factor (default adj 18750 -> factor 1).
	const intensity = Math.max(0, Math.min(a1 / 18750, 4));

	switch (preset) {
		case 'textInflate':
			return {
				transform: `scaleY(${1 + 0.15 * intensity}) scaleX(${1 + 0.05 * intensity})`,
				transformOrigin: 'center center',
			};
		case 'textInflateBottom':
			return {
				transform: `perspective(${600 - 100 * intensity}px) rotateX(${-8 * intensity}deg)`,
				transformOrigin: 'center bottom',
			};
		case 'textInflateTop':
			return {
				transform: `perspective(${600 - 100 * intensity}px) rotateX(${8 * intensity}deg)`,
				transformOrigin: 'center top',
			};
		case 'textDeflate':
			return {
				transform: `scaleY(${1 - 0.12 * intensity}) scaleX(${1 - 0.05 * intensity})`,
				transformOrigin: 'center center',
			};
		case 'textDeflateBottom':
			return {
				transform: `perspective(${600 - 100 * intensity}px) rotateX(${6 * intensity}deg)`,
				transformOrigin: 'center bottom',
			};
		case 'textDeflateTop':
			return {
				transform: `perspective(${600 - 100 * intensity}px) rotateX(${-6 * intensity}deg)`,
				transformOrigin: 'center top',
			};
		case 'textDeflateInflate':
			return {
				transform: `scaleY(${1 - 0.08 * intensity}) scaleX(${1 + 0.04 * intensity})`,
				transformOrigin: 'center center',
			};
		case 'textDeflateInflateDeflate':
			return {
				transform: `scaleY(${1 - 0.15 * intensity}) scaleX(${1 + 0.06 * intensity})`,
				transformOrigin: 'center center',
			};
		case 'textCanUp':
			return {
				transform: `perspective(${500 - 80 * intensity}px) rotateX(${-6 * intensity}deg)`,
				transformOrigin: 'center center',
			};
		case 'textCanDown':
			return {
				transform: `perspective(${500 - 80 * intensity}px) rotateX(${6 * intensity}deg)`,
				transformOrigin: 'center center',
			};
		default:
			return undefined;
	}
}

/** Default OOXML adjustment values for simple presets (raw 1/60000th units). */
const SIMPLE_ADJ_DEFAULTS: Readonly<Record<string, number>> = {
	textSlantUp: 55000,
	textSlantDown: 55000,
	textFadeRight: 50000,
	textFadeLeft: 50000,
	textFadeUp: 50000,
	textFadeDown: 50000,
	textCascadeUp: 44444,
	textCascadeDown: 44444,
};

/**
 * CSS-transform approximation for a `simple` preset (slant/fade/cascade).
 *
 * These warps are well-modelled by basic 2D transforms (`skewY`, `perspective`,
 * `rotateX`/`rotateY`) scaled by the `adj1` value. Returns `undefined` for a
 * non-simple preset.
 *
 * @param preset One of the simple warp preset names.
 * @param adj1   Optional adjustment value (raw OOXML units).
 */
export function getSimpleCssTransform(preset: string, adj1?: number): WarpCssTransform | undefined {
	const a1 = adj1 ?? SIMPLE_ADJ_DEFAULTS[preset] ?? 50000;

	switch (preset) {
		case 'textSlantUp':
			return {
				transform: `perspective(500px) rotateY(${8 * (a1 / 55000)}deg) skewY(${-4 * (a1 / 55000)}deg)`,
				transformOrigin: 'left center',
			};
		case 'textSlantDown':
			return {
				transform: `perspective(500px) rotateY(${-8 * (a1 / 55000)}deg) skewY(${4 * (a1 / 55000)}deg)`,
				transformOrigin: 'right center',
			};
		case 'textFadeRight':
			return {
				transform: `perspective(400px) rotateY(${-10 * (a1 / 50000)}deg)`,
				transformOrigin: 'left center',
			};
		case 'textFadeLeft':
			return {
				transform: `perspective(400px) rotateY(${10 * (a1 / 50000)}deg)`,
				transformOrigin: 'right center',
			};
		case 'textFadeUp':
			return {
				transform: `perspective(400px) rotateX(${-10 * (a1 / 50000)}deg)`,
				transformOrigin: 'center bottom',
			};
		case 'textFadeDown':
			return {
				transform: `perspective(400px) rotateX(${10 * (a1 / 50000)}deg)`,
				transformOrigin: 'center top',
			};
		case 'textCascadeUp':
			return {
				transform: `skewY(${-8 * (a1 / 44444)}deg)`,
				transformOrigin: 'left top',
			};
		case 'textCascadeDown':
			return {
				transform: `skewY(${8 * (a1 / 44444)}deg)`,
				transformOrigin: 'left top',
			};
		default:
			return undefined;
	}
}

/**
 * Dispatch a preset to its CSS-transform approximation based on its
 * {@link classifyTextWarp} category.
 *
 * Returns the `envelope`/`simple` transform, or `undefined` for `path`/`none`
 * presets (which render via `<textPath>` or flat text respectively). This is
 * the CSS-transform counterpart to {@link buildWarpPath}.
 *
 * @param preset OOXML `prstTxWarp` preset name.
 * @param adj    Optional primary adjustment (raw OOXML 1/60000th units).
 * @param adj2   Optional secondary adjustment (raw OOXML 1/60000th units).
 */
export function getWarpCssTransform(
	preset: PptxTextWarpPreset | string | undefined,
	adj?: number,
	adj2?: number,
): WarpCssTransform | undefined {
	const category = classifyTextWarp(preset);
	if (category === 'envelope') {
		return getEnvelopeCssTransform(preset as string, adj, adj2);
	}
	if (category === 'simple') {
		return getSimpleCssTransform(preset as string, adj);
	}
	return undefined;
}
