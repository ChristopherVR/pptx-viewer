import type { ShapeStyle, TextSegment, TextStyle } from '../core';
import { drawTextSegments } from './ShapeTextRenderer';

/** Minimal shape info needed to render a shape as a raster image. */
export interface ShapeRenderInput {
	width: number;
	height: number;
	shapeType?: string;
	pathData?: string;
	pathWidth?: number;
	pathHeight?: number;
	shapeStyle?: ShapeStyle;
	/** Optional text segments to render inside the shape. */
	textSegments?: TextSegment[];
	/** Body-level text style (alignment, vertical alignment, insets). */
	textStyle?: TextStyle;
}

/** Maximum canvas dimension (px) for shapes without text. */
const MAX_DIM = 400;
/** Maximum canvas dimension (px) for shapes that contain text (higher fidelity). */
const MAX_DIM_TEXT = 800;
/** Minimum dimension — skip shapes smaller than this. */
const MIN_DIM = 4;

/**
 * Renders a shape element to a PNG data-URL using canvas.
 *
 * Works in both the Electron renderer (HTMLCanvasElement) and the
 * Bun server script (@napi-rs/canvas polyfills document.createElement).
 */
export function renderShapeToDataUrl(
	input: ShapeRenderInput
): string | null {
	const style = input.shapeStyle;
	if (!style) return null;

	// Only render shapes that have a visible fill or stroke.
	if (!hasVisibleFill(style) && !hasVisibleStroke(style)) return null;

	let w = Math.round(input.width);
	let h = Math.round(input.height);
	if (w < MIN_DIM || h < MIN_DIM) return null;

	// Cap size to avoid huge canvases.
	const hasText = (input.textSegments?.length ?? 0) > 0;
	const maxDim = hasText ? MAX_DIM_TEXT : MAX_DIM;
	let scaleFactor = 1;
	if (w > maxDim || h > maxDim) {
		scaleFactor = maxDim / Math.max(w, h);
		w = Math.round(w * scaleFactor);
		h = Math.round(h * scaleFactor);
	}

	const canvas = createCanvasElement(w, h);
	if (!canvas) return null;

	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	applyFill(ctx, style, w, h);

	if (input.pathData) {
		// Use Path2D for custom geometry — fill & stroke directly.
		const pw = input.pathWidth ?? w;
		const ph = input.pathHeight ?? h;
		const sx = w / (pw || 1);
		const sy = h / (ph || 1);
		const path = new Path2D(input.pathData);
		ctx.save();
		ctx.scale(sx, sy);
		ctx.fill(path);
		if (hasVisibleStroke(style)) {
			applyStroke(ctx, style);
			ctx.stroke(path);
		}
		ctx.restore();
	} else {
		drawPresetShape(ctx, input.shapeType, w, h);
		ctx.fill();
		if (hasVisibleStroke(style)) {
			applyStroke(ctx, style);
			drawPresetShape(ctx, input.shapeType, w, h);
			ctx.stroke();
		}
	}

	// Reset alpha before drawing text — fill/stroke opacity must not leak.
	ctx.globalAlpha = 1;

	// Draw text on top of the shape if segments provided.
	if (input.textSegments?.length) {
		drawTextSegments(
			ctx,
			input.textSegments,
			input.textStyle,
			w,
			h,
			scaleFactor
		);
	}

	return canvas.toDataURL('image/png');
}

/* ------------------------------------------------------------------ */
/*  Canvas creation (works in both browser and Bun polyfill contexts) */
/* ------------------------------------------------------------------ */

function createCanvasElement(
	w: number,
	h: number
): HTMLCanvasElement | null {
	try {
		if (typeof document !== 'undefined' && document.createElement) {
			const c = document.createElement('canvas');
			c.width = w;
			c.height = h;
			return c as HTMLCanvasElement;
		}
	} catch {
		/* fallthrough */
	}
	return null;
}

/* ------------------------------------------------------------------ */
/*  Shape path drawing                                                */
/* ------------------------------------------------------------------ */

function drawPresetShape(
	ctx: CanvasRenderingContext2D,
	shapeType: string | undefined,
	w: number,
	h: number
): void {
	ctx.beginPath();

	const type = shapeType ?? 'rect';
	switch (type) {
		case 'ellipse':
			ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
			break;
		case 'roundRect': {
			const r = Math.min(w, h) * 0.1;
			roundRect(ctx, 0, 0, w, h, r);
			break;
		}
		case 'triangle':
		case 'flowChartProcess':
		case 'rect':
		default:
			ctx.rect(0, 0, w, h);
			break;
	}
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
): void {
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

/* ------------------------------------------------------------------ */
/*  Fill & stroke                                                     */
/* ------------------------------------------------------------------ */

function applyFill(
	ctx: CanvasRenderingContext2D,
	style: ShapeStyle,
	w: number,
	h: number
): void {
	if (style.fillMode === 'gradient' && style.fillGradientStops?.length) {
		const angle = ((style.fillGradientAngle ?? 0) * Math.PI) / 180;
		const cx = w / 2;
		const cy = h / 2;
		const len = Math.max(w, h) / 2;
		const dx = Math.cos(angle) * len;
		const dy = Math.sin(angle) * len;

		let grad: CanvasGradient;
		if (style.fillGradientType === 'radial') {
			grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, len);
		} else {
			grad = ctx.createLinearGradient(
				cx - dx,
				cy - dy,
				cx + dx,
				cy + dy
			);
		}
		for (const stop of style.fillGradientStops) {
			const pos = Math.max(0, Math.min(1, stop.position));
			grad.addColorStop(pos, stop.color);
		}
		ctx.fillStyle = grad;
	} else if (style.fillColor && style.fillColor !== 'transparent') {
		ctx.fillStyle = style.fillColor;
	} else {
		ctx.fillStyle = 'rgba(0,0,0,0)';
	}

	if (style.fillOpacity !== undefined && style.fillOpacity < 1) {
		ctx.globalAlpha = style.fillOpacity;
	}
}

function applyStroke(
	ctx: CanvasRenderingContext2D,
	style: ShapeStyle
): void {
	ctx.strokeStyle = style.strokeColor ?? '#000000';
	ctx.lineWidth = style.strokeWidth ?? 1;
	if (
		style.strokeOpacity !== undefined &&
		style.strokeOpacity < 1
	) {
		ctx.globalAlpha = style.strokeOpacity;
	}
}

/* ------------------------------------------------------------------ */
/*  Visibility helpers                                                */
/* ------------------------------------------------------------------ */

function hasVisibleFill(style: ShapeStyle): boolean {
	if (style.fillMode === 'none') return false;
	if (style.fillMode === 'gradient' && style.fillGradientStops?.length) {
		return true;
	}
	if (style.fillMode === 'solid' || style.fillMode === 'pattern') {
		return !!style.fillColor && style.fillColor !== 'transparent';
	}
	if (style.fillMode === 'image') return !!style.fillImageUrl;
	// Theme fills may have a resolved fillColor.
	if (style.fillColor && style.fillColor !== 'transparent') return true;
	return false;
}

function hasVisibleStroke(style: ShapeStyle): boolean {
	return (
		!!style.strokeColor &&
		style.strokeColor !== 'transparent' &&
		(style.strokeWidth ?? 0) > 0
	);
}
