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
	getComputed3dStyle,
	getComputedEffectStyle,
	getComputedFillStyle,
	getCssBorderDashStyle,
	getResolvedShapeClipPath,
	isVerticalTextDirection,
	px,
	resolveCssTextAlign,
	resolveLineHeight,
	toCssTextOrientation,
	toCssVerticalDirection,
	toCssWritingMode,
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
 * Default text-body insets, in px (PowerPoint defaults: 0.1" left/right,
 * 0.05" top/bottom, i.e. EMU / EMU_PER_PIXEL). Mirrors React and Vue.
 */
const DEFAULT_BODY_INSET_LR_PX = 91440 / 9525;
const DEFAULT_BODY_INSET_TB_PX = 45720 / 9525;

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
export function getShapeFillStrokeStyle(el: PptxElement): CssStyleMap {
	if (!hasShapeProperties(el)) {
		return {};
	}
	const ss = el.shapeStyle;
	const style: CssStyleMap = {};

	if (ss) {
		// Fill: image, structured gradient, preset pattern, then solid.
		const fill = getComputedFillStyle(el);
		if (fill) {
			if (fill.backgroundColor !== undefined) {
				style['backgroundColor'] = fill.backgroundColor;
			}
			if (fill.backgroundImage !== undefined) {
				style['backgroundImage'] = fill.backgroundImage;
			}
			if (fill.backgroundRepeat !== undefined) {
				style['backgroundRepeat'] = fill.backgroundRepeat;
			}
			if (fill.backgroundSize !== undefined) {
				style['backgroundSize'] = fill.backgroundSize;
			}
		}

		const strokeWidth = Math.max(0, ss.strokeWidth ?? 0);
		if (strokeWidth > 0) {
			style['border'] =
				`${px(strokeWidth)} ${getCssBorderDashStyle(ss.strokeDash)} ${ss.strokeColor ?? DEFAULT_STROKE_COLOR}`;
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

	if (normalizedShapeType === 'roundRect') {
		const radiusPx = getRoundRectRadiusPx(el);
		if (radiusPx > 0.01) {
			style['borderRadius'] = px(radiusPx);
		}
		return style;
	}

	if (normalizedShapeType === 'ellipse') {
		style['borderRadius'] = '9999px';
		return style;
	}

	const clipPath = getResolvedShapeClipPath(el);
	if (clipPath) {
		style['clipPath'] = clipPath;
		return style;
	}

	if (normalizedShapeType === 'line') {
		// A bare line shape: drop the box fill/border and draw only the top edge.
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
 * Text block style for elements that carry text (flex column with body
 * insets, font, alignment, writing mode). Mirrors the Vue binding's
 * `getTextBlockStyle`.
 */
export function getTextBlockStyle(el: PptxElement): CssStyleMap {
	if (!hasTextProperties(el)) {
		return {};
	}
	const ts = el.textStyle;
	const style: CssStyleMap = {
		display: 'flex',
		flexDirection: 'column',
		width: '100%',
		height: '100%',
		overflow: 'visible',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word',
		paddingTop: px(ts?.bodyInsetTop ?? DEFAULT_BODY_INSET_TB_PX),
		paddingBottom: px(ts?.bodyInsetBottom ?? DEFAULT_BODY_INSET_TB_PX),
		paddingLeft: px(ts?.bodyInsetLeft ?? DEFAULT_BODY_INSET_LR_PX),
		paddingRight: px(ts?.bodyInsetRight ?? DEFAULT_BODY_INSET_LR_PX),
	};
	if (!ts) {
		style['color'] = DEFAULT_TEXT_COLOR;
		return style;
	}

	style['color'] = ts.color ?? DEFAULT_TEXT_COLOR;
	if (ts.fontFamily) {
		style['fontFamily'] = ts.fontFamily;
	}
	// Font size renders in CSS px (the parsed value already is the px size).
	if (typeof ts.fontSize === 'number') {
		style['fontSize'] = px(ts.fontSize);
	}
	style['lineHeight'] = resolveLineHeight(ts, Boolean(ts.italic));
	if (ts.bold) {
		style['fontWeight'] = 'bold';
	}
	if (ts.italic) {
		style['fontStyle'] = 'italic';
	}

	const decorations: string[] = [];
	if (ts.underline) {
		decorations.push('underline');
	}
	if (ts.strikethrough) {
		decorations.push('line-through');
	}
	if (decorations.length > 0) {
		style['textDecoration'] = decorations.join(' ');
	}

	const isRtl = ts.rtl === true;
	style['textAlign'] = resolveCssTextAlign(ts.align, isRtl) ?? 'left';

	if (isVerticalTextDirection(ts.textDirection)) {
		const writingMode = toCssWritingMode(ts.textDirection);
		const textOrientation = toCssTextOrientation(ts.textDirection);
		const verticalDirection = toCssVerticalDirection(ts.textDirection);
		if (writingMode) {
			style['writingMode'] = writingMode;
		}
		if (textOrientation) {
			style['textOrientation'] = textOrientation;
		}
		if (verticalDirection) {
			style['direction'] = verticalDirection;
		} else if (isRtl) {
			style['direction'] = 'rtl';
		}
	} else if (isRtl) {
		style['direction'] = 'rtl';
	}

	switch (ts.vAlign) {
		case 'middle':
			style['justifyContent'] = 'center';
			break;
		case 'bottom':
			style['justifyContent'] = 'flex-end';
			break;
		default:
			style['justifyContent'] = 'flex-start';
	}

	return style;
}
