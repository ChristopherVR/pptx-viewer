/**
 * @module ppt/writer/anchor-writer.test
 */
import { describe, expect, it } from 'vitest';

import { EMU_PER_MASTER } from '../record-types';
import { buildClientAnchor } from './anchor-writer';

const M = EMU_PER_MASTER;

describe('buildClientAnchor', () => {
	it('writes the 8-byte SmallRectStruct (top, left, right, bottom) PowerPoint itself writes', () => {
		// COM-measured: a shape meant for left 100pt / top 10pt / 50x300pt,
		// written in the old 16-byte top-first layout, reopened in PowerPoint
		// transposed (left 10pt / top 100pt / 140x210pt).
		const rec = buildClientAnchor({ x: 800 * M, y: 80 * M, w: 400 * M, h: 2400 * M });
		const view = new DataView(rec.buffer, rec.byteOffset, rec.byteLength);
		expect(view.getUint32(4, true)).toBe(8);
		expect([0, 2, 4, 6].map((o) => view.getInt16(8 + o, true))).toStrictEqual([
			80, 800, 1200, 2480,
		]);
	});

	it('falls back to the 16-byte form in left, top, right, bottom order past Int16', () => {
		const rec = buildClientAnchor({ x: 40000 * M, y: 10 * M, w: 5 * M, h: 7 * M });
		const view = new DataView(rec.buffer, rec.byteOffset, rec.byteLength);
		expect(view.getUint32(4, true)).toBe(16);
		expect([0, 4, 8, 12].map((o) => view.getInt32(8 + o, true))).toStrictEqual([
			40000, 10, 40005, 17,
		]);
	});
});
