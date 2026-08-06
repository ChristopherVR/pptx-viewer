/**
 * Pictures stream parsing ([MS-ODRAW] OfficeArtBStoreDelay / BLIP records).
 *
 * The Pictures stream is a sequence of BLIP records. Shape FOPT "pib"
 * properties are 1-based indexes into the OfficeArtBStoreContainer (FBSE
 * list) in the document's drawing group; each FBSE's foDelay field is the
 * byte offset of the BLIP record inside the Pictures stream.
 *
 * Metafile blips (EMF/WMF/PICT) are usually deflate-compressed; they are
 * decompressed with the standard DecompressionStream when available so the
 * emf-converter pipeline can render them downstream.
 *
 * @module ppt/pictures
 */

import type { PptPictureData } from './ppt-model';
import { iterateRecords, readRecord } from './record-stream';
import type { PptRecord } from './record-stream';
import { OA } from './record-types';

interface BlipInfo {
	extension: string;
	isMetafile: boolean;
	/** recInstance value indicating a single UID before the payload. */
	singleUidInstance: number;
}

const BLIP_TYPES: ReadonlyMap<number, BlipInfo> = new Map([
	[OA.BlipEmf, { extension: 'emf', isMetafile: true, singleUidInstance: 0x3d4 }],
	[OA.BlipWmf, { extension: 'wmf', isMetafile: true, singleUidInstance: 0x216 }],
	[OA.BlipPict, { extension: 'pict', isMetafile: true, singleUidInstance: 0x542 }],
	[OA.BlipJpeg, { extension: 'jpg', isMetafile: false, singleUidInstance: 0x46a }],
	[OA.BlipPng, { extension: 'png', isMetafile: false, singleUidInstance: 0x6e0 }],
	[OA.BlipDib, { extension: 'bmp', isMetafile: false, singleUidInstance: 0x7a8 }],
	[OA.BlipTiff, { extension: 'tiff', isMetafile: false, singleUidInstance: 0x6e4 }],
	[OA.BlipJpegCmyk, { extension: 'jpg', isMetafile: false, singleUidInstance: 0x6e2 }],
]);

/** Inflate zlib-wrapped data via the standard DecompressionStream. */
async function inflate(data: Uint8Array): Promise<Uint8Array | undefined> {
	if (typeof DecompressionStream === 'undefined') {
		return undefined;
	}
	try {
		const stream = new Blob([data.slice().buffer as ArrayBuffer])
			.stream()
			.pipeThrough(new DecompressionStream('deflate'));
		const out = new Uint8Array(await new Response(stream).arrayBuffer());
		return out;
	} catch {
		return undefined;
	}
}

/** Wrap a raw DIB (BITMAPINFOHEADER + data) into a BMP file. */
function dibToBmp(dib: Uint8Array): Uint8Array {
	if (dib.length < 40) {
		return dib;
	}
	const view = new DataView(dib.buffer, dib.byteOffset, dib.byteLength);
	const headerSize = view.getUint32(0, true);
	const bitCount = view.getUint16(14, true);
	const compression = view.getUint32(16, true);
	const clrUsed = view.getUint32(32, true);
	let paletteEntries = clrUsed;
	if (paletteEntries === 0 && bitCount <= 8) {
		paletteEntries = 1 << bitCount;
	}
	let offBits = 14 + headerSize + paletteEntries * 4;
	if (compression === 3 && headerSize === 40) {
		offBits += 12; // BI_BITFIELDS masks
	}
	const out = new Uint8Array(14 + dib.length);
	const outView = new DataView(out.buffer);
	out[0] = 0x42; // 'B'
	out[1] = 0x4d; // 'M'
	outView.setUint32(2, out.length, true);
	outView.setUint32(10, offBits, true);
	out.set(dib, 14);
	return out;
}

/** Decode one BLIP record's payload into picture data. */
async function decodeBlip(
	view: DataView,
	data: Uint8Array,
	rec: PptRecord,
): Promise<PptPictureData | undefined> {
	const info = BLIP_TYPES.get(rec.recType);
	if (!info) {
		return undefined;
	}
	const uidCount = rec.recInstance === info.singleUidInstance ? 1 : 2;
	let cursor = rec.dataOffset + uidCount * 16;
	const end = rec.dataOffset + rec.recLen;

	if (info.isMetafile) {
		// Metafile header: cbSize(4) rcBounds(16) ptSize(8) cbSave(4)
		// compression(1) filter(1) = 34 bytes.
		if (cursor + 34 > end) {
			return undefined;
		}
		const compression = view.getUint8(cursor + 32);
		const payload = data.subarray(cursor + 34, end);
		if (compression === 0) {
			const inflated = await inflate(payload);
			if (!inflated) {
				return undefined; // cannot decompress in this runtime
			}
			return { extension: info.extension, bytes: inflated };
		}
		return { extension: info.extension, bytes: payload.slice() };
	}

	cursor += 1; // tag byte
	if (cursor > end) {
		return undefined;
	}
	const payload = data.subarray(cursor, end);
	if (rec.recType === OA.BlipDib) {
		return { extension: 'bmp', bytes: dibToBmp(payload) };
	}
	return { extension: info.extension, bytes: payload.slice() };
}

/**
 * Parse the Pictures stream and the FBSE list, producing the picture
 * collection in pib order.
 *
 * @param pictures - Raw bytes of the Pictures stream (may be undefined).
 * @param bstore - The OfficeArtBStoreContainer record within the document's
 *   drawing group, along with its stream view, when present.
 * @returns Pictures such that `result[pib - 1]` matches the FOPT pib value.
 */
export async function parsePictures(
	pictures: Uint8Array | undefined,
	bstore?: { view: DataView; rec: PptRecord },
): Promise<Array<PptPictureData | undefined>> {
	if (!pictures) {
		return [];
	}
	const view = new DataView(pictures.buffer, pictures.byteOffset, pictures.byteLength);

	// Decode every BLIP found in the stream, keyed by its start offset.
	const byOffset = new Map<number, PptPictureData | undefined>();
	const sequential: Array<PptPictureData | undefined> = [];
	for (const rec of iterateRecords(view, 0, pictures.length)) {
		if (rec.recType >= OA.BlipFirst && rec.recType <= OA.BlipLast) {
			const decoded = await decodeBlip(view, pictures, rec);
			byOffset.set(rec.headerOffset, decoded);
			sequential.push(decoded);
		}
	}

	if (!bstore) {
		return sequential;
	}

	// Map FBSE entries (pib order) onto decoded blips via foDelay offsets.
	const result: Array<PptPictureData | undefined> = [];
	const bview = bstore.view;
	let offset = bstore.rec.dataOffset;
	const end = bstore.rec.dataOffset + bstore.rec.recLen;
	while (offset + 8 <= end) {
		const rec = readRecord(bview, offset);
		if (!rec || rec.dataOffset + rec.recLen > end) {
			break;
		}
		if (rec.recType === OA.FBSE && rec.recLen >= 36) {
			const foDelay = bview.getUint32(rec.dataOffset + 28, true);
			result.push(byOffset.get(foDelay) ?? sequential[result.length]);
		} else if (rec.recType >= OA.BlipFirst && rec.recType <= OA.BlipLast) {
			// A blip stored directly in the BStore.
			const bytes = new Uint8Array(bview.buffer, bview.byteOffset, bview.byteLength);
			result.push(await decodeBlip(bview, bytes, rec));
		}
		offset = rec.dataOffset + rec.recLen;
	}
	return result.length > 0 ? result : sequential;
}
