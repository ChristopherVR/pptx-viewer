import { describe, it, expect } from 'vitest';

import {
	decodeOle10Native,
	isOle2CompoundFile,
	oleBytesToDataUrl,
	unwrapOleEmbedding,
} from './ole-embedded-extract';
import { buildOle2 } from './ole2-parser';

/**
 * Build a minimal `Ole10Native` stream payload wrapping `data` with the given
 * original source `path`.
 *
 * Layout (little-endian): 4-byte total size, 2-byte flags, NUL-terminated
 * label, NUL-terminated source path, 4 unknown bytes, 4-byte temp-path length,
 * temp path, 4-byte native-data size, native data.
 */
function buildOle10Native(path: string, data: Uint8Array, label = 'Doc'): Uint8Array {
	const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
	const labelZ = new Uint8Array([...ascii(label), 0]);
	const pathZ = new Uint8Array([...ascii(path), 0]);
	const tempPath = ascii('C:\\Temp\\x.bin');

	const bodyLen = 2 + labelZ.length + pathZ.length + 4 + 4 + tempPath.length + 4 + data.length;
	const out = new Uint8Array(4 + bodyLen);
	const view = new DataView(out.buffer);
	let o = 0;
	view.setUint32(o, bodyLen, true);
	o += 4;
	view.setUint16(o, 0x0002, true);
	o += 2;
	out.set(labelZ, o);
	o += labelZ.length;
	out.set(pathZ, o);
	o += pathZ.length;
	o += 4; // unknown
	view.setUint32(o, tempPath.length, true);
	o += 4;
	out.set(tempPath, o);
	o += tempPath.length;
	view.setUint32(o, data.length, true);
	o += 4;
	out.set(data, o);
	return out;
}

describe('isOle2CompoundFile', () => {
	it('detects the OLE2 magic signature', () => {
		const magic = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
		expect(isOle2CompoundFile(magic)).toBeTruthy();
	});

	it('rejects a plain (non-compound) file', () => {
		// "PK\x03\x04" is a ZIP header (e.g. a bare .xlsx).
		expect(isOle2CompoundFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeFalsy();
	});

	it('rejects buffers shorter than the magic length', () => {
		expect(isOle2CompoundFile(new Uint8Array([0xd0, 0xcf]))).toBeFalsy();
	});
});

describe('decodeOle10Native', () => {
	it('recovers the original file name and bytes', () => {
		const data = Uint8Array.from([1, 2, 3, 4, 5]);
		const stream = buildOle10Native('C:\\Users\\me\\report.xlsx', data);
		const result = decodeOle10Native(stream);
		expect(result).toBeDefined();
		expect(result?.fileName).toBe('report.xlsx');
		expect(Array.from(result?.data ?? [])).toStrictEqual([1, 2, 3, 4, 5]);
	});

	it('returns undefined for a too-short stream', () => {
		expect(decodeOle10Native(new Uint8Array([1, 2]))).toBeUndefined();
	});
});

describe('unwrapOleEmbedding', () => {
	it('passes a plain (non-compound) file through unchanged', () => {
		const xlsx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9, 9]);
		const result = unwrapOleEmbedding(xlsx);
		expect(result.fileName).toBeUndefined();
		expect(Array.from(result.data)).toStrictEqual([0x50, 0x4b, 0x03, 0x04, 9, 9, 9]);
	});

	it('unwraps a (U+0001-prefixed) Ole10Native "Package" wrapper', () => {
		const inner = Uint8Array.from([10, 20, 30, 40]);
		const stream = buildOle10Native('C:\\docs\\budget.docx', inner);
		// Real PowerPoint files name the stream with a leading U+0001 control char.
		const compound = buildOle2(new Map([[`${String.fromCharCode(1)}Ole10Native`, stream]]));
		const result = unwrapOleEmbedding(new Uint8Array(compound));
		expect(result.fileName).toBe('budget.docx');
		expect(Array.from(result.data)).toStrictEqual([10, 20, 30, 40]);
	});

	it('also unwraps an unprefixed Ole10Native stream name', () => {
		const inner = Uint8Array.from([7, 8, 9]);
		const stream = buildOle10Native('C:\\x\\notes.txt', inner);
		const compound = buildOle2(new Map([['Ole10Native', stream]]));
		const result = unwrapOleEmbedding(new Uint8Array(compound));
		expect(result.fileName).toBe('notes.txt');
		expect(Array.from(result.data)).toStrictEqual([7, 8, 9]);
	});

	it('falls back to the CONTENTS stream when no Ole10Native is present', () => {
		const contents = Uint8Array.from([0x25, 0x50, 0x44, 0x46]); // "%PDF"
		const compound = buildOle2(new Map([['CONTENTS', contents]]));
		const result = unwrapOleEmbedding(new Uint8Array(compound));
		expect(result.fileName).toBeUndefined();
		expect(Array.from(result.data)).toStrictEqual([0x25, 0x50, 0x44, 0x46]);
	});

	it('falls back to the raw bytes for an unrecognised compound file', () => {
		const other = Uint8Array.from([1, 1, 1, 1]);
		const compound = buildOle2(new Map([['SomethingElse', other]]));
		const raw = new Uint8Array(compound);
		const result = unwrapOleEmbedding(raw);
		// No known stream: the raw compound-file bytes are returned for download.
		expect(result.data).toBe(raw);
	});

	it('returns empty data unchanged without throwing', () => {
		const result = unwrapOleEmbedding(new Uint8Array(0));
		expect(result.data).toHaveLength(0);
	});

	it('does not throw on garbage compound-file bytes', () => {
		// Valid magic but truncated / invalid structure.
		const garbage = new Uint8Array(64);
		garbage.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
		const result = unwrapOleEmbedding(garbage);
		expect(result.data).toBe(garbage);
	});
});

describe('oleBytesToDataUrl', () => {
	it('builds a base64 data-URL with the given mime type', () => {
		const url = oleBytesToDataUrl(Uint8Array.from([72, 105]), 'text/plain');
		expect(url).toBe(`data:text/plain;base64,${btoa('Hi')}`);
	});
});
