/**
 * Renderer-injected shape-effect definitions that need a companion DOM node
 * (a soft-edge `<filter>` def, a DAG fill-overlay tint layer), plus the helper
 * that strips dangling `url(#…)` filter references.
 *
 * Kept out of `element-style.ts` so that module stays focused on producing the
 * base `[ngStyle]` maps. Mirrors the Vue/Svelte `ShapeEffectOverlay` split.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import {
	buildStrokeOutline,
	buildSubpathFillOverlay,
	getComputedEffectStyle,
	getSoftEdgeSvgFilter,
} from '../internal/shared';
import type { FillOverlayCss, StrokeOutline, SubpathFillOverlay } from '../internal/shared';
import type { DuotoneFilterDef } from './duotone-filter';

/** Injectable soft-edge `<filter>` descriptor (id + feather radius in px). */
export interface SoftEdgeFilterDef {
	id: string;
	radius: number;
}

/**
 * Resolve the soft-edge feather `<filter>` descriptor for an element, or
 * `undefined` when it carries no `a:softEdge`. The renderer injects a matching
 * `<filter id>` (`feGaussianBlur` on `SourceAlpha` + `feComposite`) into a
 * hidden `<defs>` so the `filter: url(#soft-edge-<id>)` reference emitted by
 * the shared effect-filter builder resolves. Mirrors the duotone-filter pairing.
 */
export function getSoftEdgeFilterDef(el: PptxElement): SoftEdgeFilterDef | undefined {
	if (!hasShapeProperties(el)) {
		return undefined;
	}
	const ss = el.shapeStyle;
	const def = getSoftEdgeSvgFilter(ss, el.id);
	if (!def || !ss || typeof ss.softEdgeRadius !== 'number') {
		return undefined;
	}
	return { id: def.id, radius: Math.round(ss.softEdgeRadius) };
}

/**
 * DAG fill-overlay tint (colour + blend mode) for an element, or `undefined`
 * when none applies. The renderer paints this as a separate absolutely
 * positioned, blended layer over the shape (rather than blending the whole
 * element, which would also tint text/children). Mirrors the Vue/Svelte
 * `ShapeEffectOverlay`.
 */
export function getEffectFillOverlay(el: PptxElement): FillOverlayCss | undefined {
	return getComputedEffectStyle(el).fillOverlay;
}

/**
 * Stroked SVG outline for a gradient or pattern `a:ln`, or `undefined` for a
 * solid one.
 *
 * A CSS `border` takes a single flat colour, so a gradient outline rendered with
 * the parser's averaged `strokeColor` (flat where it should be two-tone, opaque
 * where it should fade out) and a patterned one lost its hatching entirely. The
 * renderer strokes this path over the element instead, following the shape's own
 * geometry, and `element-style.ts` drops the CSS border so the flat colour does
 * not show underneath.
 */
export function getStrokeOutline(el: PptxElement): StrokeOutline | undefined {
	return buildStrokeOutline(el);
}

/**
 * Per-sub-path fill overlay for a multi-sub-path preset (`smileyFace`'s open
 * eyes, `actionButtonBlank`'s darkened bevel well) or custom geometry whose
 * sub-paths carry their own `@fill` mode, or `undefined` when a single merged
 * fill is correct (the ordinary case). `element-style.ts` drops the container
 * `background-color` for these (via shared `suppressesCssFill`) so the
 * renderer paints this layered SVG instead.
 */
export function getSubpathFillOverlay(el: PptxElement): SubpathFillOverlay | undefined {
	return buildSubpathFillOverlay(el);
}

/**
 * Strip `url(#id)` filter references whose `<filter>` def is not actually
 * injected by the renderer, so a dangling reference does not blank the element.
 * Refs whose id is in `keepIds` are preserved verbatim.
 */
function stripUnresolvedFilterRefs(filter: string, keepIds: readonly string[]): string {
	return filter
		.replace(/\s*url\(#([^)]*)\)/gu, (match, id: string) => (keepIds.includes(id) ? match : ''))
		.trim();
}

/**
 * Resolve the final CSS `filter` string for a shape, keeping only `url(#…)`
 * references whose `<filter>` def the renderer injects. When the duotone def is
 * injected, every ref is preserved (legacy behaviour); otherwise only the
 * soft-edge ref survives and other dangling refs are stripped. Falls back to the
 * duotone `cssFilter` when the effect layer produced no filter of its own.
 */
export function resolveShapeFilterCss(
	fxFilter: string | undefined,
	duotone: DuotoneFilterDef | undefined,
	softEdge: SoftEdgeFilterDef | undefined,
): string | undefined {
	if (fxFilter) {
		let filter: string;
		if (duotone) {
			filter = fxFilter;
		} else if (softEdge) {
			filter = stripUnresolvedFilterRefs(fxFilter, [softEdge.id]);
		} else {
			filter = fxFilter.replace(/\s*url\(#[^)]*\)/gu, '').trim();
		}
		return filter || undefined;
	}
	return duotone ? duotone.cssFilter : undefined;
}
