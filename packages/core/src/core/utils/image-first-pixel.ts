/**
 * Synchronous, DOM-free "read the pixel at (0,0)" dispatcher.
 *
 * Exists so `pptx-viewer-shared`'s `chart-bar3d-face-picture-sample.ts` (an
 * untargeted `bar3D` extrusion face whose fill is picture-only samples
 * PowerPoint's own top-left-pixel colour, COM-verified) can resolve that
 * colour on the FIRST render, and in a DOM-less render path (SSR, headless
 * export, a Node MCP tool) where the existing `Image`/`<canvas>` decode never
 * resolves at all. Format sniffing is by magic bytes, not the caller's
 * claimed MIME type, since a mislabelled `c:pictureOptions` blip is not rare.
 *
 * PNG, GIF, BMP and baseline JPEG are decoded here (see the per-format
 * sibling modules). Progressive JPEG, WebP, and EMF/WMF are NOT decoded: the
 * caller's existing async `decodeFirstPixelColor` (`Image` + `<canvas>`,
 * DOM-only) remains the fallback for those, exactly as before this module
 * existed - this function returning `undefined` changes nothing for them.
 *
 * @module image-first-pixel
 */
import { decodeBmpFirstPixel } from './image-first-pixel-bmp';
import { decodeGifFirstPixel } from './image-first-pixel-gif';
import { decodeJpegFirstPixel } from './image-first-pixel-jpeg';
import { decodePngFirstPixel } from './image-first-pixel-png';

/** Format an 0-255 channel as a 2-digit hex pair (matches the async sampler's `#rrggbb` contract). */
function hexChannel(value: number): string {
	return Math.max(0, Math.min(255, Math.round(value)))
		.toString(16)
		.padStart(2, '0');
}

function sniffAndDecode(
	bytes: Uint8Array,
): { r: number; g: number; b: number; a: number } | undefined {
	if (bytes.length < 4) {
		return undefined;
	}
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return decodePngFirstPixel(bytes);
	}
	if (bytes[0] === 0xff && bytes[1] === 0xd8) {
		return decodeJpegFirstPixel(bytes);
	}
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
		return decodeGifFirstPixel(bytes);
	}
	if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
		return decodeBmpFirstPixel(bytes);
	}
	return undefined;
}

/**
 * Decode `bytes`' pixel (0,0) synchronously with no DOM. Returns `undefined`
 * for an unrecognised/unsupported format, a fully transparent pixel, or a
 * decode failure - the caller's existing fallback colour is always used in
 * that case, never a crash.
 */
export function sampleFirstPixelColorFromBytes(bytes: Uint8Array): string | undefined {
	let pixel: { r: number; g: number; b: number; a: number } | undefined;
	try {
		pixel = sniffAndDecode(bytes);
	} catch {
		return undefined;
	}
	if (!pixel || pixel.a === 0) {
		return undefined;
	}
	return `#${hexChannel(pixel.r)}${hexChannel(pixel.g)}${hexChannel(pixel.b)}`;
}
