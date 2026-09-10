/**
 * @module ppt/writer/fopt-writer.test
 */
import { describe, expect, it } from 'vitest';

import { encodeComplexString } from './fopt-writer';

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
