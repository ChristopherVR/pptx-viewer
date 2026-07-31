import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import {
	getRoundRectRadiusPx,
	getShapeType,
	hasShapeProperties,
	hasTextProperties,
} from 'pptx-viewer-core';
import {
	buildTextBlockStyle,
	getComputedEffectStyle,
	getComputedFillStyle,
	getContainerStyle as sharedGetContainerStyle,
	getCssBorderDashStyle,
	getImageSrc as sharedGetImageSrc,
	getResolvedShapeClipPath,
	suppressesCssBorder,
	px,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';

import { DEFAULT_STROKE_COLOR, DEFAULT_TEXT_COLOR } from '../constants';
import { getComputed3dStyle, merge3dStyle } from './visual-3d';

/**
 * Basic, framework-agnostic style computation for slide elements.
 *
 * This is a deliberately small subset of the React package's sprawling
 * `viewer/utils/*` style layer (getShapeVisualStyle, getTextStyleForElement,
 * renderVectorShape, buildCssGradientFromShapeStyle, image-effects, …). It is
 * enough to faithfully position and paint text boxes, basic preset shapes, and
 * images. Advanced visuals (gradients, custom geometry clip-paths, shadows,
 * 3D, image effects, text warp) are handled by the shared render modules
 * (`pptx-viewer-shared`) consumed from the renderer components.
 */

// The whole text-body style (insets, line height, font, alignment, writing
// mode, autofit) is built by the shared `buildTextBlockStyle`, which React
// renders from too; only the shape/fill cascade below stays local.

/**
 * Absolute container style: position, size, rotation, flip, opacity, z-index.
 * Mirrors the essentials of the React `getContainerStyle`.
 */
export function getContainerStyle(el: PptxElement, zIndex: number): CSSProperties {
	return sharedGetContainerStyle(el, zIndex) as CSSProperties;
}

/**
 * Fill / stroke / corner-radius for shape-like elements. Returns an empty
 * object when the element carries no shape styling.
 *
 * `parentGroupFill` is the enclosing group's fill (`GroupPptxElement.groupFill`),
 * threaded down by the group renderer so a child painted with `a:grpFill`
 * (`fillMode === 'group'`) inherits the group's resolved fill.
 */
export function getShapeFillStrokeStyle(
	el: PptxElement,
	parentGroupFill?: ShapeStyle,
	// When an active `p:animClr` colour animation targets this shape's fill /
	// stroke, drop the static paint so the wrapper's colour keyframes (applied as
	// an `animation` on this same box) own `background-color` / `border-color`.
	// Mirrors React's `getShapeVisualStyle`, which clears the container paint and
	// lets the animated keyframes cascade. Absent/false keeps the static paint.
	animatesFill?: boolean,
	animatesStroke?: boolean,
): CSSProperties {
	if (!hasShapeProperties(el)) {
		return {};
	}
	const ss = el.shapeStyle;
	const style: CSSProperties = {};

	if (ss) {
		// Fill: resolve in React's order via the structured fill builder;
		//   image → structured gradient (falls back to prebuilt `fillGradient`)
		//   → preset pattern → solid (with `fillOpacity`). A `a:grpFill` child
		//   (fillMode 'group') inherits `parentGroupFill`.
		const fill = animatesFill ? undefined : getComputedFillStyle(el, parentGroupFill);
		if (fill) {
			if (fill.backgroundColor !== undefined) {
				style.backgroundColor = fill.backgroundColor;
			}
			if (fill.backgroundImage !== undefined) {
				style.backgroundImage = fill.backgroundImage;
			}
			if (fill.backgroundRepeat !== undefined) {
				style.backgroundRepeat = fill.backgroundRepeat;
			}
			if (fill.backgroundSize !== undefined) {
				style.backgroundSize = fill.backgroundSize;
			}
			// Dropping the position left a gradient `a:tileRect` (and an image
			// fill's placement) pinned at 0 0 even though the matching
			// `background-size` was applied, so PowerPoint's corner-radial preset -
			// a tile twice the shape, hung off its top-left - painted its focal
			// blob on the shape's own corner (issue #132).
			if (fill.backgroundPosition !== undefined) {
				style.backgroundPosition = fill.backgroundPosition;
			}
		}

		// Stroke. A gradient outline is stroked as an SVG path by
		// `ShapeEffectOverlay` (a CSS border takes one colour only), so the border
		// is dropped here rather than drawing the averaged solid underneath it.
		const strokeWidth = suppressesCssBorder(el) ? 0 : Math.max(0, ss.strokeWidth ?? 0);
		if (strokeWidth > 0) {
			if (animatesStroke) {
				// Keep the width / dash; leave the colour to the animated keyframes.
				style.borderWidth = px(strokeWidth);
				style.borderStyle = getCssBorderDashStyle(ss.strokeDash);
			} else {
				style.border = `${px(strokeWidth)} ${getCssBorderDashStyle(ss.strokeDash)} ${ss.strokeColor ?? DEFAULT_STROKE_COLOR}`;
			}
		}
	}

	// Visual effects (outer/inner shadow, glow, soft edges, reflection, DAG
	// blend/opacity). Applied to `style` *before* the geometry cascade so each
	// early `return style` below carries them. Mirrors the React
	// `getShapeVisualStyle` effect layer.
	const fx = getComputedEffectStyle(el);
	if (fx.boxShadow) {
		style.boxShadow = fx.boxShadow;
	}
	if (fx.filter) {
		// Keep the filter verbatim, including any duotone DAG `url(#dag-duotone-<id>)`
		// reference (the only `url(#…)` token `getEffectFilterCss` can emit). The
		// matching SVG <filter> is injected by ElementRenderer's DuotoneFilterDefs
		// so the reference resolves; the remaining CSS filter functions (glow, blur,
		// grayscale, …) apply alongside it.
		style.filter = fx.filter;
	}
	if (fx.webkitBoxReflect) {
		style.WebkitBoxReflect = fx.webkitBoxReflect;
	}
	if (fx.mixBlendMode) {
		style.mixBlendMode = fx.mixBlendMode as CSSProperties['mixBlendMode'];
	}
	if (fx.overflowVisible) {
		// Blur `@grow`: let the halo bleed past the element box instead of being
		// clipped at the shape edge. Mirrors the React `getShapeVisualStyle`.
		style.overflow = 'visible';
	}
	if (fx.opacity !== undefined) {
		// Compose the effect alpha with any element-level opacity (the shape
		// style is merged over the container style, so this would otherwise
		// clobber `getContainerStyle`'s element opacity).
		const elementOpacity = typeof el.opacity === 'number' ? el.opacity : 1;
		style.opacity = elementOpacity * fx.opacity;
	}

	// Shape 3D (scene3d camera/perspective + shape3d extrusion/bevel/material).
	// Also applied before the geometry cascade. `merge3dStyle` comma-joins the
	// extrusion/bevel shadows onto any effect `boxShadow` set above (rather than
	// clobbering) and appends the 3D transform; the element's container
	// rotation/flip transform is composed separately in `ElementRenderer`.
	merge3dStyle(style, getComputed3dStyle(el));

	// Geometry: mirror the React `getShapeVisualStyle` priority cascade:
	// connector → roundRect (radius) → ellipse → clip-path → line → cylinder.
	const normalizedShapeType = getShapeType(el.shapeType);

	if (el.type === 'connector' || normalizedShapeType === 'connector') {
		// Connectors paint as SVG (ConnectorRenderer); the box itself is bare.
		style.backgroundColor = 'transparent';
		style.border = 'none';
		return style;
	}

	if (normalizedShapeType === 'roundRect') {
		const radiusPx = getRoundRectRadiusPx(el);
		if (radiusPx > 0.01) {
			style.borderRadius = px(radiusPx);
		}
		return style;
	}

	if (normalizedShapeType === 'ellipse') {
		style.borderRadius = '9999px';
		return style;
	}

	const clipPath = getResolvedShapeClipPath(el);
	if (clipPath) {
		style.clipPath = clipPath;
		return style;
	}

	if (normalizedShapeType === 'line') {
		// A bare line shape: drop the box fill/border and draw only the top edge.
		const strokeWidth = Math.max(0, el.shapeStyle?.strokeWidth ?? 0);
		style.backgroundColor = 'transparent';
		style.border = 'none';
		style.borderTop = `${px(Math.max(strokeWidth, 2))} ${getCssBorderDashStyle(el.shapeStyle?.strokeDash)} ${el.shapeStyle?.strokeColor ?? DEFAULT_STROKE_COLOR}`;
		return style;
	}

	if (normalizedShapeType === 'cylinder') {
		style.borderRadius = '48% / 12%';
		return style;
	}

	return style;
}

/**
 * Text block style for elements that carry text.
 *
 * A thin adapter over the shared {@link buildTextBlockStyle}, which React
 * renders from too. It used to be a hand-ported copy of React's builder, and
 * the copy had silently lost `a:normAutofit` (a shrink-to-fit title painted 43%
 * too large), `a:bodyPr/@wrap="none"` (a no-wrap line wrapped to three), the
 * default font declaration, the italic padding nudge and the body margin/indent
 * pair. `bodyLayout` adds the flex-column body + `anchor` justification this
 * binding folds into the same element; `pxLengths` is required because Vue's
 * style binding does not unit-suffix bare numbers.
 */
export function getTextBlockStyle(el: PptxElement): CSSProperties {
	if (!hasTextProperties(el)) {
		return {};
	}
	return buildTextBlockStyle(el, {
		fallbackColor: DEFAULT_TEXT_COLOR,
		bodyLayout: true,
		pxLengths: true,
	}) as CSSProperties;
}

/** Resolve a displayable image source for picture/image/media poster frames. */
export function getImageSrc(
	el: PptxElement,
	mediaDataUrls: Map<string, string>,
): string | undefined {
	return sharedGetImageSrc(el, mediaDataUrls);
}
