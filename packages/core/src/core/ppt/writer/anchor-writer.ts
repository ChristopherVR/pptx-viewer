/**
 * EMU rectangle -> OfficeArt anchor record writer, the inverse of
 * `escher/shape-props.ts`'s `readClientAnchor` / `readChildAnchor`.
 *
 * @module ppt/writer/anchor-writer
 */

import { OA, EMU_PER_MASTER } from '../record-types';
import { record } from './byte-writer';
import type { WRect } from './write-model';

function emuToMaster(emu: number): number {
	return Math.round(emu / EMU_PER_MASTER);
}

const INT16_MIN = -32768;
const INT16_MAX = 32767;

/**
 * Build an `OfficeArtClientAnchor` for the given EMU rectangle.
 *
 * Written as the 8-byte `SmallRectStruct` (top, left, right, bottom, each
 * Int16 master units) whenever every edge fits, which is what PowerPoint
 * itself always writes. Only an edge beyond Int16 falls back to the 16-byte
 * form, in the field order real PowerPoint reads it: left, top, right,
 * bottom. That order was measured, not assumed: a probe shape at
 * left 100pt / top 10pt / 50x300pt written with the 16-byte form in
 * top-left-right-bottom order (this writer's earlier layout, and the
 * reading of [MS-PPT] `RectStruct` it followed) reopened in PowerPoint 16.0
 * at left 10pt / top 100pt / 140x210pt, i.e. with the first two fields taken
 * as left/top. Every shape this writer produced was transposed that way in
 * real PowerPoint while still round-tripping through this project's reader.
 */
export function buildClientAnchor(rect: WRect): Uint8Array {
	const top = emuToMaster(rect.y);
	const left = emuToMaster(rect.x);
	const right = emuToMaster(rect.x + rect.w);
	const bottom = emuToMaster(rect.y + rect.h);
	const fitsSmall = [top, left, right, bottom].every((v) => v >= INT16_MIN && v <= INT16_MAX);
	if (fitsSmall) {
		const small = new Uint8Array(8);
		const sv = new DataView(small.buffer);
		sv.setInt16(0, top, true);
		sv.setInt16(2, left, true);
		sv.setInt16(4, right, true);
		sv.setInt16(6, bottom, true);
		return record(OA.ClientAnchor, small, 0, false, 0);
	}
	const data = new Uint8Array(16);
	const view = new DataView(data.buffer);
	view.setInt32(0, left, true);
	view.setInt32(4, top, true);
	view.setInt32(8, right, true);
	view.setInt32(12, bottom, true);
	return record(OA.ClientAnchor, data, 0, false, 0);
}

/**
 * Build a 16-byte child anchor / FSPGR rect (left, top, right, bottom, each
 * Int32) for the given EMU rectangle.
 */
export function buildChildAnchorData(rect: WRect): Uint8Array {
	const left = emuToMaster(rect.x);
	const top = emuToMaster(rect.y);
	const right = emuToMaster(rect.x + rect.w);
	const bottom = emuToMaster(rect.y + rect.h);
	const data = new Uint8Array(16);
	const view = new DataView(data.buffer);
	view.setInt32(0, left, true);
	view.setInt32(4, top, true);
	view.setInt32(8, right, true);
	view.setInt32(12, bottom, true);
	return data;
}

/** Build a framed OfficeArtChildAnchor record. */
export function buildChildAnchor(rect: WRect): Uint8Array {
	return record(OA.ChildAnchor, buildChildAnchorData(rect), 0, false, 0);
}
