import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

import { DEFAULT_STROKE_COLOR, DEFAULT_TEXT_COLOR } from '../internal/shared';
import { buildCssGradientFromShapeStyle } from './color-gradient';
import { buildPatternFillCss } from './color-patterns';
import { getResolvedShapeClipPath } from './shape-geometry';
import { getComputedEffectStyle } from './visual-effects';

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
 * Long term the *logic* here is a shared-extraction candidate — only the
 * return type (CSS map shape) differs per framework — so a future refactor
 * could hoist a neutral core into `pptx-viewer-shared`.
 */

/** `[ngStyle]`-compatible style map. */
export type StyleMap = Record<string, string | number>;

/** Map a number to a CSS pixel string. */
const px = (n: number): string => `${n}px`;

/**
 * Absolute container style: position, size, rotation, flip, opacity, z-index.
 * Mirrors the essentials of the React `getContainerStyle`.
 */
export function getContainerStyle(el: PptxElement, zIndex: number): StyleMap {
	const transforms: string[] = [];
	if (el.rotation) {
		transforms.push(`rotate(${el.rotation}deg)`);
	}
	if (el.flipHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (el.flipVertical) {
		transforms.push('scaleY(-1)');
	}

	const style: StyleMap = {
		position: 'absolute',
		left: px(el.x),
		top: px(el.y),
		width: px(el.width),
		height: px(el.height),
		'z-index': zIndex,
		'box-sizing': 'border-box',
	};
	if (transforms.length > 0) {
		style['transform'] = transforms.join(' ');
	}
	if (typeof el.opacity === 'number') {
		style['opacity'] = el.opacity;
	}
	if (el.hidden) {
		style['display'] = 'none';
	}
	return style;
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
	// below. Mirrors the Vue port's `getComputedEffectStyle` integration; the
	// duotone DAG `url(#…)` reference is stripped until the SVG <filter> is
	// injected.
	const fx = getComputedEffectStyle(el);
	if (fx.boxShadow) {
		style['box-shadow'] = fx.boxShadow;
	}
	if (fx.filter) {
		const filter = fx.filter.replace(/\s*url\(#[^)]*\)/gu, '').trim();
		if (filter) {
			style['filter'] = filter;
		}
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
		style['font-size'] = `${ts.fontSize}pt`;
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
	if (el.type === 'picture' || el.type === 'image') {
		return el.imageData ?? (el.imagePath ? mediaDataUrls.get(el.imagePath) : undefined);
	}
	if (el.type === 'media') {
		return (
			el.posterFrameData ?? (el.posterFramePath ? mediaDataUrls.get(el.posterFramePath) : undefined)
		);
	}
	return undefined;
}
