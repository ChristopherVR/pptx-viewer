/**
 * Text-warp (WordArt) descriptor resolver for the Angular viewer.
 *
 * Angular port of:
 *   packages/react/src/viewer/utils/text-warp-classifier.ts
 *   packages/react/src/viewer/utils/text-warp-css.tsx
 *   packages/react/src/viewer/utils/warp-text-renderer.tsx  (descriptor shape)
 *
 * `getTextWarp(element)` resolves an element's OOXML `prstTxWarp` preset into a
 * `TextWarpDef` that the Angular template can consume without any React/HTML
 * string injection.  The descriptor selects one of two rendering strategies:
 *
 *   - `'path'`    : SVG `<textPath>` along a curved/arc/circle path.
 *                   The `pathLines` array contains one entry per paragraph with a
 *                   pre-computed SVG `d` attribute.  The template renders an inline
 *                   `<svg>` with `<defs><path>` + `<text><textPath href>`.
 *
 *   - `'css'`     : A whole-block CSS transform approximation.  The template
 *                   applies `cssTransform` and `cssTransformOrigin` to the
 *                   existing `div.pptx-ng-text` wrapper (or a parent div) via
 *                   `[ngStyle]`.  No SVG required.
 *
 * Presets classified as `'none'` (textNoShape, textPlain, unknown) return
 * `undefined` so callers can skip extra rendering without an allowlist check.
 */
import type { PptxElement, PptxTextWarpPreset, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { getWarpPath, shouldUseSvgWarp } from './warp-path-generators';

// ── Warp category classifier ───────────────────────────────────────────
// (mirrors text-warp-classifier.ts from React)

/** The four rendering strategy families. */
export type WarpCategory = 'path' | 'envelope' | 'simple' | 'none';

const NONE_PRESETS = new Set<string>(['textNoShape', 'textPlain']);

/** Presets that render best with SVG textPath along curved/circular paths. */
const PATH_PRESETS = new Set<string>([
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

/**
 * Envelope presets stretch text non-uniformly (wider/narrower per line).
 * CSS transforms approximate the visual effect per text block.
 */
const ENVELOPE_PRESETS = new Set<string>([
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

/** Simple presets that work with basic 2D CSS transforms (skew, perspective). */
const SIMPLE_PRESETS = new Set<string>([
	'textSlantUp',
	'textSlantDown',
	'textFadeRight',
	'textFadeLeft',
	'textFadeUp',
	'textFadeDown',
	'textCascadeUp',
	'textCascadeDown',
]);

/** All known classified presets (excludes `none`-family). */
export const ALL_CLASSIFIED_PRESETS: ReadonlySet<string> = new Set([
	...NONE_PRESETS,
	...PATH_PRESETS,
	...ENVELOPE_PRESETS,
	...SIMPLE_PRESETS,
]);

/**
 * Classify a warp preset into a rendering strategy category.
 *
 * Returns `'none'` for unknown or empty presets so callers can safely
 * skip rendering without an explicit allowlist check.
 */
export function getWarpCategory(preset: string | undefined): WarpCategory {
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

// ── Paragraph helper ───────────────────────────────────────────────────

/** A paragraph extracted from an element's textSegments. */
export interface WarpParagraph {
	/** Text segments belonging to this paragraph (no paragraph-break segments). */
	segments: TextSegment[];
}

/**
 * Split an element's `textSegments` into paragraphs.
 * Paragraph-break segments are used as delimiters and excluded from output.
 * Falls back to a single synthetic paragraph when only `element.text` is set.
 */
export function groupIntoParagraphs(el: {
	text?: string;
	textSegments?: TextSegment[];
}): WarpParagraph[] {
	const segs = el.textSegments;
	if (!segs || segs.length === 0) {
		if (el.text) {
			return [{ segments: [{ text: el.text, style: {} }] }];
		}
		return [];
	}
	const paragraphs: WarpParagraph[] = [];
	let current: TextSegment[] = [];
	for (const seg of segs) {
		if (seg.isParagraphBreak) {
			if (current.length > 0) {
				paragraphs.push({ segments: current });
			}
			current = [];
		} else {
			current.push(seg);
		}
	}
	if (current.length > 0) {
		paragraphs.push({ segments: current });
	}
	return paragraphs;
}

// ── TextWarpDef shape ──────────────────────────────────────────────────

/**
 * A single pre-computed SVG path line for one text paragraph.
 *
 * The template renders this as:
 *   `<path [id]="pathId" [attr.d]="d" fill="none" />`
 * inside `<defs>`, then references it with `<textPath [attr.href]="'#'+pathId">`.
 */
export interface WarpPathLine {
	/** Unique DOM id for this `<path>` element (safe to use as `href` fragment). */
	pathId: string;
	/** SVG path data (`d` attribute). */
	d: string;
	/** The text segments that flow along this path. */
	segments: TextSegment[];
}

/**
 * Descriptor for SVG `<textPath>`-based warp rendering.
 *
 * One `WarpPathLine` per paragraph.  The template renders an inline `<svg>`
 * covering the element bounds, defines each path in `<defs>`, then lays
 * `<text><textPath href="#pathId">` on each path.
 */
export interface TextWarpPathDef {
	readonly strategy: 'path';
	/** OOXML preset name (e.g. `'textArchUp'`). */
	readonly preset: PptxTextWarpPreset;
	/** One entry per paragraph. */
	readonly pathLines: WarpPathLine[];
	/** Element pixel width (for `<svg width>`). */
	readonly width: number;
	/** Element pixel height (for `<svg height>`). */
	readonly height: number;
	/** SVG `text-anchor` value derived from paragraph alignment. */
	readonly textAnchor: 'start' | 'middle' | 'end';
	/** SVG `<textPath startOffset>` value (e.g. `"0%"`, `"50%"`, `"100%"`). */
	readonly startOffset: string;
	/** Base font size in points from the element's text style. */
	readonly baseFontSize: number;
	/** Base font family string (already CSS-ready). */
	readonly baseFontFamily: string;
	/** Base text fill colour (hex). */
	readonly baseColor: string;
}

/**
 * Descriptor for CSS-transform-based warp rendering.
 *
 * The template applies `cssTransform` + `cssTransformOrigin` on the
 * `div.pptx-ng-text` wrapper (or a containing div) via `[ngStyle]`.
 */
export interface TextWarpCssDef {
	readonly strategy: 'css';
	/** OOXML preset name (e.g. `'textSlantUp'`). */
	readonly preset: PptxTextWarpPreset;
	/** CSS `transform` string (e.g. `"perspective(500px) rotateY(8deg) skewY(-4deg)"`). */
	readonly cssTransform: string;
	/** CSS `transform-origin` string (e.g. `"left center"`). */
	readonly cssTransformOrigin: string;
}

/** Union of the two warp rendering strategies. */
export type TextWarpDef = TextWarpPathDef | TextWarpCssDef;

// ── CSS transform generators ───────────────────────────────────────────
// (mirrors text-warp-classifier.ts getEnvelopeCssTransform / getSimpleCssTransform)

/** Default OOXML adjustment values for envelope presets (raw 1/60000th units). */
const ENVELOPE_DEFAULTS: Record<string, number> = {
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

interface CssDef {
	transform: string;
	transformOrigin: string;
}

/** Resolve CSS transform + origin for envelope-family presets. */
function envelopeCss(preset: string, adj1?: number): CssDef | undefined {
	const defaultAdj = ENVELOPE_DEFAULTS[preset] ?? 18750;
	const a1 = adj1 ?? defaultAdj;
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
const SIMPLE_DEFAULTS: Record<string, number> = {
	textSlantUp: 55000,
	textSlantDown: 55000,
	textFadeRight: 50000,
	textFadeLeft: 50000,
	textFadeUp: 50000,
	textFadeDown: 50000,
	textCascadeUp: 44444,
	textCascadeDown: 44444,
};

/** Resolve CSS transform + origin for simple-family presets. */
function simpleCss(preset: string, adj1?: number): CssDef | undefined {
	const defaultAdj = SIMPLE_DEFAULTS[preset] ?? 50000;
	const a1 = adj1 ?? defaultAdj;

	switch (preset) {
		case 'textSlantUp': {
			const skew = -4 * (a1 / 55000);
			return {
				transform: `perspective(500px) rotateY(${8 * (a1 / 55000)}deg) skewY(${skew}deg)`,
				transformOrigin: 'left center',
			};
		}
		case 'textSlantDown': {
			const skew = 4 * (a1 / 55000);
			return {
				transform: `perspective(500px) rotateY(${-8 * (a1 / 55000)}deg) skewY(${skew}deg)`,
				transformOrigin: 'right center',
			};
		}
		case 'textFadeRight': {
			const angle = 10 * (a1 / 50000);
			return {
				transform: `perspective(400px) rotateY(${-angle}deg)`,
				transformOrigin: 'left center',
			};
		}
		case 'textFadeLeft': {
			const angle = 10 * (a1 / 50000);
			return {
				transform: `perspective(400px) rotateY(${angle}deg)`,
				transformOrigin: 'right center',
			};
		}
		case 'textFadeUp': {
			const angle = 10 * (a1 / 50000);
			return {
				transform: `perspective(400px) rotateX(${-angle}deg)`,
				transformOrigin: 'center bottom',
			};
		}
		case 'textFadeDown': {
			const angle = 10 * (a1 / 50000);
			return {
				transform: `perspective(400px) rotateX(${angle}deg)`,
				transformOrigin: 'center top',
			};
		}
		case 'textCascadeUp': {
			const skew = -8 * (a1 / 44444);
			return {
				transform: `skewY(${skew}deg)`,
				transformOrigin: 'left top',
			};
		}
		case 'textCascadeDown': {
			const skew = 8 * (a1 / 44444);
			return {
				transform: `skewY(${skew}deg)`,
				transformOrigin: 'left top',
			};
		}
		default:
			return undefined;
	}
}

// ── SVG alignment helpers ──────────────────────────────────────────────

/** Map paragraph alignment to SVG textPath properties. */
function resolveAlignment(align: string | undefined): {
	startOffset: string;
	textAnchor: 'start' | 'middle' | 'end';
} {
	switch (align) {
		case 'center':
			return { startOffset: '50%', textAnchor: 'middle' };
		case 'right':
			return { startOffset: '100%', textAnchor: 'end' };
		default:
			return { startOffset: '0%', textAnchor: 'start' };
	}
}

// ── Public API ─────────────────────────────────────────────────────────

const DEFAULT_FONT_SIZE = 18;
const DEFAULT_FONT_FAMILY = 'Calibri, sans-serif';
const DEFAULT_COLOR = '#000000';

/**
 * Resolve a `PptxElement`'s text warp preset into a `TextWarpDef` descriptor,
 * or `undefined` when the element carries no warp (or the preset is `textNoShape` /
 * `textPlain` / unknown).
 *
 * @param element  Any `PptxElement`.  Elements without text properties always
 *                 return `undefined`.
 * @returns  A `TextWarpDef` with `strategy: 'path'` for SVG textPath warps, or
 *           `strategy: 'css'` for CSS-transform approximations.
 */
export function getTextWarp(element: PptxElement): TextWarpDef | undefined {
	if (!hasTextProperties(element)) {
		return undefined;
	}

	const ts = element.textStyle;
	const preset = ts?.textWarpPreset;

	if (!preset || preset === 'textNoShape' || preset === 'textPlain') {
		return undefined;
	}

	const adj1 = ts?.textWarpAdj;
	const adj2 = ts?.textWarpAdj2;

	// ── Strategy: SVG path ──────────────────────────────────────────────
	if (shouldUseSvgWarp(preset)) {
		const paragraphs = groupIntoParagraphs(element);
		if (paragraphs.length === 0) {
			return undefined;
		}

		const lineCount = paragraphs.length;
		const width = element.width;
		const height = element.height;
		const pathIdPrefix = `ng-warp-${element.id}`;

		const { startOffset, textAnchor } = resolveAlignment(ts?.align);

		const pathLines: WarpPathLine[] = paragraphs.map((para, i) => ({
			pathId: `${pathIdPrefix}-${i}`,
			d: getWarpPath(preset, width, height, i, lineCount, adj1, adj2),
			segments: para.segments,
		}));

		return {
			strategy: 'path',
			preset,
			pathLines,
			width,
			height,
			textAnchor,
			startOffset,
			baseFontSize: (ts?.fontSize ?? DEFAULT_FONT_SIZE) as number,
			baseFontFamily: ts?.fontFamily ?? DEFAULT_FONT_FAMILY,
			baseColor: ts?.color ?? DEFAULT_COLOR,
		} satisfies TextWarpPathDef;
	}

	// ── Strategy: CSS transform ─────────────────────────────────────────
	const category = getWarpCategory(preset);

	let cssDef: CssDef | undefined;
	if (category === 'envelope') {
		cssDef = envelopeCss(preset, adj1);
	} else if (category === 'simple') {
		cssDef = simpleCss(preset, adj1);
	}

	if (!cssDef) {
		return undefined;
	}

	return {
		strategy: 'css',
		preset,
		cssTransform: cssDef.transform,
		cssTransformOrigin: cssDef.transformOrigin,
	} satisfies TextWarpCssDef;
}
