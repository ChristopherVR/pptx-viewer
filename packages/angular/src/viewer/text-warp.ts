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

import {
	ALL_CLASSIFIED_PRESETS as SHARED_ALL_CLASSIFIED_PRESETS,
	classifyTextWarp,
	getEnvelopeCssTransform,
	getSimpleCssTransform,
	groupIntoParagraphs,
} from '../internal/shared';
import type { WarpCategory as SharedWarpCategory, WarpParagraph } from '../internal/shared';
import { getWarpPath, shouldUseSvgWarp } from './warp-path-generators';

// ── Warp category classifier ───────────────────────────────────────────
// Re-exported from shared `render/text-warp.ts` (classifyTextWarp /
// ALL_CLASSIFIED_PRESETS) under the local symbol names Angular consumers use.

/** The four rendering strategy families. */
export type WarpCategory = SharedWarpCategory;

/** All known classified presets (excludes `none`-family). */
export const ALL_CLASSIFIED_PRESETS: ReadonlySet<string> = SHARED_ALL_CLASSIFIED_PRESETS;

/**
 * Classify a warp preset into a rendering strategy category.
 *
 * Returns `'none'` for unknown or empty presets so callers can safely
 * skip rendering without an explicit allowlist check. Thin alias for the
 * shared `classifyTextWarp` helper.
 */
export const getWarpCategory: (preset: string | undefined) => WarpCategory = classifyTextWarp;

// ── Paragraph helper ───────────────────────────────────────────────────
// `groupIntoParagraphs` + `WarpParagraph` now live in pptx-viewer-shared
// (render/text-warp), shared with the React + Vue warp renderers. Re-exported
// here under the same names so existing Angular import paths keep working.

export type { WarpParagraph };
export { groupIntoParagraphs };

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
// Envelope / simple CSS approximations are provided by shared
// `getEnvelopeCssTransform` / `getSimpleCssTransform` (render/text-warp.ts).

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

	let cssDef: { transform: string; transformOrigin: string } | undefined;
	if (category === 'envelope') {
		cssDef = getEnvelopeCssTransform(preset, adj1, adj2);
	} else if (category === 'simple') {
		cssDef = getSimpleCssTransform(preset, adj1);
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
