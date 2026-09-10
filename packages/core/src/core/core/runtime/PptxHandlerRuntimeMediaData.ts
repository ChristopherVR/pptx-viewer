import { convertEmfToDataUrl, convertWmfToDataUrl } from 'emf-converter';

import { resolveNativeAnimationThemeColors } from '../../services/native-animation-theme-colors';
import { XmlObject, PptxElement } from '../../types';
import type { PptxNativeAnimation } from '../../types';
import { blobUrlToDataUrl } from './blob-url-to-data-url';
import type { MediaTimingData } from './PptxHandlerRuntimeImageEffects';
import { requiresBase64DataUrl } from './PptxHandlerRuntimeMediaParsingUtils';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeMediaTimingParsing';
import { decodeTiffToPngBlob } from './tiff-to-png';

// Re-exported for backward compatibility: existing callers/tests import this
// from here rather than from `tiff-to-png.ts` directly.
export { decodeTiffToPngBlob } from './tiff-to-png';

/**
 * Whether the current environment supports Blob URLs.
 * Falls back to base64 data URIs in Node.js / non-browser runtimes.
 */
const CAN_USE_BLOB_URLS =
	typeof globalThis.URL?.createObjectURL === 'function' && typeof globalThis.Blob !== 'undefined';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Forward declaration implemented later in the runtime inheritance chain. */
	protected resolveThemeColor(_schemeKey: string): string | undefined {
		return undefined;
	}

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

			if (ext === 'tif' || ext === 'tiff') {
				const binaryBuffer = await imageFile.async('arraybuffer');
				const pngBlob = await decodeTiffToPngBlob(binaryBuffer);
				if (pngBlob) {
					const converted = this.createImageUrl(await pngBlob.arrayBuffer(), 'image/png');
					this.imageDataCache.set(imagePath, converted);
					return converted;
				}
				// A non-browser runtime has no canvas. Preserve the existing raw-TIFF
				// fallback instead of turning a formerly returned image into undefined.
				const imageData = this.createImageUrl(binaryBuffer, this.getImageMimeType(imagePath));
				this.imageDataCache.set(imagePath, imageData);
				return imageData;
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
	 * Same resolution as {@link getImageData}, but guarantees a `data:` URL
	 * even in a browser (where `getImageData` normally mints a `blob:` URL to
	 * avoid the base64 overhead). Used by chart picture-fill resolution
	 * (`chart-datapoint-picture-resolver.ts`): `pptx-viewer-shared`'s
	 * `resolveBarFacePicturePixelColor` needs to decode an untargeted `bar3D`
	 * face's picture pixel SYNCHRONOUSLY (`parseDataUrlToBytes`), which only a
	 * `data:` URL supports; ordinary slide/background pictures are unaffected
	 * and keep using blob URLs via `getImageData`. See `blob-url-to-data-url.ts`
	 * for the re-fetch+re-encode fallback this only pays on the `blob:` branch.
	 */
	async getImageDataAsDataUrl(imagePath: string): Promise<string | undefined> {
		const resolved = await this.getImageData(imagePath);
		if (!resolved || !resolved.startsWith('blob:')) {
			return resolved;
		}
		return blobUrlToDataUrl(resolved, this.getImageMimeType(imagePath));
	}

	/**
	 * Enrich parsed media elements with timing data from the slide's
	 * `p:timing` tree (loop, volume, poster frame, fullScreen, autoPlay,
	 * playAcrossSlides, hideWhenNotPlaying). Trim, fade, bookmarks and the
	 * `p14:media` embed fallback are already set by `parsePicture` (they live
	 * under the picture's own `p:nvPr/p:extLst`, not the timing tree; see G18
	 * in `PptxHandlerRuntimeMediaTimingParsing.ts`), so this only fills in the
	 * genuine `p:cMediaNode` flags without clobbering them.
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

			// Apply the genuine `p:cMediaNode`/`p:cTn` flags. Trim, fade,
			// bookmarks, playback speed and the `p14:media` embed fallback are
			// NOT merged here: `parsePicture` already set them from the
			// picture's own `p:nvPr/p:extLst`, the real location PowerPoint
			// writes `p14:media` (G18). `timingMap` no longer carries those
			// fields, so there is nothing to merge and nothing to clobber.
			if (timing.fullScreen !== undefined) {
				el.fullScreen = timing.fullScreen;
			}
			if (timing.loop !== undefined) {
				el.loop = timing.loop;
			}
			if (timing.volume !== undefined) {
				el.volume = timing.volume;
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

		// Also check inside groups, at every level: the walk recurses (bounded by
		// MAX_TIMING_DEPTH above), so media inside a group inside a group is
		// enriched too.
		for (const el of elements) {
			if (el.type === 'group' && el.children) {
				await this.enrichMediaElementsWithTiming(el.children, timingMap, depth + 1);
			}
		}
	}

	/**
	 * Parse native OOXML animations from `p:sld/p:timing`.
	 * Extracts trigger types, preset classes, durations, and target IDs, then
	 * resolves each effect's `p:stSnd` relationship id to a real archive path
	 * (`soundPath`) via `resolveRelationshipTarget` (the same resolver
	 * `enrichMediaElementsWithTiming`'s poster-frame lookup above uses):
	 * `soundRId` alone is a dangling reference the playback layer cannot use, so
	 * the animation model round-tripped it but the viewer never actually played
	 * anything.
	 */
	protected parseNativeAnimations(
		slideXml: XmlObject,
		slidePath: string,
	): PptxNativeAnimation[] | undefined {
		const parsedAnimations = this.nativeAnimationService.parseNativeAnimations(slideXml);
		if (!parsedAnimations) {
			return undefined;
		}
		const animations = resolveNativeAnimationThemeColors(parsedAnimations, (token) =>
			this.resolveThemeColor(token),
		);
		for (const anim of animations) {
			if (anim.soundRId) {
				anim.soundPath = this.resolveRelationshipTarget(slidePath, anim.soundRId);
			}
		}
		return animations;
	}
}
