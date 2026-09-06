/**
 * OfficeArtFOPT (shape property table) writer, the inverse of
 * `escher/properties.ts`'s `parseProperties`.
 *
 * @module ppt/writer/fopt-writer
 */

import { OA } from '../record-types';
import { ByteWriter, record } from './byte-writer';

/** Well-known OfficeArt property ids (mirrors `escher/properties.ts#OPT`). */
export const OPT = {
	rotation: 4,
	lTxid: 128,
	pib: 260,
	fillType: 384,
	fillColor: 385,
	fillBackColor: 387,
	fNoFillHitTest: 447,
	lineColor: 448,
	lineWidth: 459,
	lineDashing: 462,
	fNoLineDrawDash: 511,
	wzName: 896,
	fillShadeType: 393,
} as const;

/** A simple (32-bit value) property entry. */
export interface FoptSimpleEntry {
	id: number;
	value: number;
}

/** A complex (variable-length payload) property entry. */
export interface FoptComplexEntry {
	id: number;
	bytes: Uint8Array;
}

/** Boolean-property pair: bit in the low word, matching "use" bit in the high word. */
export function boolPropValue(flag: boolean, bit: number, useBit: number): number {
	return useBit | (flag ? bit : 0);
}

/** UTF-16LE encode a string for a `wzName`-style complex property (no terminator). */
export function encodeComplexString(name: string): Uint8Array {
	const out = new Uint8Array(name.length * 2);
	const view = new DataView(out.buffer);
	for (let i = 0; i < name.length; i++) {
		view.setUint16(i * 2, name.charCodeAt(i), true);
	}
	return out;
}

/**
 * Build a framed OfficeArtFOPT record from simple and complex properties.
 *
 * Complex properties are automatically sorted to the end of the fixed-entry
 * table (order among themselves is preserved) since their payload order
 * must match their entry order.
 */
export function buildFopt(simple: FoptSimpleEntry[], complex: FoptComplexEntry[] = []): Uint8Array {
	const entries = new ByteWriter();
	const allSorted = [...simple].sort((a, b) => a.id - b.id);
	for (const entry of allSorted) {
		entries.u16(entry.id & 0x3fff).u32(entry.value >>> 0);
	}
	for (const entry of complex) {
		entries.u16((entry.id & 0x3fff) | 0x8000).u32(entry.bytes.length >>> 0);
	}
	const payload = new ByteWriter();
	for (const entry of complex) {
		payload.bytes(entry.bytes);
	}
	const count = simple.length + complex.length;
	const data = new ByteWriter().append(entries).append(payload).toBytes();
	return record(OA.FOPT, data, count, false, 3);
}
