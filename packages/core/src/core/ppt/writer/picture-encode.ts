/**
 * Image bytes -> `.ppt`-embeddable picture ([MS-ODRAW] 2.2.23 BLIP) for the
 * legacy binary writer.
 *
 * Mirrors what PowerPoint 16.0's own "Save as PowerPoint 97-2003" does,
 * COM-measured by saving a deck holding one picture of each format and
 * reading the `Pictures` stream back:
 *
 * - PNG and JPEG embed as-is.
 * - EMF embeds natively as an `OfficeArtBlipEMF`, `rcBounds` copied from the
 *   EMF header's `rclBounds`, zlib-wrapped (compression `0x00`). `ptSize` is
 *   the true `rclFrame` size in EMU; PowerPoint's own value is scaled by the
 *   recording device's DPI, which only affects its "reset picture size".
 * - GIF, TIFF and an SVG are stored as PNG, as PowerPoint does (BLIP has no
 *   GIF or SVG type, and PowerPoint does not keep TIFF).
 * - WMF embeds natively as an `OfficeArtBlipWMF`, with its 22-byte
 *   placeable ("Aldus") header stripped and carried as `rcBounds`/`ptSize`
 *   instead: header-for-header identical to PowerPoint's own output
 *   (`ppt-writer-picture-formats.test.ts`), and read back by `pictures.ts`.
 * - BMP embeds natively as an `OfficeArtBlipDIB` (the file minus its
 *   14-byte `BITMAPFILEHEADER`). PowerPoint itself never holds a BMP by the
 *   time it saves (its own `AddPicture` converts BMP to PNG on insert), so
 *   there is no PowerPoint-written counterpart; the DIB BLIP is the
 *   format's documented binary form, and PowerPoint reopens it as a picture.
 *
 * TIFF needs an async decoder (`utif` is loaded on demand), so it is
 * handled by `picture-resolve.ts`, not here.
 *
 * @module ppt/writer/picture-encode
 */

import { decodeGifFirstFrame } from '../../utils/gif-decode';
import { encodePng } from '../../utils/png-encoder';
import type { WPictureData } from './write-model';

/** An image container format, sniffed from its leading bytes. */
export type SniffedImageFormat = 'png' | 'jpeg' | 'gif' | 'bmp' | 'tiff' | 'emf' | 'wmf' | 'svg';

/** Identify an image by its magic bytes (not by a file extension or MIME type). */
export function sniffImageFormat(bytes: Uint8Array): SniffedImageFormat | undefined {
	const b = bytes;
	if (b.length < 4) {
		return undefined;
	}
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
		return 'png';
	}
	if (b[0] === 0xff && b[1] === 0xd8) {
		return 'jpeg';
	}
	if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
		return 'gif';
	}
	if (b[0] === 0x42 && b[1] === 0x4d) {
		return 'bmp';
	}
	if (
		(b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) ||
		(b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)
	) {
		return 'tiff';
	}
	if (
		b.length >= 44 &&
		b[0] === 1 &&
		b[1] === 0 &&
		b[2] === 0 &&
		b[3] === 0 &&
		b[40] === 0x20 &&
		b[41] === 0x45
	) {
		return 'emf'; // EMR_HEADER (type 1) with the " EMF" signature at offset 40
	}
	if (
		(b[0] === 0xd7 && b[1] === 0xcd && b[2] === 0xc6 && b[3] === 0x9a) ||
		(b[0] <= 2 && b[1] === 0 && b[2] === 9 && b[3] === 0)
	) {
		return 'wmf'; // placeable header, or a bare META_HEADER (type 1/2, headerSize 9)
	}
	const head = new TextDecoder().decode(b.subarray(0, Math.min(b.length, 512))).trimStart();
	if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
		return 'svg';
	}
	return undefined;
}

const EMU_PER_HUNDREDTH_MM = 360;
const EMU_PER_INCH = 914400;

/** Build an EMF BLIP payload: bounds from `rclBounds`, size from `rclFrame` (0.01 mm). */
function emfPicture(bytes: Uint8Array): WPictureData {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const bounds = [8, 12, 16, 20].map((offset) => view.getInt32(offset, true)) as [
		number,
		number,
		number,
		number,
	];
	const frameW = view.getInt32(32, true) - view.getInt32(24, true);
	const frameH = view.getInt32(36, true) - view.getInt32(28, true);
	return {
		extension: 'emf',
		bytes,
		metafile: {
			bounds,
			widthEmu: Math.max(0, frameW) * EMU_PER_HUNDREDTH_MM,
			heightEmu: Math.max(0, frameH) * EMU_PER_HUNDREDTH_MM,
		},
	};
}

/** Build a WMF BLIP payload, moving a placeable header's bounding box into the metafile header. */
function wmfPicture(bytes: Uint8Array): WPictureData {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (view.getUint32(0, true) !== 0x9ac6cdd7 || bytes.length < 22) {
		return {
			extension: 'wmf',
			bytes,
			metafile: { bounds: [0, 0, 0, 0], widthEmu: 0, heightEmu: 0 },
		};
	}
	const left = view.getInt16(6, true);
	const top = view.getInt16(8, true);
	const right = view.getInt16(10, true);
	const bottom = view.getInt16(12, true);
	const inch = view.getUint16(14, true) || 1440;
	return {
		extension: 'wmf',
		bytes: bytes.subarray(22),
		metafile: {
			bounds: [left, top, right, bottom],
			widthEmu: Math.round(((right - left) * EMU_PER_INCH) / inch),
			heightEmu: Math.round(((bottom - top) * EMU_PER_INCH) / inch),
		},
	};
}

/**
 * Strip a BMP's `BITMAPFILEHEADER`, closing any gap between the colour
 * table and the pixel array (`bfOffBits`), since a DIB BLIP holds a packed
 * DIB whose pixels start right after the header and colour table.
 */
function bmpToDib(bytes: Uint8Array): WPictureData | undefined {
	if (bytes.length < 54) {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const offBits = view.getUint32(10, true);
	const headerSize = view.getUint32(14, true);
	const bitCount = view.getUint16(28, true);
	const compression = view.getUint32(30, true);
	let paletteEntries = headerSize >= 40 ? view.getUint32(46, true) : 0;
	if (paletteEntries === 0 && bitCount <= 8) {
		paletteEntries = 1 << bitCount;
	}
	const masks = compression === 3 && headerSize === 40 ? 12 : 0;
	const packedHeaderEnd = 14 + headerSize + masks + paletteEntries * 4;
	if (offBits < packedHeaderEnd || offBits > bytes.length) {
		return { extension: 'dib', bytes: bytes.subarray(14) };
	}
	const dib = new Uint8Array(packedHeaderEnd - 14 + (bytes.length - offBits));
	dib.set(bytes.subarray(14, packedHeaderEnd), 0);
	dib.set(bytes.subarray(offBits), packedHeaderEnd - 14);
	return { extension: 'dib', bytes: dib };
}

/** Re-encode a GIF's first frame as PNG (PowerPoint's own 97-2003 choice). */
function gifToPng(bytes: Uint8Array): WPictureData | undefined {
	const frame = decodeGifFirstFrame(bytes);
	return frame
		? { extension: 'png', bytes: encodePng(frame.width, frame.height, frame.rgba) }
		: undefined;
}

/**
 * Convert raw image bytes into an embeddable picture, or `undefined` when
 * the format has no synchronous path (TIFF: see `picture-resolve.ts`; SVG:
 * the element's own PNG fallback is used instead) or is unrecognised.
 */
export function bytesToPicture(bytes: Uint8Array): WPictureData | undefined {
	switch (sniffImageFormat(bytes)) {
		case 'png':
			return { extension: 'png', bytes };
		case 'jpeg':
			return { extension: 'jpg', bytes };
		case 'emf':
			return emfPicture(bytes);
		case 'wmf':
			return wmfPicture(bytes);
		case 'bmp':
			return bmpToDib(bytes);
		case 'gif':
			return gifToPng(bytes);
		default:
			return undefined;
	}
}
