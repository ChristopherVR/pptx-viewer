/**
 * `text-body-rect`: the geometry's TEXT RECTANGLE (`a:rect`), as body padding.
 *
 * Every preset geometry, and every `a:custGeom`, may declare an `a:rect`: the
 * inscribed rectangle PowerPoint lays text out in. A chevron's text sits between
 * its two arrow points, a `homePlate`'s stops short of its nose, an action
 * button's is inset from its bevel. The core evaluator has always computed it
 * (`evaluatePresetShape(...).textRect`) and `a:custGeom`'s has always been
 * parsed (`customGeometryTextRect`), but NOTHING read either one: a grep for
 * `.textRect` across all five bindings found only unrelated
 * `getBoundingClientRect` locals. Text in a chevron, callout, arrow or wedge was
 * therefore laid out against the full bounding box and spilled over the
 * geometry, in every binding equally.
 *
 * This module turns the evaluator's output into a framework-neutral padding
 * quadruple that `buildTextBlockStyle` adds to the `a:bodyPr` insets (which, per
 * the spec, apply INSIDE the text rectangle, so the two add). That single seam
 * reaches react, vue, angular, svelte and vanilla at once.
 *
 * It applies the rectangle only for the presets PowerPoint itself has confirmed
 * (see {@link VERIFIED_TEXT_RECT_PRESETS}): the table's `rect` entries had never
 * been read by anything, and measuring PowerPoint showed most of them are wrong.
 *
 * @module render/text-body-rect
 */

import type { PptxElement } from 'pptx-viewer-core';
import { evaluatePresetShape } from 'pptx-viewer-core';

import { VERIFIED_TEXT_RECT_PRESETS } from './verified-text-rect-presets';

/** Extra padding, in px, contributed by the geometry's text rectangle. */
export interface TextBodyRectPadding {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** Nothing to add: the geometry's text rectangle is its whole bounding box. */
const NO_PADDING: TextBodyRectPadding = { left: 0, top: 0, right: 0, bottom: 0 };

/** Below this a computed inset is rounding noise, not a real inset. */
const MIN_INSET_PX = 0.5;

/**
 * Smallest content box a text rectangle may leave behind, in px.
 *
 * A rectangle that leaves less than this in either axis cannot hold a glyph, so
 * honouring it would make the body's text invisible rather than inset. Several
 * preset `rect` entries in the core table were degenerate before the G1 fixes
 * (`heart`, `moon` and `pentagon` collapsed to zero-width/negative rectangles
 * at 200x100pt via broken guide references; see `VERIFIED_TEXT_RECT_PRESETS`'s
 * doc comment), and `leftBrace` remains unverified/unfixed, so this guard
 * backs up the allowlist below: a datum that turns bad at some other aspect
 * ratio is dropped rather than blanking a shape's text.
 */
const MIN_CONTENT_PX = 8;

/** Cache size beyond which the memo is dropped wholesale (bounded, not LRU). */
const CACHE_LIMIT = 512;

/**
 * Memo for `evaluatePresetShape`, which walks the preset's whole `gdLst` and
 * `pathLst`. `buildTextBlockStyle` runs on every element of every rendered
 * slide, so an uncached call would evaluate the same handful of presets
 * thousands of times per deck.
 */
const rectCache = new Map<string, TextBodyRectPadding>();

/** Stable cache key: the inputs `evaluatePresetShape` actually reads. */
function cacheKey(
	shapeType: string,
	width: number,
	height: number,
	adjustments: Record<string, number> | undefined,
): string {
	const adj = adjustments
		? Object.keys(adjustments)
				.sort()
				.map((k) => `${k}=${adjustments[k]}`)
				.join(',')
		: '';
	return `${shapeType}|${width}|${height}|${adj}`;
}

/**
 * Turn resolved rectangle edges (px, in the element's own box) into padding,
 * or `undefined` when the rectangle is the whole box or is unusable.
 */
function toPadding(
	l: number,
	t: number,
	r: number,
	b: number,
	width: number,
	height: number,
): TextBodyRectPadding | undefined {
	if (![l, t, r, b].every((n) => Number.isFinite(n))) {
		return undefined;
	}
	// Degenerate or inverted rectangles carry no information.
	if (r - l < MIN_CONTENT_PX || b - t < MIN_CONTENT_PX) {
		return undefined;
	}
	const left = Math.max(0, Math.min(l, width));
	const top = Math.max(0, Math.min(t, height));
	const right = Math.max(0, width - Math.max(0, Math.min(r, width)));
	const bottom = Math.max(0, height - Math.max(0, Math.min(b, height)));
	// Clamping may itself have produced a box too small to render into.
	if (width - left - right < MIN_CONTENT_PX || height - top - bottom < MIN_CONTENT_PX) {
		return undefined;
	}
	if (left < MIN_INSET_PX && top < MIN_INSET_PX && right < MIN_INSET_PX && bottom < MIN_INSET_PX) {
		return undefined;
	}
	return { left, top, right, bottom };
}

/**
 * The text rectangle of an `a:custGeom` freeform, when it is expressible.
 *
 * `a:custGeom/a:rect` edges may be literal path-space coordinates OR references
 * to guides in the shape's `a:gdLst`. Core preserves the guide list only as raw
 * XML (`customGeometryRawData.gdLstXml`), so only the literal form can be
 * resolved here; a guide reference returns `undefined` and the body keeps its
 * bounding box, exactly as before this module existed.
 */
function customGeometryRectPadding(element: PptxElement): TextBodyRectPadding | undefined {
	const custom = element as {
		customGeometryTextRect?: { l?: string; t?: string; r?: string; b?: string };
		pathWidth?: number;
		pathHeight?: number;
	};
	const rect = custom.customGeometryTextRect;
	if (!rect) {
		return undefined;
	}
	const pathWidth = custom.pathWidth;
	const pathHeight = custom.pathHeight;
	if (!pathWidth || !pathHeight || pathWidth <= 0 || pathHeight <= 0) {
		return undefined;
	}
	const literal = (token: string | undefined): number | undefined => {
		if (token === undefined) {
			return undefined;
		}
		const value = Number(token);
		return Number.isFinite(value) ? value : undefined;
	};
	const l = literal(rect.l);
	const t = literal(rect.t);
	const r = literal(rect.r);
	const b = literal(rect.b);
	if (l === undefined || t === undefined || r === undefined || b === undefined) {
		return undefined;
	}
	const sx = element.width / pathWidth;
	const sy = element.height / pathHeight;
	return toPadding(l * sx, t * sy, r * sx, b * sy, element.width, element.height);
}

/**
 * Resolve the padding an element's geometry text rectangle contributes.
 *
 * Returns zeroes (never `undefined`) so a caller can add the four values
 * unconditionally. Zeroes are returned for a plain rectangle, for a shape with
 * no geometry, and for any rectangle the guards above reject.
 *
 * @param element The element whose text body is being laid out.
 * @returns Extra px padding on each edge, from the geometry's `a:rect`.
 */
export function resolveTextBodyRectPadding(element: PptxElement): TextBodyRectPadding {
	const width = element.width;
	const height = element.height;
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return NO_PADDING;
	}

	const custom = customGeometryRectPadding(element);
	if (custom) {
		return custom;
	}

	const shapeType = (element as { shapeType?: string }).shapeType;
	if (!shapeType || !VERIFIED_TEXT_RECT_PRESETS.has(shapeType.toLowerCase())) {
		return NO_PADDING;
	}
	const adjustments = (element as { shapeAdjustments?: Record<string, number> }).shapeAdjustments;
	const key = cacheKey(shapeType, width, height, adjustments);
	const cached = rectCache.get(key);
	if (cached) {
		return cached;
	}

	const evaluated = evaluatePresetShape(shapeType, width, height, adjustments);
	const rect = evaluated?.textRect;
	const padding = rect
		? (toPadding(rect.l, rect.t, rect.r, rect.b, width, height) ?? NO_PADDING)
		: NO_PADDING;

	if (rectCache.size >= CACHE_LIMIT) {
		rectCache.clear();
	}
	rectCache.set(key, padding);
	return padding;
}
