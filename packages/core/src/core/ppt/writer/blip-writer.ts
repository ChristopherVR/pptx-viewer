/**
 * BLIP record ([MS-ODRAW] 2.2.23-2.2.31) and `OfficeArtFBSE` writers for
 * the `.ppt` picture store (`bstore-writer.ts`), the inverse of
 * `pictures.ts`'s `decodeBlip`.
 *
 * Raster BLIPs (PNG, JPEG, DIB) are `rgbUid` + a one-byte tag + the file
 * data. Metafile BLIPs (EMF, WMF) are `rgbUid` + an
 * `OfficeArtMetafileHeader` (uncompressed size, `rcBounds`, `ptSize` in EMU,
 * saved size, compression, filter) + the metafile, zlib-wrapped: PowerPoint
 * writes compression `0x00` (DEFLATE) with filter `0xFE`, which this writer
 * matches using DEFLATE "stored" blocks (a valid DEFLATE stream every
 * reader inflates, so no compressor is needed).
 *
 * The `btWin32`/`btMacOS` FBSE pair follows PowerPoint's own output:
 * a raster type repeats in both slots, while a metafile's Mac slot is
 * `msoblipPICT` (COM-measured on an EMF: `02 04`).
 *
 * @module ppt/writer/blip-writer
 */

import { md4 } from '../../utils/digests';
import { zlibStore } from '../../utils/png-encoder';
import { OA } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import type { WPictureData } from './write-model';

interface BlipInfo {
	recType: number;
	/** recInstance for a single-UID BLIP of this type. */
	instance: number;
	/** `MSOBLIPTYPE` for the FBSE `btWin32` field. */
	blipType: number;
	/** `MSOBLIPTYPE` for the FBSE `btMacOS` field. */
	macBlipType: number;
}

const MSOBLIP_PICT = 0x04;

const BLIP_INFO: Record<WPictureData['extension'], BlipInfo> = {
	emf: { recType: OA.BlipEmf, instance: 0x3d4, blipType: 0x02, macBlipType: MSOBLIP_PICT },
	wmf: { recType: OA.BlipWmf, instance: 0x216, blipType: 0x03, macBlipType: MSOBLIP_PICT },
	jpg: { recType: OA.BlipJpeg, instance: 0x46a, blipType: 0x05, macBlipType: 0x05 },
	png: { recType: OA.BlipPng, instance: 0x6e0, blipType: 0x06, macBlipType: 0x06 },
	dib: { recType: OA.BlipDib, instance: 0x7a8, blipType: 0x07, macBlipType: 0x07 },
};

/**
 * A picture's `rgbUid`: the MD4 digest of its (uncompressed) file data, as
 * [MS-ODRAW] 2.2.23 specifies. It must be unique per distinct picture:
 * PowerPoint caches decoded BLIPs by this id, so two different pictures that
 * share one (this writer's former all-zero id) render as whichever was
 * decoded first (COM-measured: a WMF and an EMF both zero-id'd both showed
 * "The picture can't be displayed").
 */
export function pictureUid(picture: WPictureData): Uint8Array {
	return md4(picture.bytes);
}

/** Build one BLIP record for the `Pictures` stream. */
export function buildBlip(picture: WPictureData, uid: Uint8Array): Uint8Array {
	const info = BLIP_INFO[picture.extension];
	const w = new ByteWriter().bytes(uid); // rgbUid
	if (picture.metafile) {
		const compressed = zlibStore(picture.bytes);
		const [left, top, right, bottom] = picture.metafile.bounds;
		w.u32(picture.bytes.length) // cbSize: uncompressed size
			.i32(left)
			.i32(top)
			.i32(right)
			.i32(bottom)
			.i32(picture.metafile.widthEmu)
			.i32(picture.metafile.heightEmu)
			.u32(compressed.length) // cbSave
			.u8(0x00) // compression: DEFLATE
			.u8(0xfe) // filter: none
			.bytes(compressed);
	} else {
		w.u8(0xff).bytes(picture.bytes); // tag, then the raster file
	}
	return record(info.recType, w.toBytes(), info.instance, false, 0);
}

/** Build the `OfficeArtFBSE` indexing one BLIP at `foDelay` in the `Pictures` stream. */
export function buildFbse(
	picture: WPictureData,
	uid: Uint8Array,
	foDelay: number,
	size: number,
): Uint8Array {
	const info = BLIP_INFO[picture.extension];
	const data = new ByteWriter()
		.u8(info.blipType)
		.u8(info.macBlipType)
		.bytes(uid) // rgbUid, matching the BLIP's own
		.u16(0xff) // tag
		.u32(size)
		.u32(1) // cRef
		.u32(foDelay)
		.u8(0) // usage: default
		.u8(0) // cbName
		.u8(0)
		.u8(0)
		.toBytes();
	return record(OA.FBSE, data, info.blipType, false, 2);
}
