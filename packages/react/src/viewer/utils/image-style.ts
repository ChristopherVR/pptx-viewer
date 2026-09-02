import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement, hasShapeProperties } from 'pptx-viewer-core';
import {
	getComputedFillStyle,
	getCropShapeClipPath as sharedGetCropShapeClipPath,
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

/**
 * "Crop to Shape" clip-path for a picture (`element.cropShape`). Routes
 * through `pptx-viewer-shared`'s adjustment-aware preset cascade (the same
 * one shapes use) rather than a small fixed polygon table, so every crop
 * shape PowerPoint's gallery offers renders correctly instead of degrading
 * (a fixed 12% corner radius for `roundedRect`, a 10-point outline instead of
 * the real 5-point star for `star`).
 */
export function getCropShapeClipPath(element: PptxElement): string | undefined {
	if (!isImageLikeElement(element)) {
		return undefined;
	}
	return sharedGetCropShapeClipPath(element.cropShape, element.width, element.height);
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
