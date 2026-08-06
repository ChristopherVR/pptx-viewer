/**
 * Record framing tests with synthetic buffers.
 */
import { describe, expect, it } from 'vitest';

import {
	findChild,
	findDescendant,
	isContainer,
	iterateChildren,
	iterateRecords,
	readRecord,
	readRecordOrThrow,
	PptParseError,
} from './record-stream';

/** Build a record: header + data. recVer 0xF marks containers. */
function record(
	recVer: number,
	recInstance: number,
	recType: number,
	data: Uint8Array,
): Uint8Array {
	const out = new Uint8Array(8 + data.length);
	const view = new DataView(out.buffer);
	view.setUint16(0, (recVer & 0x0f) | ((recInstance & 0x0fff) << 4), true);
	view.setUint16(2, recType, true);
	view.setUint32(4, data.length, true);
	out.set(data, 8);
	return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function viewOf(bytes: Uint8Array): DataView {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

describe('record-stream', () => {
	it('parses an 8-byte record header', () => {
		const bytes = record(0x2, 0x0ca, 0x0f9f, new Uint8Array([1, 2, 3, 4]));
		const rec = readRecord(viewOf(bytes), 0);
		expect(rec).toMatchObject({
			recVer: 0x2,
			recInstance: 0x0ca,
			recType: 0x0f9f,
			recLen: 4,
			headerOffset: 0,
			dataOffset: 8,
		});
	});

	it('identifies containers by recVer 0xF', () => {
		const container = record(0xf, 0, 0x03ee, new Uint8Array(0));
		const atom = record(0x0, 0, 0x03ef, new Uint8Array(0));
		expect(isContainer(readRecordOrThrow(viewOf(container), 0))).toBeTruthy();
		expect(isContainer(readRecordOrThrow(viewOf(atom), 0))).toBeFalsy();
	});

	it('iterates sibling records', () => {
		const bytes = concat(
			record(0, 0, 0x1000, new Uint8Array(4)),
			record(0, 1, 0x2000, new Uint8Array(2)),
			record(0, 2, 0x3000, new Uint8Array(0)),
		);
		const types = [...iterateRecords(viewOf(bytes), 0, bytes.length)].map((r) => r.recType);
		expect(types).toStrictEqual([0x1000, 0x2000, 0x3000]);
	});

	it('stops iteration at a truncated record instead of throwing', () => {
		const good = record(0, 0, 0x1000, new Uint8Array(4));
		const bad = new Uint8Array(10); // header claims data beyond the range
		const badView = new DataView(bad.buffer);
		badView.setUint16(2, 0x2000, true);
		badView.setUint32(4, 100, true);
		const bytes = concat(good, bad);
		const types = [...iterateRecords(viewOf(bytes), 0, bytes.length)].map((r) => r.recType);
		expect(types).toStrictEqual([0x1000]);
	});

	it('finds direct children and deep descendants', () => {
		const leaf = record(0, 0x5, 0x0fa0, new Uint8Array([0x41, 0x00]));
		const inner = record(0xf, 0, 0xf004, leaf);
		const outer = record(0xf, 0, 0xf003, inner);
		const view = viewOf(outer);
		const outerRec = readRecordOrThrow(view, 0);

		expect(findChild(view, outerRec, 0xf004)).toBeDefined();
		expect(findChild(view, outerRec, 0x0fa0)).toBeUndefined();
		expect(findDescendant(view, outerRec, 0x0fa0)?.recInstance).toBe(0x5);
		expect([...iterateChildren(view, outerRec)]).toHaveLength(1);
	});

	it('readRecordOrThrow throws on out-of-bounds offsets', () => {
		const bytes = record(0, 0, 0x1000, new Uint8Array(0));
		expect(() => readRecordOrThrow(viewOf(bytes), 100)).toThrow(PptParseError);
	});
});
