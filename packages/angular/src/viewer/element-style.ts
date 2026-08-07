import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

import {
	DEFAULT_STROKE_COLOR,
	DEFAULT_TEXT_COLOR,
	buildTextBlockStyle,
	getComputedEffectStyle,
	getComputedFillStyle,
	paintedStrokeWidth,
	isStrokeOnlyPresetElement,
	suppressesCssBorder,
	getContainerStyle as sharedGetContainerStyle,
	getImageSrc as sharedGetImageSrc,
	px,
} from '../internal/shared';
import { buildDuotoneFilter } from './duotone-filter';
import type { DuotoneFilterDef } from './duotone-filter';
import { getSoftEdgeFilterDef, resolveShapeFilterCss } from './element-effect-defs';
import {
	getResolvedShapeClipPath,
	isHollowShapeElement,
	isIdentityRectClip,
} from './shape-geometry';
import { cssObjectToStyleMap } from './table-renderer-helpers';

/**
 * Basic, framework-agnostic style computation for slide elements, returning
 * `[ngStyle]`-compatible maps.
 *
 * This mirrors the Vue package's `element-style.ts` (and a deliberately small
 * subset of the React `viewer/utils/*` style layer). It is enough to position
 * and paint text boxes, basic preset shapes, images, and image/gradient fills
 * (the latter via the parser's prebuilt CSS gradient string). Advanced visuals
 * (the structured gradient builder, pattern fills, custom geometry clip-paths,
 * shadows, 3D, image effects, text warp) are handled by the shared render
 * modules (`pptx-viewer-shared`) consumed from the renderer components.
 *
 * Long term the *logic* here is a shared-extraction candidate; only the
 * return type (CSS map shape) differs per framework, so a future refactor
 * could hoist a neutral core into `pptx-viewer-shared`.
 */

/**
 * Resolve the duotone SVG `<filter>` descriptor for an element, or `undefined`
 * when it carries no duotone image effect. The renderer pairs this with the
 * `filter: url(#…)` set in {@link getShapeFillStrokeStyle} by injecting the
 * matching `<filter>` def into a hidden `<defs>` block.
 */
export function getDuotoneFilterDef(el: PptxElement): DuotoneFilterDef | undefined {
	return buildDuotoneFilter(el);
}

/** `[ngStyle]`-compatible style map. */
export type StyleMap = Record<string, string | number>;

/**
 * Absolute container style: position, size, rotation, flip, opacity, z-index.
 * Mirrors the essentials of the React `getContainerStyle`.
 */
export function getContainerStyle(el: PptxElement, zIndex: number): StyleMap {
	return sharedGetContainerStyle(el, zIndex);
}

/**
 * Fill / stroke / corner-radius for shape-like elements. Returns an empty
 * object when the element carries no shape styling.
 *
 * `animatesFill` / `animatesStroke` come from an active `p:animClr` colour
 * animation during presentation playback: when set, the static paint is dropped
 * so the wrapper's colour keyframes (applied as an `animation` on this same box)
 * own `background-color` / `border-color`. Mirrors the Vue port's
 * `getShapeFillStrokeStyle` and React's `getShapeVisualStyle`. Absent/false
 * keeps the static paint, so editor / read-only rendering is unaffected.
 */
export function getShapeFillStrokeStyle(
	el: PptxElement,
	parentGroupFill?: ShapeStyle,
	animatesFill?: boolean,
	animatesStroke?: boolean,
): StyleMap {
	if (!hasShapeProperties(el)) {
		return {};
	}
	const ss = el.shapeStyle;
	const style: StyleMap = {};

	if (ss) {
		// Fill: resolved entirely by the shared builder, in React's order
		//   image → structured gradient (falling back to the parser's prebuilt
		//   `fillGradient` string) → preset pattern → solid colour WITH
		//   `fillOpacity` applied. A `a:grpFill` child (fillMode 'group') inherits
		//   `parentGroupFill`, painted in this child's own box.
		//
		// This deliberately delegates instead of re-deriving the cascade locally:
		// the local copy dropped `ss.fillOpacity`, so a shape authored
		// `<a:solidFill><a:schemeClr …><a:alpha val="0"/></a:schemeClr></a:solidFill>`
		// (a fully TRANSPARENT overlay, common over a full-bleed background video)
		// painted as an opaque block of colour and hid everything beneath it.
		// Skipped entirely while a `p:animClr` fill animation owns the colour.
		const fill = animatesFill ? undefined : getComputedFillStyle(el, parentGroupFill);
		if (fill) {
			if (fill.backgroundColor !== undefined) {
				style['background-color'] = fill.backgroundColor;
			}
			if (fill.backgroundImage !== undefined) {
				style['background-image'] = fill.backgroundImage;
			}
			if (fill.backgroundRepeat !== undefined) {
				style['background-repeat'] = fill.backgroundRepeat;
			}
			if (fill.backgroundSize !== undefined) {
				style['background-size'] = fill.backgroundSize;
			}
			if (fill.backgroundPosition !== undefined) {
				style['background-position'] = fill.backgroundPosition;
			}
		}

		// Stroke.
		// A gradient outline is stroked as an SVG path by the renderer (a CSS border
		// takes one colour only), so drop the border rather than drawing the
		// averaged solid underneath it.
		// `paintedStrokeWidth`: a width-only fill-less <a:ln> paints NO outline
		// (PowerPoint ground truth; see shared stroke-paint).
		const strokeWidth = suppressesCssBorder(el) ? 0 : paintedStrokeWidth(ss);
		if (strokeWidth > 0) {
			const dash =
				ss.strokeDash && ss.strokeDash !== 'solid'
					? ss.strokeDash === 'dot' || ss.strokeDash === 'sysDot'
						? 'dotted'
						: 'dashed'
					: 'solid';
			if (animatesStroke) {
				// Keep the width / dash; leave the colour to the animated keyframes.
				style['border-width'] = px(strokeWidth);
				style['border-style'] = dash;
			} else {
				style['border'] = `${px(strokeWidth)} ${dash} ${ss.strokeColor ?? DEFAULT_STROKE_COLOR}`;
			}
		}
	}

	// Visual effects (outer/inner/glow shadows, blur/soft-edge filters,
	// reflection, blend mode, effect-DAG alpha). Applied to every return path
	// below. Mirrors the Vue port's `getComputedEffectStyle` integration. The
	// duotone DAG `url(#…)` reference is kept only when the matching SVG
	// <filter> def is actually rendered (i.e. the element has a duotone effect;
	// the renderer injects the def); otherwise the dangling ref is stripped.
	const duotone = buildDuotoneFilter(el);
	// The soft-edge feather `<filter>` def is injected by the renderer, so its
	// `url(#soft-edge-<id>)` reference must survive the dangling-ref strip.
	const softEdge = getSoftEdgeFilterDef(el);
	const fx = getComputedEffectStyle(el);
	if (fx.boxShadow) {
		style['box-shadow'] = fx.boxShadow;
	}
	const filterCss = resolveShapeFilterCss(fx.filter, duotone, softEdge);
	if (filterCss) {
		style['filter'] = filterCss;
	}
	if (fx.webkitBoxReflect) {
		style['-webkit-box-reflect'] = fx.webkitBoxReflect;
	}
	if (fx.mixBlendMode) {
		style['mix-blend-mode'] = fx.mixBlendMode;
	}
	// Blur `@grow`: let the halo bleed past the element box instead of clipping.
	if (fx.overflowVisible) {
		style['overflow'] = 'visible';
	}
	if (fx.opacity !== undefined) {
		const elementOpacity = typeof el.opacity === 'number' ? el.opacity : 1;
		style['opacity'] = elementOpacity * fx.opacity;
	}

	// Stroke-only ("open") presets - `line`, `arc`, the connector family - have
	// no region to fill and no box to outline: the renderer strokes the evaluated
	// geometry from shared `buildStrokeOutline`. The container keeps its effects
	// but drops the fill, the border and the clip-path; the clip in particular
	// encloses zero area for an open path and would clip the overlay away
	// entirely. (Angular boxed these in all four borders, so a `line` rendered as
	// a rectangle outline.)
	if (isStrokeOnlyPresetElement(el)) {
		style['background-color'] = 'transparent';
		delete style['background-image'];
		style['border'] = 'none';
		return style;
	}

	// Geometry. ellipse / roundRect get cheap `border-radius` approximations;
	// every other preset geometry falls back to an SVG `clip-path` derived from
	// the core geometry engine (mirrors the Vue port's cascade). Plain
	// rectangles resolve to `undefined` and stay unclipped.
	// An unfilled, textless shape is a FRAME: PowerPoint hit-tests it on its
	// outline only, so its interior must not swallow clicks meant for what it is
	// drawn over. ShapeEffectOverlay paints a transparent pointer-events:stroke
	// band that opts the outline back in.
	if (isHollowShapeElement(el)) {
		style['pointer-events'] = 'none';
	}

	const shapeType = 'shapeType' in el ? el.shapeType : undefined;
	if (shapeType === 'ellipse' || shapeType === 'circle') {
		style['border-radius'] = '50%';
		return style;
	}
	if (shapeType === 'roundRect') {
		style['border-radius'] = px(Math.min(el.width, el.height) * 0.1);
		return style;
	}

	// A rect preset's clip is its own box: skip it so overflowing text spills
	// visibly (as PowerPoint does) instead of being sliced.
	const clipPath = isIdentityRectClip(el) ? undefined : getResolvedShapeClipPath(el);
	if (clipPath) {
		style['clip-path'] = clipPath;
	}

	return style;
}

/**
 * Text block style for elements that carry text.
 *
 * A thin adapter over the shared {@link buildTextBlockStyle}, which React
 * renders from too. This used to be a hand-ported copy of React's builder, and
 * the copy had silently lost `a:normAutofit` (a shrink-to-fit title painted 43%
 * too large), `a:bodyPr/@wrap="none"` (a no-wrap line wrapped to three), the
 * default font declaration, the italic padding nudge and the body
 * margin/indent pair.
 *
 * The shared record is camelCase; `[ngStyle]` maps elsewhere in this binding
 * are kebab-case, so it is converted rather than mixing both conventions in one
 * merged map (`warpedTextStyle` merges this with the 3D scene style).
 */
export function getTextBlockStyle(el: PptxElement): StyleMap {
	if (!hasTextProperties(el)) {
		return {};
	}
	return cssObjectToStyleMap(
		buildTextBlockStyle(el, {
			fallbackColor: DEFAULT_TEXT_COLOR,
			bodyLayout: true,
			pxLengths: true,
		}),
	);
}

/** Resolve a displayable image source for picture/image/media poster frames. */
export function getImageSrc(
	el: PptxElement,
	mediaDataUrls: Map<string, string>,
): string | undefined {
	return sharedGetImageSrc(el, mediaDataUrls);
}
