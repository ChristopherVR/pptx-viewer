import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';

import { DEFAULT_STROKE_COLOR, DEFAULT_TEXT_COLOR } from '../constants';

/**
 * Basic, framework-agnostic style computation for slide elements.
 *
 * This is a deliberately small subset of the React package's sprawling
 * `viewer/utils/*` style layer (getShapeVisualStyle, getTextStyleForElement,
 * renderVectorShape, buildCssGradientFromShapeStyle, image-effects, …). It is
 * enough to faithfully position and paint text boxes, basic preset shapes, and
 * images. Advanced visuals (gradients, custom geometry clip-paths, shadows,
 * 3D, image effects, text warp) are tracked in PORTING.md.
 *
 * Long-term these helpers — and their richer React counterparts — should be
 * hoisted into a shared, framework-agnostic package so all three UI bindings
 * reuse one implementation.
 */

/** Map a value to a CSS pixel string. */
const px = (n: number): string => `${n}px`;

/**
 * Absolute container style: position, size, rotation, flip, opacity, z-index.
 * Mirrors the essentials of the React `getContainerStyle`.
 */
export function getContainerStyle(el: PptxElement, zIndex: number): CSSProperties {
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

	const style: CSSProperties = {
		position: 'absolute',
		left: px(el.x),
		top: px(el.y),
		width: px(el.width),
		height: px(el.height),
		zIndex,
		boxSizing: 'border-box',
	};
	if (transforms.length > 0) {
		style.transform = transforms.join(' ');
	}
	if (typeof el.opacity === 'number') {
		style.opacity = el.opacity;
	}
	if (el.hidden) {
		style.display = 'none';
	}
	return style;
}

/**
 * Fill / stroke / corner-radius for shape-like elements. Returns an empty
 * object when the element carries no shape styling.
 */
export function getShapeFillStrokeStyle(el: PptxElement): CSSProperties {
	if (!hasShapeProperties(el)) {
		return {};
	}
	const ss = el.shapeStyle;
	const style: CSSProperties = {};

	if (ss) {
		// Fill resolution order mirrors the React `getShapeVisualStyle`:
		//   image fill → gradient → solid colour. Pattern fills (SVG-based) are
		//   not yet ported (TODO, see PORTING.md).
		const imageFillUrl = ss.fillMode === 'image' && ss.fillImageUrl ? ss.fillImageUrl : undefined;
		// `fillGradient` is a prebuilt CSS gradient string from the parser. The
		// richer structured builder (color-gradient.ts) is an extraction candidate.
		const gradient = ss.fillMode === 'gradient' || ss.fillGradient ? ss.fillGradient : undefined;

		if (imageFillUrl) {
			style.backgroundColor = 'transparent';
			style.backgroundImage = `url(${imageFillUrl})`;
			style.backgroundRepeat = ss.fillImageMode === 'tile' ? 'repeat' : 'no-repeat';
			style.backgroundSize = ss.fillImageMode === 'tile' ? 'auto' : '100% 100%';
		} else if (gradient) {
			style.backgroundImage = gradient;
		} else if (ss.fillColor && ss.fillColor !== 'transparent' && ss.fillMode !== 'none') {
			style.backgroundColor = ss.fillColor;
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
			style.border = `${px(strokeWidth)} ${dash} ${ss.strokeColor ?? DEFAULT_STROKE_COLOR}`;
		}
	}

	// Corner radius — approximate common preset geometries (independent of fill/stroke).
	const shapeType = 'shapeType' in el ? el.shapeType : undefined;
	if (shapeType === 'ellipse' || shapeType === 'circle') {
		style.borderRadius = '50%';
	} else if (shapeType === 'roundRect') {
		style.borderRadius = px(Math.min(el.width, el.height) * 0.1);
	}

	return style;
}

/**
 * Text block style for elements that carry text. Mirrors the essentials of
 * the React `getTextStyleForElement`.
 */
export function getTextBlockStyle(el: PptxElement): CSSProperties {
	if (!hasTextProperties(el)) {
		return {};
	}
	const ts = el.textStyle;
	const style: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		width: '100%',
		height: '100%',
		overflow: 'hidden',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word',
	};
	if (!ts) {
		style.color = DEFAULT_TEXT_COLOR;
		return style;
	}

	style.color = ts.color ?? DEFAULT_TEXT_COLOR;
	if (ts.fontFamily) {
		style.fontFamily = ts.fontFamily;
	}
	if (typeof ts.fontSize === 'number') {
		style.fontSize = `${ts.fontSize}pt`;
	}
	if (ts.bold) {
		style.fontWeight = 'bold';
	}
	if (ts.italic) {
		style.fontStyle = 'italic';
	}

	const decorations: string[] = [];
	if (ts.underline) {
		decorations.push('underline');
	}
	if (ts.strikethrough) {
		decorations.push('line-through');
	}
	if (decorations.length > 0) {
		style.textDecoration = decorations.join(' ');
	}

	switch (ts.align) {
		case 'center':
			style.textAlign = 'center';
			break;
		case 'right':
			style.textAlign = 'right';
			break;
		case 'justify':
			style.textAlign = 'justify';
			break;
		default:
			style.textAlign = 'left';
	}

	switch (ts.vAlign) {
		case 'middle':
			style.justifyContent = 'center';
			break;
		case 'bottom':
			style.justifyContent = 'flex-end';
			break;
		default:
			style.justifyContent = 'flex-start';
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
