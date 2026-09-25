/**
 * Data-URL -> embeddable bytes for the `.ppt` writer's picture and sound
 * handling.
 *
 * A picture data URL is decoded and handed to `picture-encode.ts`, which
 * sniffs the actual bytes (not the MIME type, which is often generic or
 * wrong) and maps PNG/JPEG/GIF/BMP/EMF/WMF onto a BLIP. TIFF and a bare SVG
 * have no synchronous path; `picture-resolve.ts` pre-resolves a TIFF
 * asynchronously, and an SVG picture carries its own PNG fallback in
 * `imageData`.
 *
 * @module ppt/writer/raster-utils
 */

import { base64Decode } from '../../utils/ooxml-crypto-primitives';
import { bytesToPicture } from './picture-encode';
import type { WPictureData } from './write-model';

/**
 * Decode a `data:audio/wav;base64,...` (or `x-wav`/`wave`) URL into raw WAV
 * bytes, or `undefined` when the MIME type is not WAV. The binary `.ppt`
 * `SoundDataBlob` record ([MS-PPT] 2.4.16.5, see `media-writer.ts`) embeds
 * WAV/AIFF only; other audio containers (MP3, AAC, OGG, ...) have no direct
 * `.ppt` equivalent, so callers degrade those to a picture with a
 * compatibility warning, exactly as PowerPoint's own 97-2003 SaveAs does.
 */
export function dataUrlToWav(dataUrl: string | undefined): Uint8Array | undefined {
	if (!dataUrl) {
		return undefined;
	}
	const match = /^data:audio\/(?:x-)?wave?;base64,(.+)$/isu.exec(dataUrl);
	if (!match) {
		return undefined;
	}
	try {
		return base64Decode(match[1]!);
	} catch {
		return undefined;
	}
}

/** Decode a base64 `data:` URL's payload, or `undefined` when it is not one. */
export function decodeBase64DataUrl(dataUrl: string | undefined): Uint8Array | undefined {
	const match = dataUrl ? /^data:[^;,]*(?:;[^;,]*)*;base64,(.+)$/isu.exec(dataUrl) : null;
	if (!match) {
		return undefined;
	}
	try {
		return base64Decode(match[1]!);
	} catch {
		return undefined;
	}
}

/**
 * Decode a `data:image/...;base64,...` URL into embeddable picture bytes,
 * or `undefined` when the payload is not a format `bytesToPicture` embeds.
 */
export function dataUrlToPicture(dataUrl: string | undefined): WPictureData | undefined {
	const bytes = decodeBase64DataUrl(dataUrl);
	return bytes ? bytesToPicture(bytes) : undefined;
}
