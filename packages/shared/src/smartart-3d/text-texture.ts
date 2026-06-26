/**
 * Three.js SmartArt renderer - front-face text textures.
 *
 * Renders a node label onto an offscreen 2D canvas and wraps it as a
 * `THREE.CanvasTexture`, sized to sit on the extruded block's front face. Text
 * is word-wrapped and auto-shrunk to fit the node footprint. Returns `null` in
 * non-DOM environments (SSR / unit tests).
 */

import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';

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

/**
 * Build a label texture for a node's front face.
 *
 * @param text      Label text.
 * @param color     CSS colour for the text.
 * @param fontSize  Requested font size in layout pixels.
 * @param footW     Node footprint width (layout pixels).
 * @param footH     Node footprint height (layout pixels).
 * @returns The texture + plane size, or `null` when no DOM / empty text.
 */
export function makeTextTexture(
	text: string,
	color: string,
	fontSize: number,
	footW: number,
	footH: number,
): SmartArtTextTexture | null {
	if (typeof document === 'undefined' || !text.trim() || footW <= 0 || footH <= 0) {
		return null;
	}

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

	// Shrink the font until the wrapped block fits the canvas height.
	let px = Math.max(6, fontSize) * SUPERSAMPLE;
	let lines: string[] = [];
	for (let attempt = 0; attempt < 12; attempt++) {
		ctx.font = `600 ${px}px ${family}`;
		lines = wrapLines(ctx, text, maxTextWidth);
		const lineHeight = px * 1.2;
		if (lines.length * lineHeight <= canvas.height * 0.96 || px <= 6 * SUPERSAMPLE) {
			break;
		}
		px *= 0.88;
	}

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = color;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `600 ${px}px ${family}`;
	const lineHeight = px * 1.2;
	const blockHeight = lines.length * lineHeight;
	const startY = canvas.height / 2 - blockHeight / 2 + lineHeight / 2;
	for (let i = 0; i < lines.length; i++) {
		ctx.fillText(lines[i], canvas.width / 2, startY + i * lineHeight);
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
