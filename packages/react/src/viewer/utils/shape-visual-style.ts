import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import {
	getComputedEffectStyle,
	getComputedFillStyle,
	getComputedStrokeStyle,
	getAnimationColorBaseStyle,
	isStrokeOnlyPresetElement,
	resolveShapeGeometry,
} from 'pptx-viewer-shared';
/**
 * Shape visual style computation.
 *
 * Assembles a complete `React.CSSProperties` object for rendering a shape
 * element. Every DECISION in it - fill precedence, gradient tiling, shadows,
 * glow, soft edge, reflection, blend, the `a:ln` border and the geometry
 * cascade - is made by `pptx-viewer-shared` and shared verbatim with the other
 * four bindings; this module only maps those neutral descriptors onto React's
 * style object.
 *
 * It used to be a ~470-line private reimplementation of that pipeline, which had
 * drifted from shared in BOTH directions: React alone rendered `a:ln/@cmpd` and
 * `a:blipFill/a:tile`, and React alone dropped `a:reflection/@stPos`. Routing
 * both ways through shared is what ended that.
 */
import type React from 'react';

import { apply3dEffects } from './shape-visual-3d';

/**
 * Whether React paints this element as a freeform SVG `<path>`
 * (`renderVectorShape`) rather than as a styled box.
 *
 * This is a VIEW-layer fact, not a property of the OOXML, which is why it is the
 * one piece of the cascade that stays in the binding: the `<path>` already
 * carries the fill and the stroke, so painting them a second time as a
 * `backgroundColor` / `border` on the rectangular container floods the shape's
 * whole bounding box - a thin balloon crescent reads as a solid rectangle.
 * (Presets keep their container fill because a `clipPath` constrains it to the
 * shape outline.)
 */
function rendersCustomVectorPath(element: PptxElement): boolean {
	return (
		(element.type === 'shape' || element.type === 'image' || element.type === 'picture') &&
		Boolean(element.pathData) &&
		typeof element.pathWidth === 'number' &&
		element.pathWidth > 0 &&
		typeof element.pathHeight === 'number' &&
		element.pathHeight > 0
	);
}

/**
 * Computes the full CSS style object for rendering a PPTX shape element.
 *
 * The returned style handles:
 * - **Fill**: solid colour with opacity, CSS gradients (including `@flip` /
 *   `a:tileRect` tiling), pattern SVG backgrounds, image fills, `a:grpFill`
 * - **Stroke**: border width/colour/dash, compound (`a:ln/@cmpd`) lines
 * - **Shadows**: outer, inner, multi-layer, glow, and the line-level `a:ln` shadow
 * - **Glow & soft-edge**: CSS filter drop-shadow and the alpha-feather `<filter>`
 * - **DAG effects**: grayscale, bi-level, brightness/contrast, hue/saturation, tint, duotone
 * - **3-D**: perspective transforms, extrusion depth, bevel highlights
 * - **Reflection**: NOT included here - see `ReflectionOverlay`, which renders
 *   a cross-browser mirrored sibling from shared's `getReflectionWrapperStyle`
 * - **Shape geometry**: clip-path polygons, border-radius for ellipses and round-rects
 *
 * @param element - The PPTX element to style.
 * @param _hasFill - Unused; the fill decision (including "is there one") is made
 *   by shared `getComputedFillStyle`. Kept so the call sites and their tests keep
 *   their historical signature.
 * @param fillColor - Resolved fill colour (hex), used only as the 3-D
 *   extrusion/contour default when the shape declares no explicit colour.
 * @param _strokeWidth - Unused; shared `getComputedStrokeStyle` resolves the
 *   painted width itself (a width-only fill-less `a:ln` paints nothing).
 * @param _strokeColor - Unused; as above.
 * @param animatesFill - When an active `p:animClr` targets the shape fill, drop
 *   the static container fill so the wrapper's animated `background-color` /
 *   `fill` keyframes own the paint. Absent/false keeps the static fill.
 * @param animatesStroke - As `animatesFill`, but for the container stroke
 *   (`border-color`).
 * @param parentGroupFill - The enclosing group's fill, for a child painted with
 *   `a:grpFill` (`fillMode === 'group'`).
 * @returns A `React.CSSProperties` object ready to apply to the shape container.
 */
export function getShapeVisualStyle(
	element: PptxElement,
	_hasFill: boolean,
	fillColor: string,
	_strokeWidth: number,
	_strokeColor: string,
	animatesFill?: boolean,
	animatesStroke?: boolean,
	parentGroupFill?: ShapeStyle,
): React.CSSProperties {
	if (!hasShapeProperties(element)) {
		return {};
	}
	const ss = element.shapeStyle;
	// Fill: image -> structured gradient -> preset pattern -> solid, with
	// `a:gradFill/@flip` + `a:tileRect` applied to the background BOX and
	// `a:grpFill` inheritance resolved in this child's own box.
	const fill = animatesFill ? undefined : getComputedFillStyle(element, parentGroupFill);
	// Shadows / glow / soft edge / blur / reflection / DAG blend + alpha.
	const fx = getComputedEffectStyle(element);
	// `a:ln` -> border width, style (compound lines become `double`), colour, plus
	// the inherited SVG join / cap / miter-limit presentation properties.
	const stroke = getComputedStrokeStyle(element);

	const base: React.CSSProperties = {
		// A gradient fill REPLACES the solid fill, it does not sit on top of it;
		// the whole precedence lives in shared's `getComputedFillStyle`.
		backgroundColor: fill?.backgroundColor ?? 'transparent',
		backgroundImage: fill?.backgroundImage,
		backgroundRepeat: fill?.backgroundRepeat,
		backgroundSize: fill?.backgroundSize,
		backgroundPosition: fill?.backgroundPosition,
		// The container always carries `box-sizing: border-box`, so the default
		// `background-origin: padding-box` would size the paint 2px smaller than
		// the shape and make a gradient tile wrap, painting a 1px sliver of its
		// opposite end along the edge. Paint from the border box instead.
		backgroundOrigin: 'border-box',
		boxShadow: fx.boxShadow,
		// Reflection is no longer a single CSS property (`-webkit-box-reflect`
		// never worked in Firefox): `ElementRenderer` renders a mirrored sibling
		// node instead, using shared's `getReflectionWrapperStyle` directly (see
		// `ReflectionOverlay`).
		filter: fx.filter,
		opacity: fx.opacity,
		// Only proxy the DAG blend onto the whole element for the blend-only case:
		// with an overlay colour, `ShapeEffectOverlay` paints a separate blended
		// tint layer (shared decides which, and returns only one of the two).
		mixBlendMode: fx.mixBlendMode as React.CSSProperties['mixBlendMode'],
		// An unstroked element must occupy EXACTLY its authored box, so the
		// selection/hover affordance is an `outline` (see `ElementRenderer`) and
		// the border collapses to 0 rather than to a transparent 1px.
		borderWidth: stroke.borderWidth,
		borderColor: animatesStroke ? undefined : stroke.borderColor,
		borderStyle: stroke.borderStyle,
		// Inherited SVG presentation properties: written on the container so the
		// freeform `<path>` and the stroke overlay both pick them up.
		strokeLinejoin: stroke.strokeLinejoin,
		strokeMiterlimit: stroke.strokeMiterlimit,
		strokeLinecap: stroke.strokeLinecap,
	};
	Object.assign(
		base,
		getAnimationColorBaseStyle(element, {
			animatesFill,
			animatesStroke,
			parentGroupFill,
		}),
	);

	// ── 3D effects (perspective + rotation + extrusion/bevel) ──
	// Pass the resolved fill colour so extrusion/contour default to it when no
	// explicit extrusion colour is set.
	apply3dEffects(base, ss?.scene3d, ss?.shape3d, ss?.fillColor ?? fillColor);

	// The SVG `<path>` owns the fill/stroke for freeform geometry; keep effects
	// (shadow, glow, opacity, blend) on the container but drop the rectangular
	// fill and border that would otherwise flood the bounding box.
	if (rendersCustomVectorPath(element) || isStrokeOnlyPresetElement(element)) {
		base.backgroundColor = 'transparent';
		base.backgroundImage = undefined;
		base.borderWidth = undefined;
		base.borderColor = undefined;
		base.borderStyle = undefined;
	}

	// A `p:animClr` colour animation drives the wrapper's `background-color` /
	// `border-color` keyframes; the static paint is already dropped above, this
	// only clears the background image the fill could not carry.
	if (animatesFill) {
		base.backgroundColor = undefined;
		base.backgroundImage = undefined;
	}

	// Geometry: the branch ORDER and every threshold live in shared
	// `resolveShapeGeometry` (connector -> stroke-only -> roundRect -> ellipse ->
	// clip-path -> line -> cylinder), so this binding only maps the decision onto
	// its own style object. Keeping the cascade in one place is what stops the
	// five copies drifting.
	const geometry = resolveShapeGeometry(element);
	switch (geometry.kind) {
		case 'bare':
			return { backgroundColor: 'transparent', borderWidth: 0, borderStyle: 'none' };
		case 'strokeOnly':
			// An open preset has no region to fill and no box to outline:
			// `ShapeEffectOverlay` strokes the evaluated geometry. The clip in
			// particular encloses zero area and would clip that overlay away.
			return { ...base, backgroundColor: 'transparent', backgroundImage: undefined };
		case 'borderRadius':
			return { ...base, borderRadius: geometry.radius };
		case 'clipPath':
			return { ...base, clipPath: geometry.clipPath };
		case 'lineEdge':
			// A `line` whose geometry the evaluator cannot open (custom geometry)
			// still needs the one-edge border approximation.
			return {
				...base,
				backgroundColor: 'transparent',
				borderWidth: 0,
				borderTopWidth: geometry.strokeWidth,
				borderTopColor: stroke.borderColor,
				borderTopStyle: (stroke.borderStyle ?? 'solid') as React.CSSProperties['borderTopStyle'],
			};
		default:
			return base;
	}
}
