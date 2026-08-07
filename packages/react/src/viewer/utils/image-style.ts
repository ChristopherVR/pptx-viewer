import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement, hasShapeProperties } from 'pptx-viewer-core';
import { getImageFitStyle } from 'pptx-viewer-shared';
/**
 * Image mask, render style, crop shape, and tiling helpers
 * for the PowerPoint editor.
 */
import type React from 'react';

import { getResolvedShapeClipPath } from './resolved-shape-clip-path';
import { getRoundRectRadiusPx } from './shape-adjustment';

// ---------------------------------------------------------------------------
// Image mask / render style helpers
// ---------------------------------------------------------------------------

export function getImageMaskStyle(element: PptxElement): React.CSSProperties | undefined {
	if (!hasShapeProperties(element)) {
		return undefined;
	}
	const shapeType = element.shapeType;
	if (!shapeType) {
		return undefined;
	}
	const normalized = shapeType.toLowerCase();

	if (
		normalized === 'roundrect' ||
		normalized === 'round1rect' ||
		normalized === 'round2samerect' ||
		normalized === 'round2diagrect' ||
		normalized === 'sniproundrect' ||
		normalized === 'snip1rect' ||
		normalized === 'snip2diagrect'
	) {
		const radiusPx = getRoundRectRadiusPx(element);
		if (radiusPx <= 0.01) {
			return undefined;
		}
		return { borderRadius: radiusPx };
	}

	if (normalized === 'ellipse' || normalized === 'oval') {
		// `50%`, not a huge px value: CSS clamps over-large radii uniformly, so
		// `9999px` on a non-square box crops the image to a pill, not an ellipse.
		return { borderRadius: '50%' };
	}
	if (normalized === 'can' || normalized === 'cylinder') {
		return { borderRadius: '48% / 12%' };
	}

	const clipPath = getResolvedShapeClipPath(element);
	if (!clipPath) {
		return undefined;
	}
	return { clipPath };
}

/**
 * The `<img>` style for a picture: its shape mask plus the shared fill/crop fit.
 *
 * The fit half lives in `pptx-viewer-shared` because every binding needs the
 * identical `<a:srcRect>` maths; only the mask (which depends on React's
 * resolved-clip-path helpers) stays here.
 */
export function getImageRenderStyle(element: PptxElement): React.CSSProperties {
	return {
		...(getImageMaskStyle(element) || {}),
		...(getImageFitStyle(element) as React.CSSProperties),
	};
}

/** Map cropShape to a CSS clip-path value. */
const CROP_SHAPE_CLIP_PATHS: Record<string, string> = {
	ellipse: 'ellipse(50% 50% at 50% 50%)',
	roundedRect: 'inset(0 round 12%)',
	triangle: 'polygon(50% 0%, 0% 100%, 100% 100%)',
	diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
	pentagon: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
	hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
	star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
};

export function getCropShapeClipPath(element: PptxElement): string | undefined {
	if (!isImageLikeElement(element)) {
		return undefined;
	}
	const shape = element.cropShape;
	if (!shape || shape === 'none') {
		return undefined;
	}
	return CROP_SHAPE_CLIP_PATHS[shape];
}

export function isImageTiled(element: PptxElement): boolean {
	if (!isImageLikeElement(element)) {
		return false;
	}
	return typeof element.tileScaleX === 'number' || typeof element.tileScaleY === 'number';
}

/**
 * Map OOXML tile alignment (`a:tile/@algn`) to a CSS background-position anchor.
 * This determines the origin from which tiles are repeated.
 */
function tileAlignmentToCssPosition(alignment: string | undefined): string | undefined {
	switch (alignment) {
		case 'tl':
			return 'top left';
		case 't':
			return 'top center';
		case 'tr':
			return 'top right';
		case 'l':
			return 'center left';
		case 'ctr':
			return 'center center';
		case 'r':
			return 'center right';
		case 'bl':
			return 'bottom left';
		case 'b':
			return 'bottom center';
		case 'br':
			return 'bottom right';
		default:
			return undefined;
	}
}

/**
 * OOXML `a:tile/@flip` mirrors adjacent tiles when the fill repeats. CSS
 * `background-repeat` cannot mirror on its own, so we bake the mirror into a
 * single composite tile: an inline SVG that lays out 2 (`x`/`y`) or 4 (`xy`)
 * mirrored copies of the source, which then repeats seamlessly (each neighbour
 * is the mirror of the last, exactly as PowerPoint tiles it).
 *
 * The source must be an embeddable `data:` URI: an SVG loaded as a `data:`
 * background has an opaque origin and cannot reference `blob:`/`http:` hrefs, so
 * for those sources we return `undefined` and the caller keeps plain (non
 * mirrored) repetition.
 *
 * @param src    - The tile image source (must start with `data:`).
 * @param flip   - Tile flip mode (`x` / `y` / `xy`).
 * @param scaleX - Per-tile horizontal size as a percentage (e.g. 100 = 100%).
 * @param scaleY - Per-tile vertical size as a percentage.
 * @returns The composite `backgroundImage` + doubled `backgroundSize`, or
 *          `undefined` when no mirror applies / the source is not embeddable.
 */
export function buildMirrorTiledBackground(
	src: string,
	flip: 'x' | 'y' | 'xy',
	scaleX: number,
	scaleY: number,
): { backgroundImage: string; backgroundSize: string } | undefined {
	if (!src.startsWith('data:')) {
		return undefined;
	}
	const flipX = flip === 'x' || flip === 'xy';
	const flipY = flip === 'y' || flip === 'xy';
	const cols = flipX ? 2 : 1;
	const rows = flipY ? 2 : 1;

	const images: string[] = [];
	for (let cy = 0; cy < rows; cy++) {
		for (let cx = 0; cx < cols; cx++) {
			const mirrorX = flipX && cx % 2 === 1;
			const mirrorY = flipY && cy % 2 === 1;
			const sx = mirrorX ? -1 : 1;
			const sy = mirrorY ? -1 : 1;
			// After scale(-1) the unit cell spans [-1,0]; shift it back by +1 so it
			// lands in [0,1], then translate to the target grid cell (cx, cy).
			const tx = cx + (mirrorX ? 1 : 0);
			const ty = cy + (mirrorY ? 1 : 0);
			images.push(
				`<image href="${src}" x="0" y="0" width="1" height="1" ` +
					`preserveAspectRatio="none" transform="translate(${tx},${ty}) scale(${sx},${sy})"/>`,
			);
		}
	}

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" ` +
		`width="${cols}" height="${rows}">${images.join('')}</svg>`;

	return {
		backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
		backgroundSize: `${scaleX * cols}% ${scaleY * rows}%`,
	};
}

export function getImageTilingStyle(element: PptxElement): React.CSSProperties | undefined {
	if (!isImageLikeElement(element) || !isImageTiled(element)) {
		return undefined;
	}
	const scaleX = typeof element.tileScaleX === 'number' ? element.tileScaleX * 100 : 100;
	const scaleY = typeof element.tileScaleY === 'number' ? element.tileScaleY * 100 : 100;
	const offsetX = typeof element.tileOffsetX === 'number' ? element.tileOffsetX : 0;
	const offsetY = typeof element.tileOffsetY === 'number' ? element.tileOffsetY : 0;

	// Tile alignment determines the starting anchor for the tile grid.
	// If explicit offsets are provided, they override the alignment anchor.
	const alignmentPosition = tileAlignmentToCssPosition(element.tileAlignment);
	const hasExplicitOffset = offsetX !== 0 || offsetY !== 0;
	const bgPosition = hasExplicitOffset
		? `${offsetX}px ${offsetY}px`
		: alignmentPosition || `${offsetX}px ${offsetY}px`;

	const src = element.svgData || element.imageData;

	// Tile flip (`a:tile/@flip`): mirror adjacent tiles via a composite SVG tile.
	const flip = element.tileFlip;
	const mirror =
		src && flip && flip !== 'none'
			? buildMirrorTiledBackground(src, flip, scaleX, scaleY)
			: undefined;

	return {
		backgroundImage: mirror ? mirror.backgroundImage : src ? `url(${src})` : undefined,
		backgroundRepeat: 'repeat',
		backgroundSize: mirror ? mirror.backgroundSize : `${scaleX}% ${scaleY}%`,
		backgroundPosition: bgPosition,
		width: '100%',
		height: '100%',
	};
}
