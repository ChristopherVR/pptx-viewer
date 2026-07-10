import type { MediaPptxElement, PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { collectImagePaths, collectMediaElements } from 'pptx-viewer-shared';

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
	await Promise.all(
		mediaElements.map(async (mediaElement) => {
			const mediaPath = mediaElement.mediaPath;
			if (!mediaPath) {
				mediaElement.mediaMissing = true;
				return;
			}
			try {
				const isAudioVideo =
					mediaElement.mediaType === 'audio' || mediaElement.mediaType === 'video';
				if (isAudioVideo) {
					const arrayBuffer = await handler.getMediaArrayBuffer(mediaPath);
					if (arrayBuffer) {
						const mimeType = mediaElement.mediaMimeType || 'application/octet-stream';
						const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: mimeType }));
						blobUrls.push(blobUrl);
						urls.set(mediaPath, blobUrl);
					} else {
						mediaElement.mediaMissing = true;
					}
				} else {
					const dataUrl = await handler.getImageData(mediaPath);
					if (dataUrl) {
						urls.set(mediaPath, dataUrl);
					} else {
						mediaElement.mediaMissing = true;
					}
				}
			} catch {
				mediaElement.mediaMissing = true;
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

	const elementPatches = new Map<string, Record<string, string>>();
	for (const refEntry of refs) {
		const url = resolvedMap.get(refEntry.path);
		if (!url) {
			continue;
		}
		const id = refEntry.element.id;
		const existing = elementPatches.get(id) ?? {};
		existing[refEntry.field] = url;
		elementPatches.set(id, existing);
	}
	if (elementPatches.size === 0) {
		return slides;
	}

	const patchElements = (elements: PptxElement[]): PptxElement[] => {
		let mutated = false;
		const next = elements.map((el) => {
			let updated = el;
			const patch = elementPatches.get(el.id);
			if (patch) {
				updated = { ...el, ...patch } as PptxElement;
			}
			if (updated.type === 'group' && updated.children?.length) {
				const newChildren = patchElements(updated.children);
				if (newChildren !== updated.children) {
					updated = { ...updated, children: newChildren };
				}
			}
			if (updated !== el) {
				mutated = true;
			}
			return updated;
		});
		return mutated ? next : elements;
	};

	return slides.map((slide) => {
		const newElements = patchElements(slide.elements);
		return newElements === slide.elements ? slide : { ...slide, elements: newElements };
	});
}
