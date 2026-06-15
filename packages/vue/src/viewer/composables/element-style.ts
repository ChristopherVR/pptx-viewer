import type { PptxElement } from 'pptx-viewer-core';
import {
	getRoundRectRadiusPx,
	getShapeType,
	hasShapeProperties,
	hasTextProperties,
} from 'pptx-viewer-core';
import {
	getComputedEffectStyle,
	getComputedFillStyle,
	getResolvedShapeClipPath,
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
 * 3D, image effects, text warp) are tracked in PORTING.md.
 *
 * Long-term these helpers — and their richer React counterparts — should be
 * hoisted into a shared, framework-agnostic package so all three UI bindings
 * reuse one implementation.
 */

/** Map a value to a CSS pixel string. */
const px = (n: number): string => `${n}px`;

/** Map an OOXML stroke-dash value to a CSS `border-style` keyword. */
function cssBorderDashStyle(strokeDash: string | undefined): 'solid' | 'dotted' | 'dashed' {
	if (!strokeDash || strokeDash === 'solid') {
		return 'solid';
	}
	if (strokeDash === 'dot' || strokeDash === 'sysDot') {
		return 'dotted';
	}
	return 'dashed';
}

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
		// Fill: resolve in React's order via the structured fill builder —
		//   image → structured gradient (falls back to prebuilt `fillGradient`)
		//   → preset pattern → solid (with `fillOpacity`).
		const fill = getComputedFillStyle(el);
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
		}

		// Stroke.
		const strokeWidth = Math.max(0, ss.strokeWidth ?? 0);
		if (strokeWidth > 0) {
			style.border = `${px(strokeWidth)} ${cssBorderDashStyle(ss.strokeDash)} ${ss.strokeColor ?? DEFAULT_STROKE_COLOR}`;
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
		// The duotone DAG effect emits a `url(#…)` reference to an SVG <filter>
		// the Vue renderer does not inject yet. Strip it so the remaining CSS
		// filter functions (glow, blur, grayscale, …) still apply and the element
		// isn't hidden by a dangling filter reference. (Duotone deferred.)
		const filter = fx.filter.replace(/\s*url\(#[^)]*\)/gu, '').trim();
		if (filter) {
			style.filter = filter;
		}
	}
	if (fx.webkitBoxReflect) {
		style.WebkitBoxReflect = fx.webkitBoxReflect;
	}
	if (fx.mixBlendMode) {
		style.mixBlendMode = fx.mixBlendMode as CSSProperties['mixBlendMode'];
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

	// Geometry: mirror the React `getShapeVisualStyle` priority cascade —
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
		style.borderTop = `${px(Math.max(strokeWidth, 2))} ${cssBorderDashStyle(el.shapeStyle?.strokeDash)} ${el.shapeStyle?.strokeColor ?? DEFAULT_STROKE_COLOR}`;
		return style;
	}

	if (normalizedShapeType === 'cylinder') {
		style.borderRadius = '48% / 12%';
		return style;
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
