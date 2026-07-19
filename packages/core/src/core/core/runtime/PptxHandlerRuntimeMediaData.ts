import { convertEmfToDataUrl, convertWmfToDataUrl } from 'emf-converter';

import { XmlObject, PptxElement } from '../../types';
import type { PptxNativeAnimation } from '../../types';
import type { MediaTimingData } from './PptxHandlerRuntimeImageEffects';
import { requiresBase64DataUrl } from './PptxHandlerRuntimeMediaParsingUtils';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeMediaTimingParsing';

/**
 * Whether the current environment supports Blob URLs.
 * Falls back to base64 data URIs in Node.js / non-browser runtimes.
 */
const CAN_USE_BLOB_URLS =
	typeof globalThis.URL?.createObjectURL === 'function' && typeof globalThis.Blob !== 'undefined';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Convert raw image bytes to a URL suitable for <img src>.
	 * Uses Blob URLs in browsers (avoids 33% base64 overhead),
	 * falls back to data URIs in Node.js.
	 */
	private createImageUrl(bytes: ArrayBuffer, mimeType: string): string {
		if (CAN_USE_BLOB_URLS && !requiresBase64DataUrl(mimeType)) {
			// Wrap in a fresh Uint8Array to satisfy the BlobPart constraint
			// (ArrayBuffer is always accepted, but TS strict mode can complain
			// about SharedArrayBuffer in Uint8Array.buffer).
			const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
			const blobUrl = URL.createObjectURL(blob);
			this.blobUrlCache.add(blobUrl);
			return blobUrl;
		}
		// Fallback: base64 data URI for non-browser environments
		const uint8 = new Uint8Array(bytes);
		let binary = '';
		for (let i = 0; i < uint8.length; i++) {
			binary += String.fromCharCode(uint8[i]);
		}
		return `data:${mimeType};base64,${btoa(binary)}`;
	}

	async getImageData(imagePath: string): Promise<string | undefined> {
		if (!imagePath) {
			return undefined;
		}
		const ext = this.getPathExtension(imagePath);

		// Load H3: gate external URLs behind the `allowExternalImages` load
		// option (default false). Returning `undefined` for external targets
		// blocks SSRF / privacy-leak vectors when an attacker controls a
		// relationship's TargetMode="External" Target.
		if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
			if (this.allowExternalImages !== true) {
				return undefined;
			}
			return imagePath;
		}
		if (imagePath.startsWith('data:')) {
			return imagePath;
		}

		if (this.imageDataCache.has(imagePath)) {
			return this.imageDataCache.get(imagePath);
		}

		const imageFile = this.zip.file(imagePath);
		if (!imageFile) {
			console.warn(`[pptx] Image file not found in archive: ${imagePath}`);
			return undefined;
		}

		try {
			if (ext === 'emf' || ext === 'wmf') {
				const binaryBuffer = await imageFile.async('arraybuffer');

				const converted =
					ext === 'emf'
						? await convertEmfToDataUrl(binaryBuffer)
						: await convertWmfToDataUrl(binaryBuffer);
				if (converted) {
					this.imageDataCache.set(imagePath, converted);
					return converted;
				}

				// Fallback: try to find a PNG preview with the same base name
				// PowerPoint often embeds image1.emf alongside image1.png
				const basePath = imagePath.replace(/\.[^.]+$/, '');
				for (const fallbackExt of ['png', 'jpg', 'jpeg', 'gif']) {
					const fallbackPath = `${basePath}.${fallbackExt}`;
					const fallbackFile = this.zip.file(fallbackPath);
					if (fallbackFile) {
						try {
							const fallbackBytes = await fallbackFile.async('arraybuffer');
							const mimeType = fallbackExt === 'jpg' ? 'image/jpeg' : `image/${fallbackExt}`;
							const fallbackData = this.createImageUrl(fallbackBytes, mimeType);
							this.imageDataCache.set(imagePath, fallbackData);
							return fallbackData;
						} catch {
							// Continue to next fallback
						}
					}
				}

				return undefined;
			}

			const imageBytes = await imageFile.async('arraybuffer');
			const imageData = this.createImageUrl(imageBytes, this.getImageMimeType(imagePath));
			this.imageDataCache.set(imagePath, imageData);
			return imageData;
		} catch (err) {
			console.warn(`[pptx] Failed to load image: ${imagePath}`, err);
			return undefined;
		}
	}

	/**
	 * Enrich parsed media elements with timing data from the slide's
	 * `p:timing` tree (trim, loop, poster frame, fullScreen).
	 */
	protected async enrichMediaElementsWithTiming(
		elements: PptxElement[],
		timingMap: Map<string, MediaTimingData>,
		depth: number = 0,
	): Promise<void> {
		// Load H1: cap recursion depth on group-children traversal to prevent
		// stack-overflow DoS from a maliciously deep group tree (defence in
		// depth — `parseGroupShape` already caps construction at 64, but this
		// method is reachable via other paths and merits its own bound).
		const MAX_TIMING_DEPTH = 32;
		if (depth > MAX_TIMING_DEPTH) {
			return;
		}
		for (const el of elements) {
			if (el.type !== 'media') {
				continue;
			}
			const spid = this.getXmlShapeId(el.rawXml as XmlObject | undefined);
			if (!spid) {
				continue;
			}

			const timing = timingMap.get(spid);
			if (!timing) {
				continue;
			}

			// Fall back to the p14:media embedded source when the element was
			// referenced only through the p14 extension (no primary media path).
			if (
				timing.mediaEmbedPath &&
				(typeof el.mediaPath !== 'string' || el.mediaPath.length === 0)
			) {
				el.mediaPath = timing.mediaEmbedPath;
				el.mediaMimeType = this.getImageMimeType(timing.mediaEmbedPath);
			}

			// Apply trim, loop, and fullScreen data
			if (timing.trimStartMs !== undefined) {
				el.trimStartMs = timing.trimStartMs;
			}
			if (timing.trimEndMs !== undefined) {
				el.trimEndMs = timing.trimEndMs;
			}
			if (timing.fullScreen !== undefined) {
				el.fullScreen = timing.fullScreen;
			}
			if (timing.loop !== undefined) {
				el.loop = timing.loop;
			}

			// New media properties
			if (timing.volume !== undefined) {
				el.volume = timing.volume;
			}
			if (timing.fadeInDuration !== undefined) {
				el.fadeInDuration = timing.fadeInDuration;
			}
			if (timing.fadeOutDuration !== undefined) {
				el.fadeOutDuration = timing.fadeOutDuration;
			}
			if (timing.autoPlay !== undefined) {
				el.autoPlay = timing.autoPlay;
			}
			if (timing.playAcrossSlides !== undefined) {
				el.playAcrossSlides = timing.playAcrossSlides;
			}
			if (timing.hideWhenNotPlaying !== undefined) {
				el.hideWhenNotPlaying = timing.hideWhenNotPlaying;
			}
			if (timing.bookmarks !== undefined && timing.bookmarks.length > 0) {
				el.bookmarks = timing.bookmarks;
			}
			if (timing.playbackSpeed !== undefined) {
				el.playbackSpeed = timing.playbackSpeed;
			}

			// Load poster frame image data if available
			if (timing.posterFramePath) {
				el.posterFramePath = timing.posterFramePath;
				try {
					const posterData = await this.getImageData(timing.posterFramePath);
					if (posterData) {
						el.posterFrameData = posterData;
					}
				} catch {
					// Non-critical: poster frame is optional
				}
			}
		}

		// Also check inside groups (one level deep)
		for (const el of elements) {
			if (el.type === 'group' && el.children) {
				await this.enrichMediaElementsWithTiming(el.children, timingMap, depth + 1);
			}
		}
	}

	/**
	 * Parse native OOXML animations from `p:sld/p:timing`.
	 * Extracts trigger types, preset classes, durations, and target IDs.
	 */
	protected parseNativeAnimations(slideXml: XmlObject): PptxNativeAnimation[] | undefined {
		return this.nativeAnimationService.parseNativeAnimations(slideXml);
	}
}
