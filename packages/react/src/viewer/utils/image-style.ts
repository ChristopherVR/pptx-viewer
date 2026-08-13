import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement, hasShapeProperties } from 'pptx-viewer-core';
import {
	getImageFitStyle,
	getImageTilingStyle as sharedGetImageTilingStyle,
} from 'pptx-viewer-shared';
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

/**
 * `a:blipFill/a:tile` rendering (scale / offset / alignment / mirror-flip) moved
 * to `pptx-viewer-shared` (`render/image-tiling`), because nothing in it was
 * React-specific and the other four bindings were drawing every tiled texture as
 * one stretched copy for want of it. Re-exported here under the historical
 * symbol names React consumers already import.
 */
export { isImageTiled, buildMirrorTiledBackground } from 'pptx-viewer-shared';

/** The tiled-picture background layer, re-typed as `React.CSSProperties`. */
export function getImageTilingStyle(element: PptxElement): React.CSSProperties | undefined {
	return sharedGetImageTilingStyle(element) as React.CSSProperties | undefined;
}
