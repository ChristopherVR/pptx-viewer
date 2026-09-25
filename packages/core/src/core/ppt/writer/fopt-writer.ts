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
	/** Combined picture-protection boolean flags; see `shape-props-writer.ts`. */
	pictureBooleanProperties1: 127,
	lTxid: 128,
	pib: 260,
	pictureId: 267,
	/** Combined picture boolean flags (distinct id range from `pib`'s group); see `shape-props-writer.ts`. */
	pictureBooleanProperties2: 319,
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

/** `OfficeArtFOPTEHeader.fBid`: the property's value is a BLIP identifier (e.g. `pib`). */
export const FBID_FLAG = 0x4000;

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

/**
 * UTF-16LE encode a string for a `wzName`-style complex property, WITH a
 * trailing null terminator (one `\0` UTF-16 code unit, 2 bytes).
 *
 * A real (COM-written) shape's `wzName` complex property always carries this
 * terminator: reverse-engineered from a COM-authored `.ppt` (a shape named
 * "Ink 6" writes a 12-byte payload, `49 00 6e 00 6b 00 20 00 36 00 00 00`,
 * i.e. 5 visible UTF-16 code units PLUS a trailing `00 00`, not the 10 bytes
 * the name's 5 characters alone would need). This writer's earlier
 * (untested-against-COM) assumption of no terminator produced a shape any
 * real `Presentations.Open` rejects outright ("Office has detected a
 * problem with this file", no repair option) for EVERY shape with a `name`
 * set, confirmed by bisecting an otherwise byte-identical, COM-verified
 * working file down to just this one property's presence.
 */
export function encodeComplexString(name: string): Uint8Array {
	const out = new Uint8Array((name.length + 1) * 2);
	const view = new DataView(out.buffer);
	for (let i = 0; i < name.length; i++) {
		view.setUint16(i * 2, name.charCodeAt(i), true);
	}
	// Trailing 2 bytes already zero-initialised: the null terminator.
	return out;
}

/**
 * Build a framed OfficeArtFOPT record from simple and complex properties.
 *
 * Every entry, simple or complex, is sorted by its PID (`id & 0x3fff`,
 * ignoring `fBid`), with the complex payloads following the entry table in
 * that same order, as PowerPoint writes it. Keeping complex entries at the
 * END of the table instead (this writer's earlier layout) went unnoticed
 * while no simple PID exceeded `wzName`'s 0x380; the master placeholders'
 * group-shape booleans (0x3BF) after `wzName` made PowerPoint report the
 * whole file as corrupt (COM-measured).
 *
 * A simple entry's `id` is written verbatim (not masked to the low 14 bits):
 * a caller MAY pre-OR the `fBid` bit (`0x4000`) onto it for a "blip
 * identifier" property (`pib`; see `shape-props-writer.ts`), confirmed
 * required by real PowerPoint's Office File Validation.
 */
export function buildFopt(simple: FoptSimpleEntry[], complex: FoptComplexEntry[] = []): Uint8Array {
	const pid = (id: number): number => id & 0x3fff;
	const all: Array<{ id: number; value: number; bytes?: Uint8Array }> = [
		...simple,
		...complex.map((entry) => ({ id: entry.id, value: entry.bytes.length, bytes: entry.bytes })),
	].sort((a, b) => pid(a.id) - pid(b.id));
	const entries = new ByteWriter();
	const payload = new ByteWriter();
	for (const { id, value, bytes } of all) {
		entries.u16(bytes ? pid(id) | 0x8000 : id & 0x7fff).u32(value >>> 0);
		if (bytes) {
			payload.bytes(bytes);
		}
	}
	const count = simple.length + complex.length;
	const data = new ByteWriter().append(entries).append(payload).toBytes();
	return record(OA.FOPT, data, count, false, 3);
}

/**
 * [MS-ODRAW] `metroBlob` (opid 0x03A9, Group Shape property set): a ZIP/OPC
 * package holding the shape's OOXML ("DrawingML round-trip") representation,
 * written the way PowerPoint 2007+ writes it on a 97-2003 SaveAs: as the only
 * entry of an `OfficeArtTertiaryFOPT`, with both `fComplex` and `fBid` set
 * (raw opid bytes `A9 C3`, measured against PowerPoint 16.0's own output).
 */
export const METRO_BLOB_OPID = 0x03a9;

/** Build the `OfficeArtTertiaryFOPT` record carrying a shape's `metroBlob` package. */
export function buildMetroBlobTertiaryFopt(metroBlob: Uint8Array): Uint8Array {
	const data = new ByteWriter()
		.u16(METRO_BLOB_OPID | 0x8000 | FBID_FLAG)
		.u32(metroBlob.length >>> 0)
		.bytes(metroBlob)
		.toBytes();
	return record(OA.TertiaryFOPT, data, 1, false, 3);
}
