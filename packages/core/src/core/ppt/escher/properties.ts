/**
 * OfficeArtFOPT property table parsing ([MS-ODRAW] 2.3.1).
 *
 * The FOPT record contains rh.recInstance fixed-size entries (2-byte opid +
 * 4-byte value) followed by the concatenated complex data of every entry
 * whose fComplex bit is set (for those, the value is the byte length of the
 * complex data).
 *
 * @module ppt/escher/properties
 */

import type { PptRecord } from '../record-stream';

/** Well-known OfficeArt property ids used by the importer. */
export const OPT = {
	rotation: 4,
	lTxid: 128,
	pib: 260,
	fillType: 384,
	fillColor: 385,
	fillOpacity: 386,
	fillBackColor: 387,
	fNoFillHitTest: 447,
	lineColor: 448,
	lineOpacity: 449,
	lineWidth: 459,
	lineDashing: 462,
	lineStartArrowhead: 464,
	lineEndArrowhead: 465,
	fNoLineDrawDash: 511,
	wzName: 896,
} as const;

/** Parsed property table. */
export interface EscherProperties {
	/** Simple property values by id. */
	values: Map<number, number>;
	/** Complex property payloads by id. */
	complex: Map<number, Uint8Array>;
}

/**
 * Parse an OfficeArtFOPT (or tertiary FOPT) record.
 */
export function parseProperties(
	view: DataView,
	data: Uint8Array,
	rec: PptRecord,
): EscherProperties {
	const values = new Map<number, number>();
	const complex = new Map<number, Uint8Array>();
	const count = rec.recInstance;
	const entriesEnd = rec.dataOffset + count * 6;
	if (entriesEnd > rec.dataOffset + rec.recLen) {
		return { values, complex };
	}

	interface ComplexRef {
		id: number;
		length: number;
	}
	const complexRefs: ComplexRef[] = [];

	for (let i = 0; i < count; i++) {
		const at = rec.dataOffset + i * 6;
		const opid = view.getUint16(at, true);
		const value = view.getUint32(at + 2, true);
		const id = opid & 0x3fff;
		const isComplex = (opid & 0x8000) !== 0;
		if (isComplex) {
			complexRefs.push({ id, length: value });
		} else {
			values.set(id, value);
		}
	}

	let cursor = entriesEnd;
	const limit = rec.dataOffset + rec.recLen;
	for (const ref of complexRefs) {
		const end = Math.min(cursor + ref.length, limit);
		complex.set(ref.id, data.subarray(cursor, end));
		cursor = end;
	}

	return { values, complex };
}

/**
 * Evaluate an Escher boolean property pair (value bit + "use" bit).
 *
 * @param value - The raw property value.
 * @param bit - Bit mask of the flag in the low word.
 * @param useBit - Bit mask of the corresponding "use" flag in the high word.
 * @returns The flag when its use-bit is set, otherwise undefined.
 */
export function boolProp(
	value: number | undefined,
	bit: number,
	useBit: number,
): boolean | undefined {
	if (value === undefined || (value & useBit) === 0) {
		return undefined;
	}
	return (value & bit) !== 0;
}

/** Convert a 16.16 fixed-point rotation value to degrees. */
export function rotationToDegrees(raw: number): number {
	// The value is signed 16.16 fixed point.
	const signed = raw > 0x7fffffff ? raw - 0x100000000 : raw;
	return signed / 65536;
}

/** Decode a UTF-16LE complex property payload (e.g. wzName). */
export function decodeComplexString(payload: Uint8Array): string {
	let out = '';
	for (let i = 0; i + 1 < payload.length; i += 2) {
		const code = payload[i] | (payload[i + 1] << 8);
		if (code === 0) {
			break;
		}
		out += String.fromCharCode(code);
	}
	return out;
}

const DASH_MAP: Record<number, string> = {
	0: 'solid',
	1: 'dash',
	2: 'dot',
	3: 'dashDot',
	4: 'lgDashDotDot',
	5: 'dot',
	6: 'dash',
	7: 'lgDash',
	8: 'dashDot',
	9: 'lgDashDot',
	10: 'lgDashDotDot',
};

/** Map an Escher line dash style to an ST_PresetLineDashVal. */
export function dashStyle(value: number | undefined): string | undefined {
	if (value === undefined || value === 0) {
		return undefined;
	}
	return DASH_MAP[value];
}

const ARROW_MAP: Record<number, string> = {
	1: 'triangle',
	2: 'stealth',
	3: 'diamond',
	4: 'oval',
	5: 'arrow',
};

/** Map an Escher arrowhead style to an ST_LineEndType. */
export function arrowType(value: number | undefined): string | undefined {
	if (value === undefined || value === 0) {
		return undefined;
	}
	return ARROW_MAP[value] ?? 'triangle';
}
