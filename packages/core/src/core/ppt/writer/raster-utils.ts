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
