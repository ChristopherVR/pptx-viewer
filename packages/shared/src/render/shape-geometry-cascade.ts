/**
 * `shape-geometry-cascade`: the single source of truth for HOW a shape's
 * geometry is painted.
 *
 * Every binding resolves fill, stroke, effects and 3D through shared modules
 * already, then ends with the same ~40-line decision tree: connector ->
 * stroke-only preset -> roundRect -> ellipse -> clip-path -> line -> cylinder.
 * That tail was hand-ported five times, and the copies drifted:
 *
 *  - Angular compared `shapeType` RAW (`=== 'ellipse' || === 'circle'`) instead
 *    of normalising it, so `oval` - a preset offered in the shape picker - and
 *    any capitalised spelling missed the ellipse branch entirely.
 *  - Angular had no connector, line or cylinder branch at all, so a cylinder
 *    fell through to a clip-path instead of its `48% / 12%` radius.
 *  - Two fidelity fixes in one day (ellipse pill radius, identity-rect clip)
 *    each had to be applied four and five times respectively.
 *
 * This module returns a framework-neutral DECISION; each binding only maps that
 * decision onto its own style-object shape (`React.CSSProperties`, a kebab-case
 * record, etc). Adding a branch here reaches all five bindings at once.
 *
 * @module render/shape-geometry-cascade
 */
import type { PptxElement } from 'pptx-viewer-core';
import { getRoundRectRadiusPx, getShapeType, hasShapeProperties } from 'pptx-viewer-core';

import { getResolvedShapeClipPath, isIdentityRectClip } from './shape-geometry';
import { isStrokeOnlyPresetElement } from './stroke-only-preset';

/**
 * What the geometry cascade decided to do with a shape's box.
 *
 * `bare` and `strokeOnly` both mean "paint no box"; they differ only in that a
 * stroke-only preset must also drop any background IMAGE, because its fill was
 * resolved before the cascade ran.
 */
export type ShapeGeometryDecision =
	/** Connector: the SVG renderer paints it; the box itself is empty. */
	| { readonly kind: 'bare' }
	/** Open preset (line, arc, connector family): outline is stroked as SVG. */
	| { readonly kind: 'strokeOnly' }
	/** roundRect / ellipse / cylinder: a CSS `border-radius` approximation. */
	| { readonly kind: 'borderRadius'; readonly radius: string }
	/** Any other preset with real geometry: a CSS `clip-path`. */
	| { readonly kind: 'clipPath'; readonly clipPath: string }
	/** A `line` preset the evaluator could not open: draw its top edge only. */
	| { readonly kind: 'lineEdge'; readonly strokeWidth: number }
	/** Plain rectangle (or nothing to do): leave the box alone. */
	| { readonly kind: 'none' };

/** Cylinder's CSS radius approximation (per-axis, so it survives non-square). */
const CYLINDER_RADIUS = '48% / 12%';

/** Below this, a roundRect's radius is not worth emitting. */
const MIN_ROUND_RECT_RADIUS_PX = 0.01;

/**
 * Resolve a shape element's geometry to a neutral painting decision.
 *
 * Order is load-bearing and matches PowerPoint's own precedence: connectors and
 * open presets never get a box, the two cheap radius approximations win over a
 * clip-path, and `line`/`cylinder` are consulted only once the evaluator has
 * declined to produce geometry.
 *
 * @param element The shape-like element to resolve.
 * @returns The decision a binding should apply to its style object.
 */
export function resolveShapeGeometry(element: PptxElement): ShapeGeometryDecision {
	const shapeType = getShapeType((element as { shapeType?: string }).shapeType);

	if (element.type === 'connector' || shapeType === 'connector') {
		return { kind: 'bare' };
	}

	// Open presets have no region to fill and no box to outline; the clip in
	// particular encloses zero area and would clip the stroked overlay away.
	if (isStrokeOnlyPresetElement(element)) {
		return { kind: 'strokeOnly' };
	}

	if (shapeType === 'roundRect' && hasShapeProperties(element)) {
		const radiusPx = getRoundRectRadiusPx(element);
		return radiusPx > MIN_ROUND_RECT_RADIUS_PX
			? { kind: 'borderRadius', radius: `${radiusPx}px` }
			: { kind: 'none' };
	}

	// `50%`, never a large px value: CSS clamps over-large radii by scaling them
	// all down uniformly, so a px radius collapses to half the SHORT side on
	// every corner and paints a pill with flat long edges.
	if (shapeType === 'ellipse') {
		return { kind: 'borderRadius', radius: '50%' };
	}

	// A rect preset's clip is its own bounding box: skip it so overflowing text
	// spills visibly (as PowerPoint does) instead of being sliced.
	const clipPath = isIdentityRectClip(element) ? undefined : getResolvedShapeClipPath(element);
	if (clipPath) {
		return { kind: 'clipPath', clipPath };
	}

	if (shapeType === 'line') {
		const authored = (element as { shapeStyle?: { strokeWidth?: number } }).shapeStyle?.strokeWidth;
		return { kind: 'lineEdge', strokeWidth: Math.max(Math.max(0, authored ?? 0), 2) };
	}

	if (shapeType === 'cylinder') {
		return { kind: 'borderRadius', radius: CYLINDER_RADIUS };
	}

	return { kind: 'none' };
}
