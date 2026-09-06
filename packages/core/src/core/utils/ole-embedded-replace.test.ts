import { describe, expect, it } from 'vitest';

import { unwrapOleEmbedding } from './ole-embedded-extract';
import { encodeOle10Native, replaceOleEmbedding } from './ole-embedded-replace';
import { parseOle2 } from './ole2-parser-read';
import { buildOle2 } from './ole2-parser-write';

describe('encodeOle10Native / replaceOleEmbedding', () => {
	it('round-trips through decodeOle10Native (encode then unwrap recovers file name + bytes)', () => {
		const payload = new TextEncoder().encode('hello world');
		const native = encodeOle10Native('notes.txt', payload);
		const streams = new Map<string, Uint8Array>([
			[`${String.fromCharCode(1)}Ole10Native`, native],
			[`${String.fromCharCode(1)}CompObj`, new Uint8Array([1, 2, 3])],
		]);
		const container = new Uint8Array(buildOle2(streams));
		const unwrapped = unwrapOleEmbedding(container);
		expect(unwrapped.fileName).toBe('notes.txt');
		expect(new TextDecoder().decode(unwrapped.data)).toBe('hello world');
	});

	it('replaces a Package-wrapped payload while preserving sibling streams', () => {
		const originalPayload = new TextEncoder().encode('original file contents');
		const original = new Uint8Array(
			buildOle2(
				new Map([
					[`${String.fromCharCode(1)}Ole10Native`, encodeOle10Native('data.csv', originalPayload)],
					[`${String.fromCharCode(1)}CompObj`, new Uint8Array([9, 9, 9])],
				]),
			),
		);

		const newPayload = new TextEncoder().encode('EDITED file contents, longer than before');
		const replaced = replaceOleEmbedding(original, newPayload, { fileName: 'data.csv' });

		const unwrapped = unwrapOleEmbedding(replaced);
		expect(new TextDecoder().decode(unwrapped.data)).toBe(
			'EDITED file contents, longer than before',
		);
		expect(unwrapped.fileName).toBe('data.csv');

		// The sibling CompObj stream must survive untouched.
		const buffer = replaced.buffer.slice(
			replaced.byteOffset,
			replaced.byteOffset + replaced.byteLength,
		);
		const reparsed = parseOle2(buffer as ArrayBuffer);
		expect(Array.from(reparsed.getStream(`${String.fromCharCode(1)}CompObj`)!)).toStrictEqual([
			9, 9, 9,
		]);
	});

	it('returns the new bytes unchanged when the original is not an OLE2 container (plain modern file passthrough)', () => {
		const original = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
		const newPayload = new Uint8Array([9, 9, 9]);
		expect(replaceOleEmbedding(original, newPayload)).toStrictEqual(newPayload);
	});

	it('returns the new bytes unchanged when the original OLE2 container is a native document format (no Ole10Native/CONTENTS)', () => {
		const original = new Uint8Array(buildOle2(new Map([['Workbook', new Uint8Array([1, 2, 3])]])));
		const newPayload = new Uint8Array([7, 7, 7]);
		expect(replaceOleEmbedding(original, newPayload)).toStrictEqual(newPayload);
	});
});
