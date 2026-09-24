/**
 * Canvas texture for a `SmartArt3DTextBlock`, for the `<pptx-three-view>`
 * SmartArt scene (`view-scene.ts`).
 *
 * Unlike the legacy `smartart-3d/text-texture.ts` (which imports `three`
 * statically and re-wraps text itself), this draws the ALREADY wrapped/
 * positioned lines a `SmartArt3DTextBlock` carries (built from the same 2D
 * projection the SVG renderer uses), and takes the runtime `three` module as
 * a parameter so it stays out of the tsup-bundled `dist/index.mjs` (see the
 * "no runtime `three` import" rule in `three-view/types.ts`).
 *
 * @module smartart-3d/text-block-texture
 */
import type * as THREE from 'three';

import type { SmartArt3DTextBlock } from '../render/smartart-3d-types';
import type { ThreeModule } from '../three-view/types';

/** Supersampling factor for crisp text at any zoom. */
const SUPERSAMPLE = 3;

/** A built label texture plus the world-space plane size it should fill. */
export interface TextBlockTexture {
	texture: THREE.CanvasTexture;
	worldWidth: number;
	worldHeight: number;
}

/** Build a canvas texture rendering `block`'s pre-wrapped lines, or `null` off-DOM. */
export function buildTextBlockTexture(
	three: ThreeModule,
	block: SmartArt3DTextBlock,
): TextBlockTexture | null {
	if (typeof document === 'undefined' || block.lines.every((l) => l.text.length === 0)) {
		return null;
	}
	const worldWidth = Math.max(1, block.maxWidth);
	const worldHeight = Math.max(1, block.maxHeight);
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(8, Math.round(worldWidth * SUPERSAMPLE));
	canvas.height = Math.max(8, Math.round(worldHeight * SUPERSAMPLE));
	const ctx2d = canvas.getContext('2d');
	if (!ctx2d) {
		return null;
	}

	const weight = block.fontWeight ?? 400;
	const italic = block.fontStyle === 'italic' ? 'italic ' : '';
	const family = block.fontFamily
		? `${block.fontFamily}, system-ui, sans-serif`
		: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
	const px = Math.max(6, block.fontSize) * SUPERSAMPLE;

	ctx2d.clearRect(0, 0, canvas.width, canvas.height);
	ctx2d.fillStyle = block.color;
	ctx2d.textAlign = 'center';
	ctx2d.textBaseline = 'alphabetic';
	ctx2d.font = `${italic}${weight} ${px}px ${family}`;
	const centerX = canvas.width / 2;
	const centerY = canvas.height / 2;
	for (const line of block.lines) {
		if (!line.text) {
			continue;
		}
		// `dy` is a y-up offset from the block centre; canvas y grows downward.
		ctx2d.fillText(line.text, centerX, centerY - line.dy * SUPERSAMPLE);
	}

	const texture = new three.CanvasTexture(canvas);
	texture.colorSpace = three.SRGBColorSpace;
	texture.minFilter = three.LinearFilter;
	texture.magFilter = three.LinearFilter;
	// See `smartart-3d/text-texture.ts` for why flipY must stay false with a
	// compensating UV flip: WebGL2 forbids UNPACK_FLIP_Y_WEBGL for some texture
	// targets, and leaving it enabled pollutes global pixel-store state.
	texture.flipY = false;
	texture.premultiplyAlpha = false;
	texture.wrapT = three.RepeatWrapping;
	texture.repeat.set(1, -1);
	texture.offset.set(0, 1);
	texture.needsUpdate = true;

	return { texture, worldWidth, worldHeight };
}
