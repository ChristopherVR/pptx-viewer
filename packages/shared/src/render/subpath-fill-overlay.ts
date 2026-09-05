/**
 * Per-sub-path FILL overlay: the shared mechanism behind two structurally
 * identical bugs.
 *
 * Both custom geometry (`a:custGeom`) and preset geometry (`a:prstGeom`) can
 * carry several sub-paths, each with its own `@fill` mode
 * (`norm`/`lighten`/`lightenLess`/`darken`/`darkenLess`/`none`) and `@stroke`
 * flag. Every binding paints a shape as ONE box: a single CSS
 * `background-color` clipped to a single merged `clip-path` built by
 * concatenating every sub-path's `d` together (`getResolvedShapeClipPath`,
 * `buildCustomGeometryClipPath`). That merge is lossy two ways:
 *
 *  - It discards each sub-path's own `@fill`, so a preset's shading/bevel
 *    sub-paths (`lighten`/`darken`, e.g. every `actionButton*`, curved arrows,
 *    `bevel`, `foldedCorner`) paint as flat instead of shaded, and a `fill="none"`
 *    sub-path (`smileyFace`'s eyes/mouth) paints FILLED instead of as an open
 *    stroke - because `clip-path` auto-closes every sub-path.
 *  - It cannot vary the fill AT ALL across sub-paths, so it is architecturally
 *    incapable of the above regardless of which colour is chosen.
 *
 * The fix is the same for both: paint the affected element as layered SVG
 * `<path>`s, each carrying its own resolved fill, instead of one CSS box. This
 * module decides WHICH elements need that (an element needs it only when at
 * least one sub-path's mode is not `norm`/unset, or it opts out of its stroke)
 * and builds the paints via the shared `./vector-subpath-paint`; a binding's
 * `ShapeEffectOverlay` renders the result as an `<svg>` sibling to the shape
 * box (mirroring `buildStrokeOutline`), and `getComputedFillStyle`
 * ({@link suppressesCssFill}) drops the CSS background so the flat colour does
 * not show underneath.
 *
 * Restricted to a solid (or absent) fill: a gradient/pattern/image fill keeps
 * the existing single merged clip-path box, since neither geometry kind's
 * sub-paths can carry an independent paint SERVER (only a solid, mode-shifted
 * colour), and the common case for both bug classes - shading/bevel highlights,
 * `smileyFace`'s eyes - is a solid theme colour.
 */
import type {
	CustomGeometryPath,
	CustomGeometryRawData,
	CustomGeometrySubpathSvg,
	PptxElement,
} from 'pptx-viewer-core';
import {
	MIN_ELEMENT_SIZE,
	customGeometryPathsToSvgSubpaths,
	evaluateCustomGeometryPaths,
	evaluatePresetShape,
	hasShapeProperties,
} from 'pptx-viewer-core';

import { DEFAULT_FILL_COLOR } from '../constants';
import type { SubpathPaint } from './vector-subpath-paint';
import { buildSubpathPaints } from './vector-subpath-paint';

/**
 * The box a preset is evaluated at: the element's authored extent, padded out
 * to {@link MIN_ELEMENT_SIZE}. Matches `getContainerStyle`'s `paintedElementSize`
 * (not imported directly, to avoid a `fill-style.ts` <-> `element-style.ts` <->
 * `subpath-fill-overlay.ts` import cycle: `fill-style.ts` consumes
 * {@link suppressesCssFill} and `element-style.ts` consumes `fill-style.ts`).
 */
function paintedSize(element: PptxElement): { width: number; height: number } {
	return {
		width: Math.max(element.width, MIN_ELEMENT_SIZE),
		height: Math.max(element.height, MIN_ELEMENT_SIZE),
	};
}

/** Everything a binding needs to paint an element's per-sub-path fill overlay. */
export interface SubpathFillOverlay {
	/** One paint per sub-path, in authoring order. */
	readonly paints: readonly SubpathPaint[];
	/** `viewBox` width, in the same coordinate space as every `paints[].d`. */
	readonly viewBoxWidth: number;
	/** `viewBox` height, in the same coordinate space as every `paints[].d`. */
	readonly viewBoxHeight: number;
}

/**
 * Whether any sub-path needs individual paint handling: a non-`norm` fill mode
 * or an explicit stroke opt-out. Mirrors the threshold the React custom-geometry
 * renderer already used, now shared with preset geometry too. A shape whose
 * sub-paths are all plain (unset/`norm` fill, stroked) renders identically
 * either way, so declining here keeps ordinary shapes on the cheaper CSS path.
 */
function needsPerSubpathPaint(subpaths: readonly CustomGeometrySubpathSvg[]): boolean {
	return subpaths.some(
		(sp) => (sp.fillMode !== undefined && sp.fillMode !== 'norm') || sp.stroke === false,
	);
}

/** The custom-geometry / preset slots read off an element. */
interface SubpathCapableElement {
	pathData?: string;
	pathWidth?: number;
	pathHeight?: number;
	customGeometryPaths?: CustomGeometryPath[];
	customGeometryRawData?: CustomGeometryRawData;
	shapeType?: string;
	shapeAdjustments?: Record<string, number>;
}

/** Resolved per-sub-path geometry needing individual paint, or `undefined`. */
interface SubpathGeometry {
	subpaths: CustomGeometrySubpathSvg[];
	width: number;
	height: number;
}

/** Sub-path-capable element types: `PptxCustomPathProperties` lives only on these. */
function asSubpathCapable(element: PptxElement): SubpathCapableElement | undefined {
	if (element.type === 'shape' || element.type === 'image' || element.type === 'picture') {
		return element;
	}
	return undefined;
}

/**
 * Resolve an element's per-sub-path geometry when, and only when, it genuinely
 * needs individual paint handling - custom geometry with structured sub-paths,
 * or a preset whose evaluated sub-paths vary. Returns `undefined` for every
 * ordinary shape so callers keep their existing single merged fill/clip.
 */
function getSubpathGeometry(element: PptxElement): SubpathGeometry | undefined {
	const slots = asSubpathCapable(element);
	if (!slots) {
		return undefined;
	}

	// Custom geometry: only the STRUCTURED sub-paths (from `a:custGeom/a:pathLst`)
	// carry per-sub-path `@fill`/`@stroke`; a freeform with only aggregate
	// `pathData` (no structured paths) has no per-sub-path intent to honour.
	if (slots.pathData && slots.pathWidth && slots.pathHeight) {
		// Live-evaluate the raw `a:pathLst` against the current adjust values so a
		// mid-drag `a:ahXY`/`a:ahPolar` reshape moves the per-sub-path overlay
		// with the clip path; falls back to the parse-time paths when the raw
		// XML is missing (older data) or the guide list cannot be evaluated.
		const structured =
			evaluateCustomGeometryPaths(
				slots.customGeometryRawData,
				slots.pathWidth,
				slots.pathHeight,
				slots.shapeAdjustments,
			) ?? slots.customGeometryPaths;
		if (!structured || structured.length === 0) {
			return undefined;
		}
		const subpaths = customGeometryPathsToSvgSubpaths(
			structured,
			slots.pathWidth,
			slots.pathHeight,
		);
		return needsPerSubpathPaint(subpaths)
			? { subpaths, width: slots.pathWidth, height: slots.pathHeight }
			: undefined;
	}

	// Preset geometry: evaluate at the same PAINTED size the container box uses
	// (padded for degenerate shapes), so the overlay's viewBox lines up with it.
	if (!slots.shapeType) {
		return undefined;
	}
	const { width, height } = paintedSize(element);
	const result = evaluatePresetShape(slots.shapeType, width, height, slots.shapeAdjustments);
	// `fillNone` (every sub-path opts out of fill, e.g. `arc`) is an OPEN preset:
	// `./stroke-only-preset` already routes it through the stroke overlay with no
	// fill at all, so it must not also be treated as a multi-sub-path FILL here.
	if (!result || result.fillNone || result.paths.length === 0) {
		return undefined;
	}
	const subpaths: CustomGeometrySubpathSvg[] = result.paths.map((p) => ({
		d: p.d,
		fillMode: p.fill as CustomGeometrySubpathSvg['fillMode'],
		stroke: p.stroke,
	}));
	return needsPerSubpathPaint(subpaths) ? { subpaths, width, height } : undefined;
}

/**
 * Whether an element's fill mode is one this overlay can reproduce (a solid
 * colour or none at all). A gradient/pattern/image fill keeps the existing
 * single merged clip-path box, since a sub-path can only carry a solid,
 * mode-shifted colour.
 */
function hasReproducibleFillMode(element: PptxElement): boolean {
	if (!hasShapeProperties(element)) {
		return false;
	}
	const mode = element.shapeStyle?.fillMode;
	return mode === undefined || mode === 'solid' || mode === 'none';
}

/**
 * Whether a binding must drop its CSS `background-color` / `background-image`
 * for this element because {@link buildSubpathFillOverlay} is painting the
 * fill instead. Mirrors `suppressesCssBorder`'s role for the stroke overlay;
 * consumed by shared `getComputedFillStyle`.
 */
export function suppressesCssFill(element: PptxElement): boolean {
	return hasReproducibleFillMode(element) && getSubpathGeometry(element) !== undefined;
}

/**
 * Build the per-sub-path fill overlay for an element, or `undefined` when a
 * single merged fill/clip-path is correct (the ordinary case).
 */
export function buildSubpathFillOverlay(element: PptxElement): SubpathFillOverlay | undefined {
	if (!hasReproducibleFillMode(element)) {
		return undefined;
	}
	const geometry = getSubpathGeometry(element);
	if (!geometry) {
		return undefined;
	}
	const ss = hasShapeProperties(element) ? element.shapeStyle : undefined;
	const hasFill =
		Boolean(ss?.fillColor) && ss?.fillColor !== 'transparent' && ss?.fillMode !== 'none';
	const fillColor = ss?.fillColor ?? DEFAULT_FILL_COLOR;
	return {
		paints: buildSubpathPaints(geometry.subpaths, hasFill, fillColor, ss?.fillOpacity),
		viewBoxWidth: geometry.width,
		viewBoxHeight: geometry.height,
	};
}
