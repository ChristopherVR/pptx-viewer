import type {
	MediaPptxElement,
	ParsedTableStyleMap,
	PptxHandler,
	PptxSlide,
} from 'pptx-viewer-core';
import {
	applyImagePathPatches,
	collectAnimationSoundPaths,
	collectImagePaths,
	collectMediaElements,
	resolveMediaElementSource,
	resolveTableCellImageUrls,
	resolveTableStyleImageUrls,
} from 'pptx-viewer-shared';

/**
 * Pure async helpers for the load pipeline, ported from the Vue binding's
 * `useLoadContent` body. Media/image *collection* comes from
 * `pptx-viewer-shared`; these functions add the handler-driven URL
 * resolution and immutable slide patching.
 */

/** Result of resolving audio/video/poster media to displayable URLs. */
export interface ResolvedMedia {
	/** Archive-path -> displayable URL map for media + poster frames. */
	urls: Map<string, string>;
	/** Blob URLs created during resolution (caller owns revocation). */
	blobUrls: string[];
}

/** Revoke any `blob:` URLs in the list (no-op for data URLs). */
export function revokeBlobUrls(urls: Iterable<string>): void {
	for (const url of urls) {
		if (url.startsWith('blob:')) {
			URL.revokeObjectURL(url);
		}
	}
}

/**
 * Resolve audio/video media to Blob URLs and image-like media (poster
 * frames) to data URLs. Marks elements whose media is missing.
 */
export async function resolveMediaUrls(
	handler: PptxHandler,
	slides: PptxSlide[],
): Promise<ResolvedMedia> {
	const mediaElements: MediaPptxElement[] = [];
	for (const slide of slides) {
		collectMediaElements(slide.elements, mediaElements);
	}
	const urls = new Map<string, string>();
	const blobUrls: string[] = [];
	// Shared with the other four bindings (G17): a LINKED media element's
	// `mediaPath` is already the verbatim external URL by the time it reaches
	// here; `resolveMediaElementSource` hands it straight back instead of an
	// archive lookup that can only find embedded parts.
	await Promise.all(
		mediaElements.map(async (mediaElement) => {
			const resolved = await resolveMediaElementSource(mediaElement, handler);
			if (resolved.missing || !resolved.mediaPath || !resolved.url) {
				mediaElement.mediaMissing = true;
				return;
			}
			urls.set(resolved.mediaPath, resolved.url);
			if (resolved.isBlobUrl) {
				blobUrls.push(resolved.url);
			}
		}),
	);

	// Native-animation `p:stSnd` sounds that back no visible media element
	// (PowerPoint's animation sound library) have no entry above; resolve
	// them into the same map so `onPlayActionSound`'s lookup finds them.
	const soundPaths = collectAnimationSoundPaths(slides).filter((path) => !urls.has(path));
	await Promise.all(
		soundPaths.map(async (soundPath) => {
			try {
				const arrayBuffer = await handler.getMediaArrayBuffer(soundPath);
				if (arrayBuffer) {
					const blobUrl = URL.createObjectURL(new Blob([arrayBuffer]));
					blobUrls.push(blobUrl);
					urls.set(soundPath, blobUrl);
				}
			} catch {
				/* Non-critical: the sound simply will not play. */
			}
		}),
	);
	return { urls, blobUrls };
}

/**
 * Resolve lazily-loaded picture URLs and patch them into the slide tree
 * immutably (groups recursed). Returns the input array when nothing changed.
 */
export async function resolveLazyImages(
	handler: PptxHandler,
	slides: PptxSlide[],
): Promise<PptxSlide[]> {
	const { paths, refs } = collectImagePaths(slides);
	if (paths.size === 0) {
		return slides;
	}

	const resolvedMap = new Map<string, string>();
	await Promise.all(
		Array.from(paths).map(async (path) => {
			try {
				const url = await handler.getImageData(path);
				if (url) {
					resolvedMap.set(path, url);
				}
			} catch {
				// Non-critical: image will show as broken.
			}
		}),
	);

	return slides.map((slide) => {
		const newElements = applyImagePathPatches(slide.elements, resolvedMap, refs);
		return newElements === slide.elements ? slide : { ...slide, elements: newElements };
	});
}

/**
 * Resolve lazily-loaded table cell image-fill URLs (`a:tcPr/a:blipFill`) and
 * patch them into the slide tree immutably. Same lazy-load story as
 * {@link resolveLazyImages}, but for a cell's `backgroundImageFillPath`
 * rather than a top-level element field.
 */
export function resolveLazyTableCellImages(
	handler: PptxHandler,
	slides: PptxSlide[],
): Promise<PptxSlide[]> {
	return resolveTableCellImageUrls(slides, (path) => handler.getImageData(path));
}

/**
 * Resolve lazily-loaded whole-table-STYLE image-fill URLs
 * (`a:tcStyle/a:fill/a:blipFill` on `ppt/tableStyles.xml`) and patch them
 * into the table style map immutably. Same lazy-load story as
 * {@link resolveLazyTableCellImages}, but for a presentation-level style
 * section fill rather than a per-cell one.
 */
export function resolveLazyTableStyleImages(
	handler: PptxHandler,
	tableStyleMap: ParsedTableStyleMap | undefined,
): Promise<ParsedTableStyleMap | undefined> {
	return resolveTableStyleImageUrls(tableStyleMap, (path) => handler.getImageData(path));
}
