import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement, hasShapeProperties } from 'pptx-viewer-core';
import {
	getComputedFillStyle,
	getImageFitStyle,
	getImageTilingStyle as sharedGetImageTilingStyle,
	resolveShapeGeometry,
} from 'pptx-viewer-shared';
/**
 * Image mask, render style, crop shape, and tiling helpers
 * for the PowerPoint editor.
 */
import type React from 'react';

// ---------------------------------------------------------------------------
// Image mask / render style helpers
// ---------------------------------------------------------------------------

export function getImageMaskStyle(element: PptxElement): React.CSSProperties | undefined {
	if (!hasShapeProperties(element)) {
		return undefined;
	}
	const geometry = resolveShapeGeometry(element);
	if (geometry.kind === 'borderRadius') {
		return { borderRadius: geometry.radius };
	}
	return geometry.kind === 'clipPath' ? { clipPath: geometry.clipPath } : undefined;
}

/**
 * The `<img>` style for a picture: its shape mask plus the shared fill/crop fit.
 *
 * The fit half lives in `pptx-viewer-shared` because every binding needs the
 * identical `<a:srcRect>` maths; only the mask (which depends on React's
 * resolved-clip-path helpers) stays here.
 */
export function getImageRenderStyle(element: PptxElement): React.CSSProperties {
	const fit = getImageFitStyle(element) as React.CSSProperties;
	return {
		// A translated/scaled crop must be masked by its stationary wrapper, not
		// by the moving bitmap itself.
		...(fit.transform ? {} : getImageMaskStyle(element) || {}),
		...fit,
	};
}

/** The stationary mask shared by a picture surface and its effect overlays. */
export function getImageSurfaceMaskStyle(element: PptxElement): React.CSSProperties {
	const mask = getImageMaskStyle(element);
	return {
		overflow: 'hidden',
		borderRadius: mask?.borderRadius,
		clipPath: mask?.clipPath ?? getCropShapeClipPath(element),
	};
}

/** Stationary picture surface that owns the preset/crop mask and authored fill. */
export function getImageSurfaceStyle(element: PptxElement): React.CSSProperties {
	const fill = hasShapeProperties(element) ? getComputedFillStyle(element) : undefined;
	return {
		position: 'absolute',
		inset: 0,
		...getImageSurfaceMaskStyle(element),
		backgroundColor: fill?.backgroundColor ?? 'transparent',
		backgroundImage: fill?.backgroundImage,
		backgroundRepeat: fill?.backgroundRepeat,
		backgroundSize: fill?.backgroundSize,
		backgroundPosition: fill?.backgroundPosition,
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
