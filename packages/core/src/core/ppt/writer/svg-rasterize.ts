/**
 * Browser-only SVG -> PNG rasteriser for the `.ppt` writer.
 *
 * A binary `.ppt` has no SVG BLIP, so an SVG picture needs a raster. When
 * the picture carries its own PNG fallback (`a:blip r:embed` next to
 * `asvg:svgBlip`) that fallback is embedded; but PowerPoint itself writes an
 * SVG picture with NO fallback (COM-measured: `Shapes.AddPicture` of an
 * `.svg`, then SaveAs `.pptx`, leaves a bare `<a:blip>` holding only the
 * `svgBlip` extension), and its own 97-2003 SaveAs then rasterises the SVG
 * to a PNG at twice the SVG's intrinsic size. This does the same through
 * the DOM's own SVG renderer, and returns `undefined` in a runtime without
 * one (Node), where the caller degrades to a placeholder with a warning.
 *
 * @module ppt/writer/svg-rasterize
 */

import type { WPictureData } from './write-model';

/** Longest edge, in pixels, a rasterised SVG is clamped to. */
const MAX_EDGE_PX = 2048;

function hasDomRasteriser(): boolean {
	return (
		typeof document !== 'undefined' &&
		typeof Image !== 'undefined' &&
		typeof URL !== 'undefined' &&
		typeof URL.createObjectURL === 'function'
	);
}

function loadImage(url: string): Promise<HTMLImageElement | undefined> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(undefined);
		img.src = url;
	});
}

/**
 * Rasterise SVG bytes to PNG, at twice the SVG's intrinsic size (or the
 * given fallback size when it declares none), or `undefined` without a DOM.
 */
export async function rasterizeSvg(
	svg: Uint8Array,
	fallbackWidthPx: number,
	fallbackHeightPx: number,
): Promise<WPictureData | undefined> {
	if (!hasDomRasteriser()) {
		return undefined;
	}
	const url = URL.createObjectURL(new Blob([svg.slice()], { type: 'image/svg+xml' }));
	try {
		const img = await loadImage(url);
		if (!img) {
			return undefined;
		}
		const baseW = img.naturalWidth || fallbackWidthPx;
		const baseH = img.naturalHeight || fallbackHeightPx;
		const scale = Math.min(2, MAX_EDGE_PX / Math.max(baseW, baseH, 1));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(baseW * scale));
		canvas.height = Math.max(1, Math.round(baseH * scale));
		const context = canvas.getContext('2d');
		if (!context) {
			return undefined;
		}
		context.drawImage(img, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, 'image/png');
		});
		return blob ? { extension: 'png', bytes: new Uint8Array(await blob.arrayBuffer()) } : undefined;
	} catch {
		return undefined;
	} finally {
		URL.revokeObjectURL(url);
	}
}
