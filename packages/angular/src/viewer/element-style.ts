import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

import {
	DEFAULT_STROKE_COLOR,
	DEFAULT_TEXT_COLOR,
	getComputedEffectStyle,
	getContainerStyle as sharedGetContainerStyle,
	getImageSrc as sharedGetImageSrc,
	px,
} from '../internal/shared';
import { buildCssGradientFromShapeStyle } from './color-gradient';
import { buildPatternFillCss } from './color-patterns';
import { buildDuotoneFilter } from './duotone-filter';
import type { DuotoneFilterDef } from './duotone-filter';
import { getResolvedShapeClipPath } from './shape-geometry';

/**
 * Basic, framework-agnostic style computation for slide elements, returning
 * `[ngStyle]`-compatible maps.
 *
 * This mirrors the Vue package's `element-style.ts` (and a deliberately small
 * subset of the React `viewer/utils/*` style layer). It is enough to position
 * and paint text boxes, basic preset shapes, images, and image/gradient fills
 * (the latter via the parser's prebuilt CSS gradient string). Advanced visuals
 * (the structured gradient builder, pattern fills, custom geometry clip-paths,
 * shadows, 3D, image effects, text warp) are tracked in PORTING.md.
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
 */
export function getShapeFillStrokeStyle(el: PptxElement): StyleMap {
	if (!hasShapeProperties(el)) {
		return {};
	}
	const ss = el.shapeStyle;
	const style: StyleMap = {};

	if (ss) {
		// Fill resolution order mirrors the React `getShapeVisualStyle`:
		// image → pattern (SVG preset) → gradient (structured builder, with the
		// parser's prebuilt CSS string as fallback) → solid colour.
		const imageFillUrl = ss.fillMode === 'image' && ss.fillImageUrl ? ss.fillImageUrl : undefined;
		const patternCss = ss.fillMode === 'pattern' ? buildPatternFillCss(ss) : undefined;
		const gradient =
			ss.fillMode === 'gradient'
				? (buildCssGradientFromShapeStyle(ss) ?? ss.fillGradient)
				: ss.fillGradient;

		if (imageFillUrl) {
			style['background-color'] = 'transparent';
			style['background-image'] = `url(${imageFillUrl})`;
			style['background-repeat'] = ss.fillImageMode === 'tile' ? 'repeat' : 'no-repeat';
			style['background-size'] = ss.fillImageMode === 'tile' ? 'auto' : '100% 100%';
		} else if (patternCss) {
			style['background-image'] = patternCss.backgroundImage;
			style['background-color'] = patternCss.backgroundColor;
			style['background-repeat'] = 'repeat';
			style['background-size'] = 'auto';
		} else if (gradient) {
			style['background-image'] = gradient;
		} else if (ss.fillColor && ss.fillColor !== 'transparent' && ss.fillMode !== 'none') {
			style['background-color'] = ss.fillColor;
		}

		// Stroke.
		const strokeWidth = Math.max(0, ss.strokeWidth ?? 0);
		if (strokeWidth > 0) {
			const dash =
				ss.strokeDash && ss.strokeDash !== 'solid'
					? ss.strokeDash === 'dot' || ss.strokeDash === 'sysDot'
						? 'dotted'
						: 'dashed'
					: 'solid';
			style['border'] = `${px(strokeWidth)} ${dash} ${ss.strokeColor ?? DEFAULT_STROKE_COLOR}`;
		}
	}

	// Visual effects (outer/inner/glow shadows, blur/soft-edge filters,
	// reflection, blend mode, effect-DAG alpha). Applied to every return path
	// below. Mirrors the Vue port's `getComputedEffectStyle` integration. The
	// duotone DAG `url(#…)` reference is kept only when the matching SVG
	// <filter> def is actually rendered (i.e. the element has a duotone effect;
	// the renderer injects the def); otherwise the dangling ref is stripped.
	const duotone = buildDuotoneFilter(el);
	const fx = getComputedEffectStyle(el);
	if (fx.boxShadow) {
		style['box-shadow'] = fx.boxShadow;
	}
	if (fx.filter) {
		const filter = duotone ? fx.filter : fx.filter.replace(/\s*url\(#[^)]*\)/gu, '').trim();
		if (filter) {
			style['filter'] = filter;
		}
	} else if (duotone) {
		style['filter'] = duotone.cssFilter;
	}
	if (fx.webkitBoxReflect) {
		style['-webkit-box-reflect'] = fx.webkitBoxReflect;
	}
	if (fx.mixBlendMode) {
		style['mix-blend-mode'] = fx.mixBlendMode;
	}
	if (fx.opacity !== undefined) {
		const elementOpacity = typeof el.opacity === 'number' ? el.opacity : 1;
		style['opacity'] = elementOpacity * fx.opacity;
	}

	// Geometry. ellipse / roundRect get cheap `border-radius` approximations;
	// every other preset geometry falls back to an SVG `clip-path` derived from
	// the core geometry engine (mirrors the Vue port's cascade). Plain
	// rectangles resolve to `undefined` and stay unclipped.
	const shapeType = 'shapeType' in el ? el.shapeType : undefined;
	if (shapeType === 'ellipse' || shapeType === 'circle') {
		style['border-radius'] = '50%';
		return style;
	}
	if (shapeType === 'roundRect') {
		style['border-radius'] = px(Math.min(el.width, el.height) * 0.1);
		return style;
	}

	const clipPath = getResolvedShapeClipPath(el);
	if (clipPath) {
		style['clip-path'] = clipPath;
	}

	return style;
}

/**
 * Text block style for elements that carry text. Mirrors the essentials of the
 * React `getTextStyleForElement`.
 */
export function getTextBlockStyle(el: PptxElement): StyleMap {
	if (!hasTextProperties(el)) {
		return {};
	}
	const ts = el.textStyle;
	const style: StyleMap = {
		display: 'flex',
		'flex-direction': 'column',
		width: '100%',
		height: '100%',
		overflow: 'hidden',
		'white-space': 'pre-wrap',
		'word-break': 'break-word',
	};
	if (!ts) {
		style['color'] = DEFAULT_TEXT_COLOR;
		return style;
	}

	style['color'] = ts.color ?? DEFAULT_TEXT_COLOR;
	if (ts.fontFamily) {
		style['font-family'] = ts.fontFamily;
	}
	if (typeof ts.fontSize === 'number') {
		// The parsed model stores font size as a px value; render it as px (matches
		// React/Vue). Emitting `pt` inflated every glyph by 96/72 (≈1.33×), which
		// overflowed text boxes and broke visual parity (e2e: text-rendering.spec).
		style['font-size'] = `${ts.fontSize}px`;
	}
	if (ts.bold) {
		style['font-weight'] = 'bold';
	}
	if (ts.italic) {
		style['font-style'] = 'italic';
	}

	const decorations: string[] = [];
	if (ts.underline) {
		decorations.push('underline');
	}
	if (ts.strikethrough) {
		decorations.push('line-through');
	}
	if (decorations.length > 0) {
		style['text-decoration'] = decorations.join(' ');
	}

	switch (ts.align) {
		case 'center':
			style['text-align'] = 'center';
			break;
		case 'right':
			style['text-align'] = 'right';
			break;
		case 'justify':
			style['text-align'] = 'justify';
			break;
		default:
			style['text-align'] = 'left';
	}

	switch (ts.vAlign) {
		case 'middle':
			style['justify-content'] = 'center';
			break;
		case 'bottom':
			style['justify-content'] = 'flex-end';
			break;
		default:
			style['justify-content'] = 'flex-start';
	}

	return style;
}

/** Resolve a displayable image source for picture/image/media poster frames. */
export function getImageSrc(
	el: PptxElement,
	mediaDataUrls: Map<string, string>,
): string | undefined {
	return sharedGetImageSrc(el, mediaDataUrls);
}
