/**
 * @module ppt/writer/fopt-writer.test
 */
import { describe, expect, it } from 'vitest';

import { buildMetroBlobTertiaryFopt, encodeComplexString } from './fopt-writer';

describe('encodeComplexString', () => {
	it('appends a trailing UTF-16 null terminator', () => {
		// A real (COM-written) `wzName` complex property is null-terminated: a
		// shape named "Ink 6" writes a 12-byte payload (5 visible UTF-16 code
		// units + a trailing `00 00`), not the 10 bytes its 5 characters alone
		// would need. Missing this terminator made real PowerPoint's
		// `Presentations.Open` reject EVERY `.ppt` this writer produced for a
		// shape with a `name` set ("Office has detected a problem with this
		// file", no repair option) - confirmed by reverse bisection against an
		// otherwise byte-identical, COM-verified working file.
		const bytes = encodeComplexString('Ink 6');
		expect(bytes).toHaveLength(12);
		expect(Array.from(bytes.subarray(bytes.length - 2))).toStrictEqual([0, 0]);
		expect(Buffer.from(bytes.subarray(0, 10)).toString('utf16le')).toBe('Ink 6');
	});

	it('null-terminates the empty string too', () => {
		const bytes = encodeComplexString('');
		expect(Array.from(bytes)).toStrictEqual([0, 0]);
	});
});

describe('buildMetroBlobTertiaryFopt', () => {
	it('writes the metroBlob as the sole complex entry of a TertiaryFOPT, fComplex+fBid set', () => {
		const blob = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0xaa]);
		const rec = buildMetroBlobTertiaryFopt(blob);
		const view = new DataView(rec.buffer, rec.byteOffset, rec.byteLength);
		// recVer 3, recInstance 1 (one property), recType 0xF122.
		expect(view.getUint16(0, true)).toBe(0x0013);
		expect(view.getUint16(2, true)).toBe(0xf122);
		expect(view.getUint32(4, true)).toBe(6 + blob.length);
		// PowerPoint's own bytes for the property id: A9 C3.
		expect(Array.from(rec.subarray(8, 10))).toStrictEqual([0xa9, 0xc3]);
		expect(view.getUint32(10, true)).toBe(blob.length);
		expect(Array.from(rec.subarray(14))).toStrictEqual(Array.from(blob));
	});
});
