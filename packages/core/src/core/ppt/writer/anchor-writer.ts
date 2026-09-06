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

/**
 * Build a 16-byte RectStruct client anchor (top, left, right, bottom, each
 * Int32 master units) for the given EMU rectangle.
 */
export function buildClientAnchor(rect: WRect): Uint8Array {
	const top = emuToMaster(rect.y);
	const left = emuToMaster(rect.x);
	const right = emuToMaster(rect.x + rect.w);
	const bottom = emuToMaster(rect.y + rect.h);
	const data = new Uint8Array(16);
	const view = new DataView(data.buffer);
	view.setInt32(0, top, true);
	view.setInt32(4, left, true);
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
