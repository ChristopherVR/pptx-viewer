import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type { Computed3dStyle, CssStyleMap } from 'pptx-viewer-shared';
import {
	DEFAULT_STROKE_COLOR,
	DEFAULT_TEXT_COLOR,
	buildTextBlockStyle,
	buildTextBody3DSceneStyle,
	getComputed3dStyle,
	getComputedEffectStyle,
	getComputedFillStyle,
	getComputedStrokeStyle,
	getCssBorderDashStyle,
	isHollowShapeElement,
	resolveShapeGeometry,
	px,
} from 'pptx-viewer-shared';

import { composeTransforms } from './dom';

/**
 * Fill / stroke / geometry and text-block style builders for the vanilla
 * binding.
 *
 * These are the per-binding pieces that `pptx-viewer-shared` intentionally
 * leaves to each binding (see the note in shared `render/element-style.ts`);
 * this file is the vanilla port of the Vue binding's `element-style.ts`,
 * delegating every pure computation (fills, effects, clip paths, 3D, text
 * direction, line height) to the shared helpers.
 */

/**
 * Merge a shared {@link Computed3dStyle} into a style map, COMBINING
 * shadows/filters/backgrounds rather than overwriting (vanilla port of the
 * Vue `merge3dStyle` adapter).
 */
function merge3dStyle(base: CssStyleMap, computed: Computed3dStyle | undefined): void {
	if (!computed) {
		return;
	}
	const shadows = [base['boxShadow'], computed.extrusionBoxShadow, computed.boxShadow]
		.filter((s) => s !== undefined && s !== '')
		.map(String);
	if (shadows.length > 0) {
		base['boxShadow'] = shadows.join(', ');
	}
	if (computed.transform) {
		base['transform'] = base['transform']
			? `${String(base['transform'])} ${computed.transform}`
			: computed.transform;
	}
	if (computed.perspective) {
		base['perspective'] = computed.perspective;
	}
	if (computed.perspectiveOrigin) {
		base['perspectiveOrigin'] = computed.perspectiveOrigin;
	}
	if (computed.transformOrigin) {
		base['transformOrigin'] = computed.transformOrigin;
	}
	if (computed.transformStyle) {
		base['transformStyle'] = computed.transformStyle;
	}
	if (computed.willChange) {
		base['willChange'] = computed.willChange;
	}
	if (computed.filter) {
		base['filter'] = base['filter']
			? `${String(base['filter'])} ${computed.filter}`
			: computed.filter;
	}
	if (computed.backgroundImage) {
		base['backgroundImage'] = base['backgroundImage']
			? `${computed.backgroundImage}, ${String(base['backgroundImage'])}`
			: computed.backgroundImage;
	}
	if (computed.background && base['background'] === undefined) {
		base['background'] = computed.background;
	}
	if (computed.opacity !== undefined && base['opacity'] === undefined) {
		base['opacity'] = computed.opacity;
	}
}

/**
 * Fill / stroke / effects / 3D / corner geometry for shape-like elements.
 * Returns an empty map when the element carries no shape styling. Mirrors the
 * Vue binding's `getShapeFillStrokeStyle` cascade.
 */
export function getShapeFillStrokeStyle(
	el: PptxElement,
	// When an active `p:animClr` colour animation targets this shape's fill /
	// stroke, drop the static paint so the wrapper's colour keyframes own it
	// (mirrors Vue's `getShapeFillStrokeStyle`). Absent/false keeps static paint.
	animatesFill?: boolean,
	animatesStroke?: boolean,
): CssStyleMap {
	if (el.type === 'group') {
		// A group has no fill/stroke/geometry of its own (the branches below all
		// read `el.shapeStyle`, which a group never has), but PowerPoint still
		// lets `p:grpSpPr/a:effectLst` carry a shadow/glow/soft-edge for the
		// group's own COMPOSITE raster (see shared `getComputedEffectStyle`).
		// Reflection rides a separate mirrored sibling node (`renderReflectionOverlay`),
		// same as a shape, so only the container-level `filter` / `overflow`
		// belong here.
		const fx = getComputedEffectStyle(el);
		const groupStyle: CssStyleMap = {};
		if (fx.filter) {
			groupStyle.filter = fx.filter;
		}
		if (fx.overflowVisible) {
			groupStyle.overflow = 'visible';
		}
		return groupStyle;
	}
	if (!hasShapeProperties(el)) {
		return {};
	}
	const ss = el.shapeStyle;
	const style: CssStyleMap = {};

	if (ss) {
		// Fill: image, structured gradient, preset pattern, then solid. Copy every
		// defined `background-*` key the shared builder emits.
		const fill = animatesFill ? undefined : getComputedFillStyle(el);
		for (const [key, value] of Object.entries(fill ?? {})) {
			if (value !== undefined) {
				style[key] = value;
			}
		}

		// Stroke: the whole `a:ln` -> CSS decision lives in shared
		// `getComputedStrokeStyle` (painted width, dash, compound `@cmpd` lines as
		// `border-style: double`, `strokeOpacity`, and the inherited join / cap /
		// miter-limit), so this binding only maps it. It also drops the border for
		// an outline the SVG overlay is painting instead - a gradient/pattern line
		// or an open preset - rather than drawing the averaged solid underneath.
		const stroke = getComputedStrokeStyle(el);
		if (stroke.borderWidth > 0) {
			if (animatesStroke) {
				// Keep width / dash; the colour is left to the animated keyframes.
				style['borderWidth'] = px(stroke.borderWidth);
				style['borderStyle'] = stroke.borderStyle ?? 'solid';
			} else {
				style['border'] = stroke.border ?? '';
			}
		}
		// SVG presentation properties are INHERITED, so writing them on the shape
		// box is what carries `a:ln`'s join / cap / `a:miter/@lim` into the stroke
		// overlay's `<path>` without the overlay restating them.
		if (stroke.strokeLinejoin) {
			style['strokeLinejoin'] = stroke.strokeLinejoin;
		}
		if (stroke.strokeLinecap) {
			style['strokeLinecap'] = stroke.strokeLinecap;
		}
		if (stroke.strokeMiterlimit !== undefined) {
			style['strokeMiterlimit'] = stroke.strokeMiterlimit;
		}
	}

	// Visual effects (shadow / glow / soft edge / reflection / blend), applied
	// before the geometry cascade so each early return carries them.
	const fx = getComputedEffectStyle(el);
	if (fx.boxShadow) {
		style['boxShadow'] = fx.boxShadow;
	}
	if (fx.filter) {
		style['filter'] = fx.filter;
	}
	// Reflection is no longer a single CSS property (`-webkit-box-reflect`
	// never worked in Firefox): the element renderer builds a mirrored sibling
	// node instead, using shared's `getReflectionWrapperStyle` directly (see
	// `elements/reflection-overlay.ts`).
	if (fx.mixBlendMode) {
		style['mixBlendMode'] = fx.mixBlendMode;
	}
	if (fx.opacity !== undefined) {
		// Compose the effect alpha with any element-level opacity (this map is
		// merged over the container style and would otherwise clobber it).
		const elementOpacity = typeof el.opacity === 'number' ? el.opacity : 1;
		style['opacity'] = elementOpacity * fx.opacity;
	}
	if (fx.overflowVisible) {
		// A blur `@grow` halo must not be clipped at the element box.
		style['overflow'] = 'visible';
	}

	// Shape 3D (scene3d camera + shape3d extrusion/bevel/material).
	merge3dStyle(style, getComputed3dStyle(el));

	// Geometry cascade: connector, roundRect, ellipse, clip-path, line, cylinder.
	// An unfilled, textless shape is a FRAME: PowerPoint hit-tests it on its
	// outline only, so its interior must not swallow clicks meant for what it is
	// drawn over. ShapeEffectOverlay paints a transparent pointer-events:stroke
	// band that opts the outline back in.
	if (isHollowShapeElement(el)) {
		style['pointerEvents'] = 'none';
	}

	// Geometry: the branch ORDER and every threshold live in shared
	// `resolveShapeGeometry`, so this binding only maps the decision onto its
	// own style map. Keeping the cascade in one place is what stops the copies
	// drifting - Angular's had, four separate ways.
	const geometry = resolveShapeGeometry(el);
	switch (geometry.kind) {
		case 'bare':
			// Connectors paint as SVG; the box itself is bare.
			style['backgroundColor'] = 'transparent';
			style['border'] = 'none';
			return style;
		case 'strokeOnly':
			// An open preset has no region to fill and no box to outline:
			// `renderStrokeOutline` strokes the evaluated geometry. The clip in
			// particular encloses zero area and would clip that overlay away.
			style['backgroundColor'] = 'transparent';
			delete style['backgroundImage'];
			style['border'] = 'none';
			return style;
		case 'borderRadius':
			style['borderRadius'] = geometry.radius;
			return style;
		case 'clipPath':
			style['clipPath'] = geometry.clipPath;
			return style;
		case 'lineEdge':
			style['backgroundColor'] = 'transparent';
			style['border'] = 'none';
			style['borderTop'] =
				`${px(geometry.strokeWidth)} ${getCssBorderDashStyle(el.shapeStyle?.strokeDash)} ${el.shapeStyle?.strokeColor ?? DEFAULT_STROKE_COLOR}`;
			return style;
		default:
			return style;
	}
}

/**
 * Text block style (flex column, body insets, font, alignment, writing mode).
 *
 * A thin adapter over the shared {@link buildTextBlockStyle}, which React
 * renders from too. This used to be a hand-ported copy of React's builder, and
 * the copy had silently lost `a:normAutofit` (a shrink-to-fit title painted 43%
 * too large), `a:bodyPr/@wrap="none"` (a no-wrap line wrapped to three), the
 * default font declaration, the italic padding nudge and the body
 * margin/indent pair. `pxLengths` is required because these maps are written
 * straight onto `element.style`, where a bare number is not a length.
 *
 * Also folds in the text body's 3D scene (`a:bodyPr/a:scene3d` -> CSS
 * `perspective` + `rotate` transform), mirroring React/Vue/Angular's
 * `ElementBody`. The scene transform is COMPOSED with any existing text-block
 * transform rather than clobbering it; a no-op for the common no-scene3d case.
 */
export function getTextBlockStyle(el: PptxElement): CssStyleMap {
	if (!hasTextProperties(el)) {
		return {};
	}
	const base = buildTextBlockStyle(el, {
		fallbackColor: DEFAULT_TEXT_COLOR,
		bodyLayout: true,
		pxLengths: true,
	});
	const scene3d = buildTextBody3DSceneStyle(el.textStyle, { width: el.width, height: el.height });
	if (!scene3d) {
		return base;
	}
	const merged: CssStyleMap = { ...base, ...scene3d };
	const transform = composeTransforms(base.transform, scene3d.transform);
	if (transform !== undefined) {
		merged.transform = transform;
	}
	return merged;
}
