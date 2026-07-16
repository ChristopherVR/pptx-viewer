/**
 * Package-for-sharing export: bundles PPTX file + media assets.
 */

import type { ExportProgressCallback } from './export-helpers';

export { generatePackageReadme } from 'pptx-viewer-shared';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Info about a media asset referenced in the presentation. */
export interface MediaAssetInfo {
	/** Original absolute file path of the media file. */
	sourcePath: string;
	/** Filename to use in the package (e.g. "image1.png"). */
	filename: string;
}

/** Options for the package-for-sharing export. */
export interface PackageExportOptions {
	/** Progress callback: (currentFile, totalFiles). */
	onProgress?: ExportProgressCallback;
	/** AbortSignal to cancel the operation. */
	signal?: AbortSignal;
}

/* ------------------------------------------------------------------ */
/*  Collect media assets                                              */
/* ------------------------------------------------------------------ */

/**
 * Collect media asset paths from the parsed slides.
 * Looks for image, video, and audio elements that have file path references.
 */
export function collectMediaAssets(
	slides: Array<{
		elements?: Array<{
			type?: string;
			src?: string;
			imageSrc?: string;
			mediaSrc?: string;
		}>;
	}>,
): MediaAssetInfo[] {
	const seen = new Set<string>();
	const assets: MediaAssetInfo[] = [];

	for (const slide of slides) {
		if (!slide.elements) {
			continue;
		}
		for (const el of slide.elements) {
			const src = el.imageSrc ?? el.mediaSrc ?? el.src;
			if (!src) {
				continue;
			}
			// Only include file-system paths (not data URLs or blob URLs)
			if (src.startsWith('data:') || src.startsWith('blob:')) {
				continue;
			}
			if (seen.has(src)) {
				continue;
			}
			seen.add(src);
			// Extract filename from path
			const parts = src.replace(/\\/gu, '/').split('/');
			const filename = parts[parts.length - 1] || `media-${assets.length}`;
			assets.push({ sourcePath: src, filename });
		}
	}

	return assets;
}
