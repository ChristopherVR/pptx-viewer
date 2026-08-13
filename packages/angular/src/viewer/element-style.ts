import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

import {
	DEFAULT_STROKE_COLOR,
	DEFAULT_TEXT_COLOR,
	buildTextBlockStyle,
	getComputed3dStyle,
	getComputedEffectStyle,
	getComputedFillStyle,
	getComputedStrokeStyle,
	getCssBorderDashStyle,
	resolveShapeGeometry,
	getContainerStyle as sharedGetContainerStyle,
	getImageSrc as sharedGetImageSrc,
	px,
} from '../internal/shared';
import { buildDuotoneFilter } from './duotone-filter';
import type { DuotoneFilterDef } from './duotone-filter';
import { getSoftEdgeFilterDef, resolveShapeFilterCss } from './element-effect-defs';
import { merge3dStyleMap } from './merge-3d';
import { isHollowShapeElement } from './shape-geometry';
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

		// Stroke: the WHOLE outline decision (`a:ln`) is shared's, so this binding
		// only maps the descriptor onto its style map.
		//
		// The local two-liner this replaces resolved the dash with its own
		// `dot|sysDot ? 'dotted' : 'dashed'` ternary, which ignored `a:ln/@cmpd`
		// (`grep compoundLine packages/angular/src` returned nothing), and it read
		// `strokeColor` raw, so `strokeOpacity` and `a:miter/@lim` never reached
		// the DOM either. `getComputedStrokeStyle` also owns the two suppression
		// rules that used to be spelled out here: a width-only fill-less `<a:ln>`
		// paints no outline, and a gradient / pattern line (or an open preset) is
		// painted by the stroke overlay instead of a CSS border.
		const stroke = getComputedStrokeStyle(el);
		if (stroke.borderWidth > 0) {
			if (animatesStroke) {
				// Keep the width / style; leave the colour to the animated keyframes.
				style['border-width'] = px(stroke.borderWidth);
				style['border-style'] = stroke.borderStyle ?? 'solid';
			} else if (stroke.border) {
				style['border'] = stroke.border;
			}
		}
		// Inherited SVG presentation properties: writing them on the shape
		// container is what makes the freeform `<path>` and the stroke overlay
		// honour them without either restating it (mirrors React).
		if (stroke.strokeLinejoin) {
			style['stroke-linejoin'] = stroke.strokeLinejoin;
		}
		if (stroke.strokeLinecap) {
			style['stroke-linecap'] = stroke.strokeLinecap;
		}
		if (stroke.strokeMiterlimit !== undefined) {
			style['stroke-miterlimit'] = stroke.strokeMiterlimit;
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

	// Shape 3D (`a:spPr/a:scene3d` camera + `a:spPr/a:sp3d` extrusion / bevel /
	// material), applied before the geometry cascade so every early return below
	// carries it. `merge3dStyleMap` comma-joins the extrusion / bevel shadows
	// onto the effect `box-shadow` set above instead of clobbering it, and
	// APPENDS the 3D transform (the element's rotation / flip transform comes
	// from `getContainerStyle` and is composed by the renderer, which must not
	// let this one overwrite it).
	merge3dStyleMap(style, getComputed3dStyle(el));

	// An unfilled, textless shape is a FRAME: PowerPoint hit-tests it on its
	// outline only, so its interior must not swallow clicks meant for what it is
	// drawn over. ShapeEffectOverlay paints a transparent pointer-events:stroke
	// band that opts the outline back in.
	if (isHollowShapeElement(el)) {
		style['pointer-events'] = 'none';
	}

	// Geometry: the branch ORDER and every threshold live in shared
	// `resolveShapeGeometry`, so this binding only maps the decision onto its
	// kebab-case style map. Angular's own copy of the cascade had drifted four
	// ways: it compared `shapeType` raw so `oval` and any capitalised spelling
	// missed the ellipse branch, it had no connector or cylinder branch at all,
	// and it rounded `roundRect` by a hardcoded 10% of the short side instead of
	// the authored `a:avLst/adj` (the spec default alone is ~16.7%).
	const geometry = resolveShapeGeometry(el);
	switch (geometry.kind) {
		case 'bare':
			style['background-color'] = 'transparent';
			style['border'] = 'none';
			return style;
		case 'strokeOnly':
			// An open preset has no region to fill and no box to outline: the
			// renderer strokes the evaluated geometry from `buildStrokeOutline`.
			// The clip in particular encloses zero area for an open path and would
			// clip that overlay away entirely.
			style['background-color'] = 'transparent';
			delete style['background-image'];
			style['border'] = 'none';
			return style;
		case 'borderRadius':
			style['border-radius'] = geometry.radius;
			return style;
		case 'clipPath':
			style['clip-path'] = geometry.clipPath;
			return style;
		case 'lineEdge':
			style['background-color'] = 'transparent';
			style['border'] = 'none';
			// A `line` preset draws one edge, so the compound type decides its
			// style here too (`border-style: double` paints the parallel strands).
			style['border-top'] = `${px(geometry.strokeWidth)} ${getCssBorderDashStyle(
				el.shapeStyle?.strokeDash,
				el.shapeStyle?.compoundLine,
			)} ${el.shapeStyle?.strokeColor ?? DEFAULT_STROKE_COLOR}`;
			return style;
		default:
			return style;
	}
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
