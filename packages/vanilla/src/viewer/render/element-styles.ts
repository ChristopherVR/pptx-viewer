import type { PptxElement } from 'pptx-viewer-core';
import {
	getRoundRectRadiusPx,
	getShapeType,
	hasShapeProperties,
	hasTextProperties,
} from 'pptx-viewer-core';
import type { Computed3dStyle, CssStyleMap } from 'pptx-viewer-shared';
import {
	DEFAULT_STROKE_COLOR,
	DEFAULT_TEXT_COLOR,
	buildTextBlockStyle,
	getComputed3dStyle,
	getComputedEffectStyle,
	getComputedFillStyle,
	isStrokeOnlyPresetElement,
	paintedStrokeWidth,
	suppressesCssBorder,
	getCssBorderDashStyle,
	getResolvedShapeClipPath,
	isIdentityRectClip,
	px,
} from 'pptx-viewer-shared';

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

		// A gradient outline is stroked as an SVG path over the element (a CSS
		// border takes one colour only), so drop the border rather than drawing the
		// averaged solid underneath it.
		// `paintedStrokeWidth`: a width-only fill-less <a:ln> paints NO outline
		// (PowerPoint ground truth; see shared stroke-paint).
		const strokeWidth = suppressesCssBorder(el) ? 0 : paintedStrokeWidth(ss);
		if (strokeWidth > 0) {
			if (animatesStroke) {
				// Keep width / dash; the colour is left to the animated keyframes.
				style['borderWidth'] = px(strokeWidth);
				style['borderStyle'] = getCssBorderDashStyle(ss.strokeDash) ?? 'solid';
			} else {
				style['border'] =
					`${px(strokeWidth)} ${getCssBorderDashStyle(ss.strokeDash)} ${ss.strokeColor ?? DEFAULT_STROKE_COLOR}`;
			}
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
	if (fx.webkitBoxReflect) {
		style['WebkitBoxReflect'] = fx.webkitBoxReflect;
	}
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
	const normalizedShapeType = getShapeType(el.shapeType);

	if (el.type === 'connector' || normalizedShapeType === 'connector') {
		// Connectors paint as SVG; the box itself is bare.
		style['backgroundColor'] = 'transparent';
		style['border'] = 'none';
		return style;
	}

	// Stroke-only ("open") presets - `line`, `arc`, the connector family - have
	// no region to fill and no box to outline: `renderStrokeOutline` strokes the
	// evaluated geometry from shared `buildStrokeOutline`. The container keeps
	// its effects but drops the fill, the border and the clip-path; the clip in
	// particular encloses zero area for an open path and would clip the overlay
	// away entirely.
	if (isStrokeOnlyPresetElement(el)) {
		style['backgroundColor'] = 'transparent';
		delete style['backgroundImage'];
		style['border'] = 'none';
		return style;
	}

	if (normalizedShapeType === 'roundRect') {
		const radiusPx = getRoundRectRadiusPx(el);
		if (radiusPx > 0.01) {
			style['borderRadius'] = px(radiusPx);
		}
		return style;
	}

	if (normalizedShapeType === 'ellipse') {
		// `50%`, not a huge px value: CSS clamps over-large radii uniformly, so
		// `9999px` on a non-square box becomes a pill with flat long edges.
		style['borderRadius'] = '50%';
		return style;
	}

	// A rect preset's clip is its own box: skip it so overflowing text spills
	// visibly (as PowerPoint does) instead of being sliced.
	const clipPath = isIdentityRectClip(el) ? undefined : getResolvedShapeClipPath(el);
	if (clipPath) {
		style['clipPath'] = clipPath;
		return style;
	}

	if (normalizedShapeType === 'line') {
		// A line-typed shape whose geometry the preset evaluator cannot open (it
		// carries custom `pathData`): approximate it with the top edge only.
		const strokeWidth = Math.max(0, el.shapeStyle?.strokeWidth ?? 0);
		style['backgroundColor'] = 'transparent';
		style['border'] = 'none';
		style['borderTop'] =
			`${px(Math.max(strokeWidth, 2))} ${getCssBorderDashStyle(el.shapeStyle?.strokeDash)} ${el.shapeStyle?.strokeColor ?? DEFAULT_STROKE_COLOR}`;
		return style;
	}

	if (normalizedShapeType === 'cylinder') {
		style['borderRadius'] = '48% / 12%';
		return style;
	}

	return style;
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
 */
export function getTextBlockStyle(el: PptxElement): CssStyleMap {
	if (!hasTextProperties(el)) {
		return {};
	}
	return buildTextBlockStyle(el, {
		fallbackColor: DEFAULT_TEXT_COLOR,
		bodyLayout: true,
		pxLengths: true,
	});
}
