import { expectTypeOf } from '@jest/globals';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';

import {
	EMFPLUS_HEADER,
	EMFPLUS_ENDOFFILE,
	EMFPLUS_GETDC,
	EMFPLUS_OBJECT,
	EMFPLUS_OBJECTTYPE_BRUSH,
	EMFPLUS_BRUSHTYPE_SOLID,
	EMFPLUS_FILLRECTS,
} from './emf-constants';
import { replayEmfPlusRecords } from './emf-plus-replay';
import { createEmfPlusState } from './emf-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtxStub(): Record<string, unknown> {
	return {
		save: vi.fn(),
		restore: vi.fn(),
		beginPath: vi.fn(),
		closePath: vi.fn(),
		rect: vi.fn(),
		clip: vi.fn(),
		setTransform: vi.fn(),
		fill: vi.fn(),
		stroke: vi.fn(),
		fillRect: vi.fn(),
		strokeRect: vi.fn(),
		setLineDash: vi.fn(),
		ellipse: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		bezierCurveTo: vi.fn(),
		fillText: vi.fn(),
		strokeStyle: '#000',
		fillStyle: '#fff',
		lineWidth: 1,
		font: '12px sans-serif',
		textBaseline: 'top',
		textAlign: 'left',
	};
}

/**
 * Write an EMF+ record at a given offset.
 * EMF+ record: type(2) + flags(2) + size(4) + dataSize(4) + data
 * Returns the total size of the record.
 */
function writeEmfPlusRecord(
	view: DataView,
	offset: number,
	type: number,
	flags: number,
	dataSize: number,
	writer?: (view: DataView, dataOff: number) => void,
): number {
	const recSize = 12 + dataSize;
	view.setUint16(offset, type, true);
	view.setUint16(offset + 2, flags, true);
	view.setUint32(offset + 4, recSize, true);
	view.setUint32(offset + 8, dataSize, true);
	if (writer) {
		writer(view, offset + 12);
	}
	return recSize;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('emf-plus-replay', () => {
	describe('replayEmfPlusRecords()', () => {
		it('is a function', () => {
			expectTypeOf(replayEmfPlusRecords).toBeFunction();
		});

		it('returns empty deferred images for EndOfFile only', () => {
			const buf = new ArrayBuffer(64);
			const view = new DataView(buf);
			writeEmfPlusRecord(view, 0, EMFPLUS_ENDOFFILE, 0, 0);

			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			const result = replayEmfPlusRecords(view, 0, 12, ctx, 500, 500);
			expect(result).toStrictEqual([]);
		});

		it('resets transform to identity after replay', () => {
			const buf = new ArrayBuffer(64);
			const view = new DataView(buf);
			writeEmfPlusRecord(view, 0, EMFPLUS_ENDOFFILE, 0, 0);

			const ctx = makeCtxStub();
			replayEmfPlusRecords(view, 0, 12, ctx as unknown as CanvasRenderingContext2D, 500, 500);
			const setTransform = ctx.setTransform as ReturnType<typeof vi.fn>;
			// Last call should be the identity reset
			const lastCall = setTransform.mock.calls[setTransform.mock.calls.length - 1];
			expect(lastCall).toStrictEqual([1, 0, 0, 1, 0, 0]);
		});

		it('handles EMFPLUS_HEADER with DPI data', () => {
			const buf = new ArrayBuffer(128);
			const view = new DataView(buf);
			let off = 0;
			off += writeEmfPlusRecord(view, off, EMFPLUS_HEADER, 0, 16, (v, d) => {
				// version, emfPlusFlags, dpiX, dpiY
				v.setUint32(d, 0xdbc01002, true);
				v.setUint32(d + 4, 0, true);
				v.setFloat32(d + 8, 96, true);
				v.setFloat32(d + 12, 96, true);
			});
			writeEmfPlusRecord(view, off, EMFPLUS_ENDOFFILE, 0, 0);

			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			const result = replayEmfPlusRecords(view, 0, off + 12, ctx, 500, 500);
			expect(result).toStrictEqual([]);
		});

		it('handles EMFPLUS_GETDC (no-op)', () => {
			const buf = new ArrayBuffer(64);
			const view = new DataView(buf);
			let off = 0;
			off += writeEmfPlusRecord(view, off, EMFPLUS_GETDC, 0, 0);
			writeEmfPlusRecord(view, off, EMFPLUS_ENDOFFILE, 0, 0);

			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			const result = replayEmfPlusRecords(view, 0, off + 12, ctx, 500, 500);
			expect(result).toStrictEqual([]);
		});

		it('handles EMFPLUS_OBJECT for a solid brush', () => {
			const buf = new ArrayBuffer(128);
			const view = new DataView(buf);
			let off = 0;

			// Object record: type=Brush, id=3
			const flags = (EMFPLUS_OBJECTTYPE_BRUSH << 8) | 3;
			off += writeEmfPlusRecord(view, off, EMFPLUS_OBJECT, flags, 8, (v, d) => {
				v.setUint32(d, EMFPLUS_BRUSHTYPE_SOLID, true); // brushType
				v.setUint32(d + 4, 0xffff0000, true); // ARGB red
			});
			writeEmfPlusRecord(view, off, EMFPLUS_ENDOFFILE, 0, 0);

			const state = createEmfPlusState();
			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			replayEmfPlusRecords(view, 0, off + 12, ctx, 500, 500, state);

			// Brush should be stored in object table at id 3
			expect(state.objectTable.has(3)).toBe(true);
			const brush = state.objectTable.get(3)!;
			expect(brush.kind).toBe('plus-brush');
		});

		it('persists worldTransform across calls via shared state', () => {
			const state = createEmfPlusState();

			// First batch: set world transform
			const buf1 = new ArrayBuffer(128);
			const view1 = new DataView(buf1);
			let off1 = 0;
			// EMFPLUS_SETWORLDTRANSFORM = 0x402a
			off1 += writeEmfPlusRecord(view1, off1, 0x402a, 0, 24, (v, d) => {
				v.setFloat32(d, 2, true); // a
				v.setFloat32(d + 4, 0, true); // b
				v.setFloat32(d + 8, 0, true); // c
				v.setFloat32(d + 12, 3, true); // d
				v.setFloat32(d + 16, 10, true); // e
				v.setFloat32(d + 20, 20, true); // f
			});
			writeEmfPlusRecord(view1, off1, EMFPLUS_ENDOFFILE, 0, 0);

			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			replayEmfPlusRecords(view1, 0, off1 + 12, ctx, 500, 500, state);

			// worldTransform should be persisted in state
			expect(state.worldTransform[0]).toBeCloseTo(2);
			expect(state.worldTransform[3]).toBeCloseTo(3);
		});

		it('dispatches draw records to handlers (FILLRECTS)', () => {
			const buf = new ArrayBuffer(256);
			const view = new DataView(buf);
			let off = 0;

			// FILLRECTS with inline brush, compressed
			const flags = 0x8000 | 0x4000; // inline brush + compressed
			off += writeEmfPlusRecord(view, off, EMFPLUS_FILLRECTS, flags, 16, (v, d) => {
				v.setUint32(d, 0xff000000, true); // brush ARGB
				v.setUint32(d + 4, 1, true); // count = 1
				v.setInt16(d + 8, 10, true); // x
				v.setInt16(d + 10, 20, true); // y
				v.setInt16(d + 12, 50, true); // w
				v.setInt16(d + 14, 60, true); // h
			});
			writeEmfPlusRecord(view, off, EMFPLUS_ENDOFFILE, 0, 0);

			const ctx = makeCtxStub();
			replayEmfPlusRecords(view, 0, off + 12, ctx as unknown as CanvasRenderingContext2D, 500, 500);
			expect(ctx.fillRect as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
		});

		it('breaks on invalid recSize (too small)', () => {
			const buf = new ArrayBuffer(32);
			const view = new DataView(buf);
			// Write a record with size < 12 (invalid)
			view.setUint16(0, EMFPLUS_GETDC, true);
			view.setUint16(2, 0, true);
			view.setUint32(4, 4, true); // recSize = 4, invalid
			view.setUint32(8, 0, true);

			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			// Should not crash
			const result = replayEmfPlusRecords(view, 0, 12, ctx, 500, 500);
			expect(result).toStrictEqual([]);
		});

		it('handles continuation objects', () => {
			// Build a continuation sequence for a brush object
			const buf = new ArrayBuffer(512);
			const view = new DataView(buf);
			let off = 0;

			const objectId = 5;
			const objectType = EMFPLUS_OBJECTTYPE_BRUSH;

			// First continuation record (flag 0x8000 set)
			const firstFlags = 0x8000 | (objectType << 8) | objectId;
			off += writeEmfPlusRecord(view, off, EMFPLUS_OBJECT, firstFlags, 12, (v, d) => {
				// totalObjectSize (4 bytes)
				v.setUint32(d, 8, true); // total assembled object = 8 bytes (brush)
				// First chunk of data: brushType(4)
				v.setUint32(d + 4, EMFPLUS_BRUSHTYPE_SOLID, true);
				// Second part of first chunk: partial ARGB
				v.setUint32(d + 8, 0xff00ff00, true); // green
			});

			// Final non-continuation record for same objectId (flag 0x8000 NOT set)
			// Actually, since totalObjectSize=8 and we already provided 8 bytes in the first chunk,
			// the next record should be the final one. But the code expects objectId to match
			// and 0x8000 to NOT be set.
			const finalFlags = (objectType << 8) | objectId;
			off += writeEmfPlusRecord(view, off, EMFPLUS_OBJECT, finalFlags, 0);

			writeEmfPlusRecord(view, off, EMFPLUS_ENDOFFILE, 0, 0);

			const state = createEmfPlusState();
			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			replayEmfPlusRecords(view, 0, off + 12, ctx, 500, 500, state);

			// The continuation should have been assembled and stored
			expect(state.objectTable.has(objectId)).toBe(true);
		});

		it('stops at EMFPLUS_ENDOFFILE', () => {
			const buf = new ArrayBuffer(256);
			const view = new DataView(buf);
			let off = 0;
			off += writeEmfPlusRecord(view, off, EMFPLUS_ENDOFFILE, 0, 0);
			// This record after EOF should not be processed
			const flags = 0x8000 | 0x4000;
			writeEmfPlusRecord(view, off, EMFPLUS_FILLRECTS, flags, 16, (v, d) => {
				v.setUint32(d, 0xff000000, true);
				v.setUint32(d + 4, 1, true);
				v.setInt16(d + 8, 0, true);
				v.setInt16(d + 10, 0, true);
				v.setInt16(d + 12, 10, true);
				v.setInt16(d + 14, 10, true);
			});

			const ctx = makeCtxStub();
			replayEmfPlusRecords(
				view,
				0,
				off + 12 + 28,
				ctx as unknown as CanvasRenderingContext2D,
				500,
				500,
			);
			expect(ctx.fillRect as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
		});
	});
});
