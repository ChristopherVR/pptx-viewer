import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { CssStyleMap } from 'pptx-viewer-shared';
import {
	DEFAULT_STROKE_COLOR,
	getComputed3dStyle,
	getComputedEffectStyle,
	getComputedFillStyle,
	paintedStrokeWidth,
	suppressesCssBorder,
	getContainerStyle as sharedGetContainerStyle,
	getCssBorderDashStyle,
	getImageSrc as sharedGetImageSrc,
	isHollowShapeElement,
	resolveShapeGeometry,
	px,
} from 'pptx-viewer-shared';

import { merge3dStyle } from './merge-3d';

/**
 * Element style computation for the Svelte binding. Port of the Vue
 * `element-style` composable: everything non-trivial (fill resolution,
 * effects, 3D, clip paths) is delegated to `pptx-viewer-shared`; this module
 * only assembles the pieces into neutral style maps.
 */

/** Absolute container style: position, size, rotation, flip, opacity, z-index. */
export function getContainerStyle(el: PptxElement, zIndex: number): CssStyleMap {
	return sharedGetContainerStyle(el, zIndex);
}

/**
 * Fill / stroke / effects / geometry for shape-like elements. Returns an
 * empty map when the element carries no shape styling. Mirrors the Vue
 * binding's `getShapeFillStrokeStyle` (itself a port of React's
 * `getShapeVisualStyle` priority cascade).
 */
export function getShapeFillStrokeStyle(
	el: PptxElement,
	parentGroupFill?: ShapeStyle,
	// When an active `p:animClr` colour animation targets this shape's fill /
	// stroke, drop the static paint so the wrapper's colour keyframes (applied as
	// an `animation` on this same box) own `background-color` / `border-color`.
	// Mirrors React's / Vue's shape-style resolver. Absent/false keeps the paint.
	animatesFill?: boolean,
	animatesStroke?: boolean,
): CssStyleMap {
	if (!hasShapeProperties(el)) {
		return {};
	}
	const ss = el.shapeStyle;
	const style: CssStyleMap = {};

	if (ss) {
		// Fill: image -> structured gradient -> preset pattern -> solid. A child
		// painted with `a:grpFill` (fillMode 'group') inherits `parentGroupFill`.
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
			// Without the position a gradient `a:tileRect` (and an image fill's
			// placement) stayed pinned at 0 0 while its `background-size` was
			// applied, so an oversized tile painted the wrong region (issue #132).
			if (fill.backgroundPosition !== undefined) {
				style.backgroundPosition = fill.backgroundPosition;
			}
		}

		// A gradient outline is stroked as an SVG path by `ShapeEffectOverlay` (a
		// CSS border takes one colour only), so drop the border rather than
		// drawing the averaged solid underneath it.
		// `paintedStrokeWidth`: a width-only fill-less <a:ln> paints NO outline
		// (PowerPoint ground truth; see shared stroke-paint).
		const strokeWidth = suppressesCssBorder(el) ? 0 : paintedStrokeWidth(ss);
		if (strokeWidth > 0) {
			if (animatesStroke) {
				// Keep the width / dash; leave the colour to the animated keyframes.
				style.borderWidth = px(strokeWidth);
				style.borderStyle = getCssBorderDashStyle(ss.strokeDash) ?? 'solid';
			} else {
				style.border = `${px(strokeWidth)} ${getCssBorderDashStyle(ss.strokeDash)} ${
					ss.strokeColor ?? DEFAULT_STROKE_COLOR
				}`;
			}
		}
	}

	// Visual effects (shadow, glow, soft edges, reflection, blend/opacity),
	// applied before the geometry cascade so every early return carries them.
	const fx = getComputedEffectStyle(el);
	if (fx.boxShadow) {
		style.boxShadow = fx.boxShadow;
	}
	if (fx.filter) {
		style.filter = fx.filter;
	}
	if (fx.webkitBoxReflect) {
		style.WebkitBoxReflect = fx.webkitBoxReflect;
	}
	if (fx.mixBlendMode) {
		style.mixBlendMode = fx.mixBlendMode;
	}
	if (fx.opacity !== undefined) {
		// Compose the effect alpha with any element-level opacity (this map is
		// merged over the container style, so it would otherwise clobber it).
		const elementOpacity = typeof el.opacity === 'number' ? el.opacity : 1;
		style.opacity = elementOpacity * fx.opacity;
	}
	if (fx.overflowVisible) {
		// Blur `@grow`: let the halo bleed past the element box instead of
		// clipping it at the shape bounds.
		style.overflow = 'visible';
	}

	// Shape 3D (scene3d camera + shape3d extrusion/bevel/material).
	merge3dStyle(style, getComputed3dStyle(el));

	// Geometry priority cascade:
	// connector -> roundRect -> ellipse -> clip-path -> line -> cylinder.
	// An unfilled, textless shape is a FRAME: PowerPoint hit-tests it on its
	// outline only, so its interior must not swallow clicks meant for what it is
	// drawn over. ShapeEffectOverlay paints a transparent pointer-events:stroke
	// band that opts the outline back in.
	if (isHollowShapeElement(el)) {
		style.pointerEvents = 'none';
	}

	// Geometry: the branch ORDER and every threshold live in shared
	// `resolveShapeGeometry`, so this binding only maps the decision onto its
	// own style map. Keeping the cascade in one place is what stops the copies
	// drifting - Angular's had, four separate ways.
	const geometry = resolveShapeGeometry(el);
	switch (geometry.kind) {
		case 'bare':
			style.backgroundColor = 'transparent';
			style.border = 'none';
			return style;
		case 'strokeOnly':
			// An open preset has no region to fill and no box to outline:
			// `ShapeEffectOverlay` strokes the evaluated geometry. The clip in
			// particular encloses zero area and would clip that overlay away.
			style.backgroundColor = 'transparent';
			delete style.backgroundImage;
			style.border = 'none';
			return style;
		case 'borderRadius':
			style.borderRadius = geometry.radius;
			return style;
		case 'clipPath':
			style.clipPath = geometry.clipPath;
			return style;
		case 'lineEdge':
			style.backgroundColor = 'transparent';
			style.border = 'none';
			style.borderTop = `${px(geometry.strokeWidth)} ${getCssBorderDashStyle(
				el.shapeStyle?.strokeDash,
			)} ${el.shapeStyle?.strokeColor ?? DEFAULT_STROKE_COLOR}`;
			return style;
		default:
			return style;
	}
}

/**
 * Merge container + shape styles for a shape box, composing the container's
 * rotation/flip transform with any 3D transform from the shape style instead
 * of letting the spread clobber it. Mirrors Vue's `shapeDivStyle`.
 */
export function getShapeBoxStyle(
	el: PptxElement,
	zIndex: number,
	parentGroupFill?: ShapeStyle,
	animatesFill?: boolean,
	animatesStroke?: boolean,
): CssStyleMap {
	const container = getContainerStyle(el, zIndex);
	const shape = getShapeFillStrokeStyle(el, parentGroupFill, animatesFill, animatesStroke);
	const merged: CssStyleMap = { ...container, ...shape };
	if (container.transform && shape.transform) {
		merged.transform = `${String(container.transform)} ${String(shape.transform)}`;
	}
	return merged;
}

/** Resolve a displayable image source for picture/image/media poster frames. */
export function getImageSrc(
	el: PptxElement,
	mediaDataUrls: Map<string, string>,
): string | undefined {
	return sharedGetImageSrc(el, mediaDataUrls);
}
