/**
 * Data-URL -> embeddable raster bytes for the `.ppt` writer's picture
 * handling. Only PNG and JPEG are embedded as-is; every other format (GIF,
 * BMP, SVG, WEBP, ...) has no direct binary-`.ppt` BLIP counterpart cheaply
 * reachable without a DOM/canvas re-encode, so callers degrade those to a
 * placeholder shape with a compatibility warning instead.
 *
 * @module ppt/writer/raster-utils
 */

import { base64Decode } from '../../utils/ooxml-crypto-primitives';
import type { WPictureData } from './write-model';

/**
 * Decode a `data:audio/wav;base64,...` (or `x-wav`/`wave`) URL into raw WAV
 * bytes, or `undefined` when the MIME type is not WAV. The binary `.ppt`
 * `SoundDataBlob` record ([MS-PPT] 2.4.16.5, see `media-writer.ts`) embeds
 * WAV/AIFF only; other audio containers (MP3, AAC, OGG, ...) have no direct
 * `.ppt` equivalent, so callers degrade those to a placeholder with a
 * compatibility warning, mirroring `dataUrlToPicture`'s PNG/JPEG-only rule.
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

/**
 * Decode a `data:image/...;base64,...` URL into embeddable picture bytes,
 * or `undefined` when the MIME type is not PNG/JPEG.
 */
export function dataUrlToPicture(dataUrl: string | undefined): WPictureData | undefined {
	if (!dataUrl) {
		return undefined;
	}
	const match = /^data:image\/(png|jpe?g);base64,(.+)$/isu.exec(dataUrl);
	if (!match) {
		return undefined;
	}
	const extension = match[1]!.toLowerCase().startsWith('png') ? 'png' : 'jpg';
	try {
		return { extension, bytes: base64Decode(match[2]!) };
	} catch {
		return undefined;
	}
}
