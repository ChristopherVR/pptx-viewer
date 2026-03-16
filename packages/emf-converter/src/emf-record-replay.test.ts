import { describe, it, expect, vi } from 'vitest';

import {
	EMR_HEADER,
	EMR_EOF,
	EMR_COMMENT,
	EMR_RECTANGLE,
	EMR_SETBRUSHORGEX,
	EMR_SETMETARGN,
	EMR_SETICMMODE,
	EMR_SETLAYOUT,
	EMFPLUS_SIGNATURE,
} from './emf-constants';
import { replayEmfRecords } from './emf-record-replay';
import type { EmfBounds } from './emf-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtxStub(): Record<string, unknown> {
	return {
		save: vi.fn(),
		restore: vi.fn(),
		beginPath: vi.fn(),
		closePath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		bezierCurveTo: vi.fn(),
		arc: vi.fn(),
		ellipse: vi.fn(),
		rect: vi.fn(),
		fill: vi.fn(),
		stroke: vi.fn(),
		fillRect: vi.fn(),
		strokeRect: vi.fn(),
		clip: vi.fn(),
		setTransform: vi.fn(),
		setLineDash: vi.fn(),
		fillText: vi.fn(),
		drawImage: vi.fn(),
		measureText: vi.fn(() => ({ width: 50 })),
		strokeStyle: '#000000',
		fillStyle: '#ffffff',
		lineWidth: 1,
		font: '12px sans-serif',
		textBaseline: 'top' as string,
		textAlign: 'left' as string,
	};
}

function defaultBounds(): EmfBounds {
	return { left: 0, top: 0, right: 1000, bottom: 1000 };
}

/**
 * Write an EMF record into a DataView at the given offset.
 * Returns the number of bytes written (= recSize).
 */
function writeRecord(view: DataView, offset: number, recType: number, recSize: number): number {
	view.setUint32(offset, recType, true);
	view.setUint32(offset + 4, recSize, true);
	return recSize;
}

/**
 * Build a minimal EMF buffer with a HEADER + supplied records + EOF.
 * Returns the DataView and the overall byte length.
 */
function buildEmf(
	records: Array<{ type: number; size: number; writer?: (view: DataView, offset: number) => void }>,
): DataView {
	// Header
	const headerSize = 8;
	// EOF
	const eofSize = 8;
	let totalSize = headerSize;
	for (const r of records) {
		totalSize += r.size;
	}
	totalSize += eofSize;

	const buf = new ArrayBuffer(totalSize);
	const view = new DataView(buf);
	let offset = 0;

	// EMR_HEADER record
	writeRecord(view, offset, EMR_HEADER, headerSize);
	offset += headerSize;

	// User records
	for (const r of records) {
		writeRecord(view, offset, r.type, r.size);
		if (r.writer) {
			r.writer(view, offset);
		}
		offset += r.size;
	}

	// EMR_EOF
	writeRecord(view, offset, EMR_EOF, eofSize);

	return view;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('emf-record-replay', () => {
	describe('replayEmfRecords()', () => {
		it('is a function', () => {
			expectTypeOf(replayEmfRecords).toBeFunction();
		});

		it('returns an empty deferred images array for empty EMF (HEADER + EOF)', () => {
			const view = buildEmf([]);
			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			const result = replayEmfRecords(view, ctx, defaultBounds(), 500, 500);
			expect(result).toStrictEqual([]);
		});

		it('stops at EMR_EOF', () => {
			// After EOF there is a rectangle record that should NOT be processed
			const buf = new ArrayBuffer(64);
			const view = new DataView(buf);
			let off = 0;
			// EMR_HEADER
			off += writeRecord(view, off, EMR_HEADER, 8);
			// EMR_EOF
			off += writeRecord(view, off, EMR_EOF, 8);
			// EMR_RECTANGLE (should be skipped)
			writeRecord(view, off, EMR_RECTANGLE, 24);
			view.setInt32(off + 8, 0, true);
			view.setInt32(off + 12, 0, true);
			view.setInt32(off + 16, 50, true);
			view.setInt32(off + 20, 50, true);

			const ctx = makeCtxStub();
			replayEmfRecords(view, ctx as unknown as CanvasRenderingContext2D, defaultBounds(), 500, 500);
			// Rectangle should not have been drawn
			expect(ctx.fillRect as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
		});

		it('skips ignored record types (SETBRUSHORGEX, SETMETARGN, SETICMMODE, SETLAYOUT, HEADER)', () => {
			const records = [
				{ type: EMR_SETBRUSHORGEX, size: 8 },
				{ type: EMR_SETMETARGN, size: 8 },
				{ type: EMR_SETICMMODE, size: 8 },
				{ type: EMR_SETLAYOUT, size: 8 },
			];
			const view = buildEmf(records);
			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			// Should not throw
			const result = replayEmfRecords(view, ctx, defaultBounds(), 500, 500);
			expect(result).toStrictEqual([]);
		});

		it('handles EMR_RECTANGLE by delegating to draw handler', () => {
			const view = buildEmf([
				{
					type: EMR_RECTANGLE,
					size: 24,
					writer: (v, off) => {
						// data starts at off + 8: left, top, right, bottom
						v.setInt32(off + 8, 10, true);
						v.setInt32(off + 12, 20, true);
						v.setInt32(off + 16, 100, true);
						v.setInt32(off + 20, 200, true);
					},
				},
			]);
			const ctx = makeCtxStub();
			replayEmfRecords(view, ctx as unknown as CanvasRenderingContext2D, defaultBounds(), 500, 500);
			expect(ctx.fillRect as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
		});

		it('processes EMR_COMMENT with EMF+ signature', () => {
			// Build a valid EMR_COMMENT containing an EMF+ header
			const commentDataSize = 16; // 4 bytes beyond signature + 12 bytes for EMF+ record
			const _recSize = 8 + 4 + 4 + commentDataSize - 4; // type+size + commentDataSize field + signature + EMF+ data
			// Actually: EMR_COMMENT structure:
			//   offset+0: recType (4)
			//   offset+4: recSize (4)
			//   offset+8: commentDataSize (4) - includes signature + EMF+ records
			//   offset+12: EMFPLUS_SIGNATURE (4)
			//   offset+16: EMF+ record data (commentDataSize - 4 bytes)

			// We need commentDataSize that includes the 4-byte signature + the EMF+ records.
			// For a minimal EMF+ EndOfFile record: type(2)+flags(2)+size(4)+dataSize(4) = 12 bytes
			const emfPlusRecordSize = 12;
			const totalCommentDataSize = 4 + emfPlusRecordSize; // signature + record
			const totalRecSize = 8 + 4 + totalCommentDataSize; // EMR fields + commentDataSize field + data

			const view = buildEmf([
				{
					type: EMR_COMMENT,
					size: totalRecSize,
					writer: (v, off) => {
						v.setUint32(off + 8, totalCommentDataSize, true); // commentDataSize
						v.setUint32(off + 12, EMFPLUS_SIGNATURE, true); // EMF+ signature
						// EMF+ EndOfFile record
						v.setUint16(off + 16, 0x4002, true); // EMFPLUS_ENDOFFILE
						v.setUint16(off + 18, 0, true); // flags
						v.setUint32(off + 20, 12, true); // size
						v.setUint32(off + 24, 0, true); // dataSize
					},
				},
			]);
			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			const result = replayEmfRecords(view, ctx, defaultBounds(), 500, 500);
			expect(result).toStrictEqual([]);
		});

		it('breaks on invalid recSize (too small)', () => {
			const buf = new ArrayBuffer(32);
			const view = new DataView(buf);
			// Write HEADER
			writeRecord(view, 0, EMR_HEADER, 8);
			// Write record with recSize < 8 (invalid)
			view.setUint32(8, EMR_RECTANGLE, true);
			view.setUint32(12, 4, true); // recSize = 4, which is < 8

			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			// Should not crash, just stop early
			const result = replayEmfRecords(view, ctx, defaultBounds(), 500, 500);
			expect(result).toStrictEqual([]);
		});

		it('calculates correct scale factors from bounds and canvas dimensions', () => {
			const bounds: EmfBounds = { left: 0, top: 0, right: 200, bottom: 100 };
			const view = buildEmf([]);
			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			const result = replayEmfRecords(view, ctx, bounds, 400, 200);
			// sx = 400/200 = 2, sy = 200/100 = 2
			// Just ensure it doesn't crash and returns correctly
			expect(result).toStrictEqual([]);
		});

		it('handles bounds with left/top offsets', () => {
			const bounds: EmfBounds = { left: 50, top: 25, right: 150, bottom: 125 };
			const view = buildEmf([]);
			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			const result = replayEmfRecords(view, ctx, bounds, 500, 500);
			expect(result).toStrictEqual([]);
		});

		it('prevents division by zero when bounds have zero width or height', () => {
			const bounds: EmfBounds = { left: 0, top: 0, right: 0, bottom: 0 };
			const view = buildEmf([]);
			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			// Should not throw — uses || 1 fallback
			const result = replayEmfRecords(view, ctx, bounds, 500, 500);
			expect(result).toStrictEqual([]);
		});
	});
});
