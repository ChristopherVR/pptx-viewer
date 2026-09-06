/**
 * Renderer-injected shape-effect definitions that need a companion DOM node
 * (a soft-edge `<filter>` def, a DAG fill-overlay tint layer), plus the helper
 * that strips dangling `url(#…)` filter references.
 *
 * Kept out of `element-style.ts` so that module stays focused on producing the
 * base `[ngStyle]` maps. Mirrors the Vue/Svelte `ShapeEffectOverlay` split.
 */
import type { PptxElement } from 'pptx-viewer-core';

import {
	buildStrokeOutline,
	buildSubpathFillOverlay,
	getComputedEffectStyle,
	getEffectStyleSource,
	getSoftEdgeSvgFilter,
} from '../internal/shared';
import type {
	FillOverlayCss,
	ReflectionWrapperStyle,
	StrokeOutline,
	SubpathFillOverlay,
} from '../internal/shared';
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
	// `getEffectStyleSource` resolves a shape/image's own `shapeStyle` OR a
	// group's `groupEffectStyle` (the same `p:grpSpPr` extraction, kept for
	// shadow/glow/soft-edge/reflection even without a fill of its own), so a
	// group's own `a:softEdge` gets an injectable filter too.
	const ss = getEffectStyleSource(el);
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
 * `a:reflection` mirrored-sibling wrapper style descriptor (position, mirror
 * transform, mask-image fade - see shared's `getReflectionWrapperStyle`).
 * Cross-browser, unlike the `-webkit-box-reflect` `element-style.ts` used to
 * set (Firefox never implemented that property, so reflections were invisible
 * there entirely).
 *
 * The mirrored CONTENT is no longer carried here: `ReflectionMirrorContentComponent`
 * (`reflection-mirror-content.component.ts`) paints the element's own fill,
 * outline, text body and - for a group - its children directly from
 * `element`, rather than this descriptor only ever offering a resolved fill
 * (or a picture's `<img>` src) to paint a flat box with.
 */
export interface ReflectionOverlay {
	wrapperStyle: ReflectionWrapperStyle;
}

/**
 * Resolve the reflection overlay descriptor for an element, or `undefined`
 * when it has no `a:reflection`. Works for a group too: a group carries no
 * `shapeStyle` of its own, but `getComputedEffectStyle` resolves
 * `p:grpSpPr/a:effectLst/a:reflection` from `groupEffectStyle` for one.
 */
export function getReflectionOverlay(el: PptxElement): ReflectionOverlay | undefined {
	const wrapperStyle = getComputedEffectStyle(el).reflection;
	return wrapperStyle ? { wrapperStyle } : undefined;
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
