/**
 * Three.js SmartArt renderer - front-face text textures.
 *
 * Renders a node label onto an offscreen 2D canvas and wraps it as a
 * `THREE.CanvasTexture`, sized to sit on the extruded block's front face. Text
 * is word-wrapped and auto-shrunk to fit the node footprint. Returns `null` in
 * non-DOM environments (SSR / unit tests).
 */

import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';

import type { TextStyleAnimationDescriptor } from '../render/animation-text-style-resolve';

/** A built label texture plus the world-space plane size it should fill. */
export interface SmartArtTextTexture {
	texture: CanvasTexture;
	/** Plane width in world (layout-pixel) units. */
	worldWidth: number;
	/** Plane height in world units. */
	worldHeight: number;
}

/** Supersampling factor for crisp text at oblique camera angles. */
const SUPERSAMPLE = 4;
/** Fraction of the footprint the text plane occupies (inset padding). */
const FILL = 0.86;

/** Greedily word-wrap `text` to lines that fit `maxWidth` at the given font. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const words = text.split(/\s+/u).filter(Boolean);
	if (words.length === 0) {
		return [];
	}
	const lines: string[] = [];
	let line = words[0];
	for (let i = 1; i < words.length; i++) {
		const candidate = `${line} ${words[i]}`;
		if (ctx.measureText(candidate).width <= maxWidth) {
			line = candidate;
		} else {
			lines.push(line);
			line = words[i];
		}
	}
	lines.push(line);
	return lines;
}

/** Resolve the canvas `font` string weight/style + effective colour for an optional emphasis override. */
function resolveEmphasisFont(
	color: string,
	emphasis: TextStyleAnimationDescriptor | undefined,
): { weight: string; italic: string; color: string; scale: number } {
	const weight = emphasis?.bold === undefined ? '600' : emphasis.bold ? '700' : '400';
	const italic = emphasis?.italic ? 'italic ' : '';
	const scale =
		typeof emphasis?.fontScale === 'number' &&
		Number.isFinite(emphasis.fontScale) &&
		emphasis.fontScale > 0
			? emphasis.fontScale
			: 1;
	return { weight, italic, color: emphasis?.color ?? color, scale };
}

/**
 * Build a label texture for a node's front face.
 *
 * @param text      Label text.
 * @param color     CSS colour for the text.
 * @param fontSize  Requested font size in layout pixels.
 * @param footW     Node footprint width (layout pixels).
 * @param footH     Node footprint height (layout pixels).
 * @param emphasis  Active font-style emphasis override (bold/italic/underline/size/colour), if any.
 * @returns The texture + plane size, or `null` when no DOM / empty text.
 */
export function makeTextTexture(
	text: string,
	color: string,
	fontSize: number,
	footW: number,
	footH: number,
	emphasis?: TextStyleAnimationDescriptor,
): SmartArtTextTexture | null {
	if (typeof document === 'undefined' || !text.trim() || footW <= 0 || footH <= 0) {
		return null;
	}

	const { weight, italic, color: effectiveColor, scale } = resolveEmphasisFont(color, emphasis);
	const worldWidth = footW * FILL;
	const worldHeight = footH * FILL;
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(8, Math.round(worldWidth * SUPERSAMPLE));
	canvas.height = Math.max(8, Math.round(worldHeight * SUPERSAMPLE));
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return null;
	}

	const family = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
	const maxTextWidth = canvas.width * 0.94;
	const fontString = (px: number): string => `${italic}${weight} ${px}px ${family}`;

	// Shrink the font until the wrapped block fits the canvas height.
	let px = Math.max(6, fontSize) * scale * SUPERSAMPLE;
	let lines: string[] = [];
	for (let attempt = 0; attempt < 12; attempt++) {
		ctx.font = fontString(px);
		lines = wrapLines(ctx, text, maxTextWidth);
		const lineHeight = px * 1.2;
		if (lines.length * lineHeight <= canvas.height * 0.96 || px <= 6 * SUPERSAMPLE) {
			break;
		}
		px *= 0.88;
	}

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = effectiveColor;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = fontString(px);
	const lineHeight = px * 1.2;
	const blockHeight = lines.length * lineHeight;
	const startY = canvas.height / 2 - blockHeight / 2 + lineHeight / 2;
	for (let i = 0; i < lines.length; i++) {
		const y = startY + i * lineHeight;
		ctx.fillText(lines[i], canvas.width / 2, y);
		if (emphasis?.underline) {
			const w = ctx.measureText(lines[i]).width;
			ctx.strokeStyle = effectiveColor;
			ctx.lineWidth = Math.max(1, px * 0.06);
			ctx.beginPath();
			ctx.moveTo(canvas.width / 2 - w / 2, y + px * 0.32);
			ctx.lineTo(canvas.width / 2 + w / 2, y + px * 0.32);
			ctx.stroke();
		}
	}

	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.minFilter = LinearFilter;
	texture.magFilter = LinearFilter;
	// Disable GPU-side flip: WebGL2 does not allow UNPACK_FLIP_Y_WEBGL for
	// texImage3D targets (depth buffers, LUTs, shadow maps). Leaving flipY=true
	// (the Three.js default) pollutes the global pixel-store state and causes
	// "INVALID_OPERATION: texImage3D: FLIP_Y or PREMULTIPLY_ALPHA isn't allowed"
	// errors. Compensate in UV space instead.
	texture.flipY = false;
	texture.premultiplyAlpha = false;
	texture.wrapT = RepeatWrapping;
	texture.repeat.set(1, -1);
	texture.offset.set(0, 1);
	texture.needsUpdate = true;

	return { texture, worldWidth, worldHeight };
}
