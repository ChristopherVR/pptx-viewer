/**
 * Map a layoutNode's `dgm:shape` preset geometry
 * (`PptxSmartArtLayoutNodeShape.presetGeometry`) to the coarse render kind
 * (rect/circle/polygon) an arranger's per-point item builder should use,
 * instead of the arranger hardcoding one shape for its whole family.
 *
 * Scope: this is a coarse mapping onto the interpreter's three existing
 * `RenderedNode` kinds, not a full DrawingML preset-geometry renderer.
 * Preset names outside the recognised sets fall back to the arranger's own
 * default, so an unmapped preset degrades to the pre-existing behaviour
 * rather than rendering something wrong.
 *
 * @module smartart-layout-shape-preset
 */

import type { PptxSmartArtLayoutNode, PptxSmartArtLayoutNodeShape } from '../types';

export { presetPolygonPoints } from './smartart-layout-shape-polygon';

export type PresetRenderKind = 'rect' | 'circle' | 'polygon';

const CIRCLE_PRESETS = new Set(['ellipse', 'circle', 'donut', 'pie', 'blockArc']);

const POLYGON_PRESETS = new Set([
	'chevron',
	'homePlate',
	'triangle',
	'diamond',
	'trapezoid',
	'nonIsoscelesTrapezoid',
	'hexagon',
	'pentagon',
	'parallelogram',
	'octagon',
]);

/** `roundRect`-family presets: still a rect, but with an adj-driven corner radius. */
const ROUND_RECT_PRESETS = new Set([
	'roundRect',
	'round1Rect',
	'round2SameRect',
	'round2DiagRect',
	'snip1Rect',
	'snip2SameRect',
	'snip2DiagRect',
	'snipRoundRect',
]);

/**
 * Resolve which coarse kind a layoutNode's own `dgm:shape` override should
 * render as. Returns `fallback` (the arranger's hardcoded family default)
 * when the node carries no shape override, or an unrecognised preset name.
 */
export function resolvePresetRenderKind(
	shape: PptxSmartArtLayoutNodeShape | undefined,
	fallback: PresetRenderKind,
): PresetRenderKind {
	const preset = shape?.presetGeometry;
	if (!preset) {
		return fallback;
	}
	if (CIRCLE_PRESETS.has(preset)) {
		return 'circle';
	}
	if (POLYGON_PRESETS.has(preset)) {
		return 'polygon';
	}
	if (ROUND_RECT_PRESETS.has(preset) || preset === 'rect') {
		return 'rect';
	}
	return fallback;
}

/**
 * True for a node that presents a data-model point's own text (a non-empty
 * `dgm:presOf` axis), REGARDLESS of algorithm type. Most such nodes are
 * `alg="tx"`, but "Process Arrows"/"Vertical Arrow List" prove a genuinely
 * `alg="sp"` node can carry `presOf axis="des"` too, when PowerPoint merges a
 * decorative accent shape with a CHILD point's text into one visual (the
 * exact idiom `findCompositeItemShape`'s own module doc describes for the
 * "sp-alg decorative preference" tier below) - excluding `sp` here would wall
 * that idiom's shape out of this, higher-priority tier and regress it back to
 * a merged-vs-per-role KIND that "Process Arrows"'s item-role split code
 * (`smartart-layout-interpreter-item-role-stack.ts`, Track S) does not
 * recognise, collapsing 5 cached boxes to 3 folded ones. A decorative node
 * with NO text of its own (an empty `<dgm:presOf/>`, the common case for a
 * pure background/icon accent) is unaffected either way, since it fails the
 * `axis.length > 0` test regardless of its algorithm.
 */
function isTextRoleNode(node: PptxSmartArtLayoutNode): boolean {
	return (node.presentationOf?.axis?.length ?? 0) > 0;
}

/**
 * Depth-first search through an item template's subtree for the shape a
 * merged per-item COMPOSITE box should carry, when the top-level item
 * itself declares no `dgm:shape` of its own (a bare `composite`/`tx`
 * wrapper - e.g. "Basic Chevron Process"'s item template is a `composite`
 * with no shape, whose CHILDREN are a decorative background node plus
 * separate text sub-nodes).
 *
 * Three candidates are tracked in ONE walk, in priority order:
 *
 * 1. **The first PRESENTED (`presOf` non-empty) node's own VISIBLE shape**
 *    (`isTextRoleNode`; a `dgm:shape` that is not `hideGeom` - a hidden shape
 *    exists only to size text, never to be painted, so it can never be the
 *    merged box's real preset). Measured against "Icon Circle Label List"
 *    and "Meet the Team Card": both wrap a `composite` item template around
 *    TWO decorative `sp`-alg accents with EMPTY `presOf` (a circular
 *    icon/photo backdrop, e.g. `iconBgRect`/`bgPill`, BOTH `ellipse`/
 *    `roundRect`) plus the REAL text role (`textRect`/`nameText`, `alg="tx"`,
 *    `presOf axis="self"`) which declares its OWN, DIFFERENT `dgm:shape
 *    type="rect"` - the cached drawing's merged shape is `rect` (the text
 *    role's own shape), not the decorative accent's `ellipse`/`roundRect`.
 *    Preferring the accent unconditionally (the pre-existing rule below)
 *    mismatched both. Also covers "Basic Chevron Process" (`parTx`, `alg=
 *    "tx"`, `chevron`), "Detailed Process" (`bgRect`, `alg="sp"` but `presOf
 *    axis="self"` - a genuinely presented DECORATIVE node, `roundRect`), and
 *    "Process Arrows" (`childTextVisible`, `alg="sp"` with `presOf
 *    axis="des"`, `rightArrow`/`leftArrow`): an `sp`-alg node CAN carry real
 *    presented text when PowerPoint merges an accent shape with a point's
 *    text into one visual, so `isTextRoleNode` does NOT exclude `sp` by
 *    algorithm type the way `smartart-layout-item-font-role.ts`'s font-role
 *    search does - excluding it here regressed "Process Arrows" from a
 *    correct 5-box per-role split to a folded 3-box merge, because its
 *    per-role split code (`smartart-layout-interpreter-item-role-stack.ts`,
 *    Track S) keys off the MERGED kind this function feeds and only
 *    recognises `rect`(-mapped) kinds, not the `circle` kind `parentText`'s
 *    own (correctly self-presented, but geometrically nested INSIDE the
 *    `rightArrow`, not the item's outer box) `ellipse` would otherwise win.
 * 2. **The first `sp`-alg shape** (a decorative background/accent with EMPTY
 *    `presOf`, e.g. a chevron/round2SameRect/roundRect card). Measured
 *    against "Vertical Action List" (`round2SameRect`) - rule 1 only ever
 *    pre-empts this when a DIFFERENT, presented node's shape disagrees; here
 *    `bgOutline`'s own `presOf` is empty and `parentText`'s self-presented
 *    shape happens to already agree (`round2SameRect` too), so which rule
 *    matches is unobservable, but rule 1 is not guaranteed to fire when
 *    nothing in the subtree is presented at all (a defensive fallback).
 * 3. **The first ANY declared shape** (e.g. a hierarchy item's `rootText`,
 *    `alg="tx"`, which has no separate decorative sibling at all, and whose
 *    own shape is not `hideGeom` either - rule 1 already covers the visible
 *    case, so this only ever adds a `hideGeom` shape back in as an
 *    absolute last resort, keeping the pre-existing "return SOMETHING
 *    rather than the arranger's generic fallback" behaviour for a subtree
 *    where every declared shape happens to be `hideGeom`).
 *
 * `undefined` when nothing in the subtree declares a shape at all.
 *
 * `alg="conn"` nodes are EXCLUDED from every search - measured against
 * "Text Cycle": its `cycle` arranger's children parse in the order `dummy`
 * (`alg="sp"`, no shape), `sibTrans` (`alg="conn"`, `dgm:shape type="conn"` -
 * a transition-point marker, not a real DrawingML preset), THEN `node`
 * (`alg="tx"`, the real `dgm:shape type="rect"`): `dgm:forEach`-wrapped
 * siblings do not always parse back in raw-XML text order, so a plain
 * "first declared shape" walk can reach the connector's marker before the
 * genuine item preset. PowerPoint reconstructs `dsp:cxn` connector shapes
 * separately from the data-model's own connections (see
 * `smartart-interpreter-drawing-bridge.ts`'s module doc comment) and never
 * merges a connector's marker into a per-item box, so `conn` can never
 * legitimately be the answer here.
 *
 * Deliberately does NOT walk past a nested `composite`'s own children when
 * that nested composite already resolved a shape at its own level (early
 * return above for the item passed in), so a genuinely nested per-item
 * composite-of-composites still resolves outside-in.
 */
export function findCompositeItemShape(
	item: PptxSmartArtLayoutNode | undefined,
): PptxSmartArtLayoutNodeShape | undefined {
	if (!item) {
		return undefined;
	}
	if (item.shape?.presetGeometry && item.algorithm?.type !== 'conn') {
		return item.shape;
	}
	let textRoleShape: PptxSmartArtLayoutNodeShape | undefined;
	let decorativeShape: PptxSmartArtLayoutNodeShape | undefined;
	let anyShape: PptxSmartArtLayoutNodeShape | undefined;
	const walk = (node: PptxSmartArtLayoutNode): void => {
		if (node.shape?.presetGeometry && node.algorithm?.type !== 'conn') {
			if (!node.shape.hideGeometry) {
				if (isTextRoleNode(node)) {
					textRoleShape ??= node.shape;
				}
				if (node.algorithm?.type === 'sp' && !decorativeShape) {
					decorativeShape = node.shape;
				}
			}
			anyShape ??= node.shape;
		}
		for (const child of node.children ?? []) {
			walk(child);
		}
	};
	for (const child of item.children ?? []) {
		walk(child);
	}
	return textRoleShape ?? decorativeShape ?? anyShape;
}

/**
 * Resolve a `roundRect`-family preset's corner-radius fraction (0..1 of the
 * shorter side) from its first (`idx=1`) `dgm:adjLst` value, PowerPoint's own
 * default (0.15, matching `rectNode`'s pre-existing hardcoded rx heuristic)
 * when the preset is round-rect-family but carries no adjustment, or
 * `undefined` for a plain `rect`/other preset (no override).
 */
export function presetCornerRadiusFraction(
	shape: PptxSmartArtLayoutNodeShape | undefined,
): number | undefined {
	const preset = shape?.presetGeometry;
	if (!preset || !ROUND_RECT_PRESETS.has(preset)) {
		return undefined;
	}
	const raw = shape?.adjustments?.find((adjustment) => adjustment.index === 1)?.value;
	if (raw === undefined) {
		return 0.15;
	}
	// DrawingML adj values are conventionally 0..1 already in this codebase's
	// typed model (see `smartart-layout-node-shape.ts`), but tolerate a raw
	// 0..100000 guide-unit value some producers still emit for `a:gd`-style
	// adjustments reused verbatim.
	return raw > 1 ? raw / 100000 : raw;
}

/** `1 - cos(45deg)`: how far a corner arc of a given radius pulls the usable text rectangle in from a `roundRect`-family box's own straight edge, on each side (see `roundRectCornerInsetPx`'s doc comment). */
const CORNER_ARC_INSET_FACTOR = 1 - Math.SQRT2 / 2;

/**
 * A `roundRect`-family item's TEXT box is inset from its own straight-edge
 * `w`/`h` by more than `bodyPr`'s margins alone: PowerPoint additionally
 * pulls the usable text rectangle in from each side by the rounded corner's
 * own radius, scaled by `1 - cos(45deg)` (the distance from the straight
 * edge to the 45-degree point of the corner arc) - the geometry that keeps
 * text from being clipped by the curve. Confirmed directly from the cached
 * `dsp:txXfrm` (the real per-shape text frame) against `dsp:spPr`'s own
 * `a:xfrm` (the shape's straight-edge box) across the `lin`/`snake` gallery
 * corpus: every `roundRect`-family item's txXfrm is inset by EXACTLY
 * `presetCornerRadiusFraction(shape) * min(w, h) * CORNER_ARC_INSET_FACTOR`
 * on all four sides (e.g. `basic-process--hier5.pptx`'s 170.75x102.45pt
 * roundRect, adj=10%: radius = 0.10 * 102.45 = 10.245pt, inset = 10.245 *
 * 0.292893 = 3.00pt, matching the cached txXfrm's own 3.00pt inset exactly;
 * reproduced across a dozen other differently-sized roundRect fixtures with
 * zero deviation beyond rounding). A plain `rect` (no corner radius) needs
 * no such inset, confirmed by the SAME corpus showing an EXACT ZERO
 * txXfrm/spPr difference for every `rect`-preset item. Returns 0 for a
 * non-round-rect preset (undefined `presetCornerRadiusFraction`).
 */
export function roundRectCornerInsetPx(
	shape: PptxSmartArtLayoutNodeShape | undefined,
	widthPx: number,
	heightPx: number,
): number {
	const rxFraction = presetCornerRadiusFraction(shape);
	if (rxFraction === undefined) {
		return 0;
	}
	return rxFraction * Math.min(widthPx, heightPx) * CORNER_ARC_INSET_FACTOR;
}
