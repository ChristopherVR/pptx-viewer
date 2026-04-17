import { describe, it, expect, vi, expectTypeOf } from 'vitest';

import {
	META_EOF,
	META_SETWINDOWORG,
	META_SETWINDOWEXT,
	META_SAVEDC,
	META_RESTOREDC,
	META_SETTEXTCOLOR,
	META_SETBKCOLOR,
	META_SETBKMODE,
	META_SETPOLYFILLMODE,
	META_SETTEXTALIGN,
	META_CREATEPENINDIRECT,
	META_CREATEBRUSHINDIRECT,
	META_CREATEFONTINDIRECT,
	META_SELECTOBJECT,
	META_DELETEOBJECT,
	META_RECTANGLE,
} from './emf-constants';
import type { WmfHeader } from './emf-types';
import { replayWmfRecords } from './wmf-replay';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtxStub(): Record<string, unknown> {
	return {
		save: vi.fn<() => void>(),
		restore: vi.fn<() => void>(),
		beginPath: vi.fn<() => void>(),
		closePath: vi.fn<() => void>(),
		moveTo: vi.fn<() => void>(),
		lineTo: vi.fn<() => void>(),
		bezierCurveTo: vi.fn<() => void>(),
		arc: vi.fn<() => void>(),
		arcTo: vi.fn<() => void>(),
		ellipse: vi.fn<() => void>(),
		rect: vi.fn<() => void>(),
		fill: vi.fn<() => void>(),
		stroke: vi.fn<() => void>(),
		fillRect: vi.fn<() => void>(),
		strokeRect: vi.fn<() => void>(),
		clip: vi.fn<() => void>(),
		setTransform: vi.fn<() => void>(),
		setLineDash: vi.fn<() => void>(),
		fillText: vi.fn<() => void>(),
		drawImage: vi.fn<() => void>(),
		strokeStyle: '#000',
		fillStyle: '#fff',
		lineWidth: 1,
		font: '12px sans-serif',
		textBaseline: 'top' as string,
		textAlign: 'left' as string,
	};
}

function defaultHeader(): WmfHeader {
	return {
		headerSize: 18,
		maxRecordSize: 100,
		boundsLeft: 0,
		boundsTop: 0,
		boundsRight: 1000,
		boundsBottom: 1000,
		unitsPerInch: 96,
	};
}

/**
 * Write a WMF record at the given offset.
 * WMF record format: sizeWords(uint32) + recType(uint16) + data...
 * sizeWords = total record size in 16-bit words
 */
function writeWmfRecord(
	view: DataView,
	offset: number,
	recType: number,
	dataSizeBytes: number,
	writer?: (view: DataView, dataOff: number) => void,
): number {
	const totalBytes = 6 + dataSizeBytes;
	const sizeWords = totalBytes / 2;
	view.setUint32(offset, sizeWords, true);
	view.setUint16(offset + 4, recType, true);
	if (writer) {
		writer(view, offset + 6);
	}
	return totalBytes;
}

/**
 * Build a WMF buffer with a series of records followed by META_EOF.
 */
function buildWmf(
	header: WmfHeader,
	records: Array<{
		type: number;
		dataSize: number;
		writer?: (view: DataView, dataOff: number) => void;
	}>,
): DataView {
	let totalSize = header.headerSize;
	for (const r of records) {
		totalSize += 6 + r.dataSize;
	}
	totalSize += 6; // META_EOF

	const buf = new ArrayBuffer(totalSize);
	const view = new DataView(buf);
	let offset = header.headerSize; // skip header (already positioned by replayWmfRecords)

	for (const r of records) {
		offset += writeWmfRecord(view, offset, r.type, r.dataSize, r.writer);
	}

	// META_EOF
	writeWmfRecord(view, offset, META_EOF, 0);

	return view;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wmf-replay', () => {
	describe('replayWmfRecords()', () => {
		it('is a function', () => {
			expectTypeOf(replayWmfRecords).toBeFunction();
		});

		it('handles empty WMF (just META_EOF)', () => {
			const header = defaultHeader();
			const view = buildWmf(header, []);
			const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
			// Should not throw
			replayWmfRecords(view, ctx, header, 500, 500);
		});

		it('stops at META_EOF', () => {
			const header = defaultHeader();
			// Put a rectangle after EOF — it should not be drawn
			const buf = new ArrayBuffer(200);
			const view = new DataView(buf);
			let off = header.headerSize;
			// META_EOF
			off += writeWmfRecord(view, off, META_EOF, 0);
			// META_RECTANGLE after EOF
			writeWmfRecord(view, off, META_RECTANGLE, 8, (v, d) => {
				v.setInt16(d, 100, true);
				v.setInt16(d + 2, 80, true);
				v.setInt16(d + 4, 0, true);
				v.setInt16(d + 6, 0, true);
			});

			const ctx = makeCtxStub();
			replayWmfRecords(view, ctx as unknown as CanvasRenderingContext2D, header, 500, 500);
			expect(ctx.fillRect as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
		});

		// -----------------------------------------------------------------------
		// Window origin and extent
		// -----------------------------------------------------------------------

		describe('mETA_SETWINDOWORG', () => {
			it('updates window origin', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_SETWINDOWORG,
						dataSize: 4,
						writer: (v, d) => {
							v.setInt16(d, 50, true); // y
							v.setInt16(d + 2, 100, true); // x
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				// Should not throw
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		describe('mETA_SETWINDOWEXT', () => {
			it('updates window extent', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_SETWINDOWEXT,
						dataSize: 4,
						writer: (v, d) => {
							v.setInt16(d, 2000, true); // cy
							v.setInt16(d + 2, 3000, true); // cx
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		// -----------------------------------------------------------------------
		// Save/Restore
		// -----------------------------------------------------------------------

		describe('mETA_SAVEDC / META_RESTOREDC', () => {
			it('saves and restores state', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_SETTEXTCOLOR,
						dataSize: 4,
						writer: (v, d) => {
							v.setUint8(d, 0xff); // R
							v.setUint8(d + 1, 0); // G
							v.setUint8(d + 2, 0); // B
						},
					},
					{ type: META_SAVEDC, dataSize: 0 },
					{
						type: META_SETTEXTCOLOR,
						dataSize: 4,
						writer: (v, d) => {
							v.setUint8(d, 0); // R
							v.setUint8(d + 1, 0xff); // G
							v.setUint8(d + 2, 0); // B
						},
					},
					{ type: META_RESTOREDC, dataSize: 0 },
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
				// State should be restored but we can't easily inspect it from outside.
				// The key thing is no crash.
			});
		});

		// -----------------------------------------------------------------------
		// Color and mode settings
		// -----------------------------------------------------------------------

		describe('mETA_SETTEXTCOLOR', () => {
			it('sets text color from color ref', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_SETTEXTCOLOR,
						dataSize: 4,
						writer: (v, d) => {
							v.setUint8(d, 0x12); // R
							v.setUint8(d + 1, 0x34); // G
							v.setUint8(d + 2, 0x56); // B
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		describe('mETA_SETBKCOLOR', () => {
			it('sets background color', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_SETBKCOLOR,
						dataSize: 4,
						writer: (v, d) => {
							v.setUint8(d, 0xff);
							v.setUint8(d + 1, 0xff);
							v.setUint8(d + 2, 0xff);
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		describe('mETA_SETBKMODE', () => {
			it('sets background mode', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_SETBKMODE,
						dataSize: 2,
						writer: (v, d) => {
							v.setUint16(d, 2, true); // OPAQUE
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		describe('mETA_SETPOLYFILLMODE', () => {
			it('sets polygon fill mode', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_SETPOLYFILLMODE,
						dataSize: 2,
						writer: (v, d) => {
							v.setUint16(d, 2, true); // WINDING
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		describe('mETA_SETTEXTALIGN', () => {
			it('sets text alignment', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_SETTEXTALIGN,
						dataSize: 2,
						writer: (v, d) => {
							v.setUint16(d, 0x06, true); // center
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		// -----------------------------------------------------------------------
		// Object creation and selection
		// -----------------------------------------------------------------------

		describe('mETA_CREATEPENINDIRECT + META_SELECTOBJECT', () => {
			it('creates a pen and selects it', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_CREATEPENINDIRECT,
						dataSize: 10,
						writer: (v, d) => {
							v.setUint16(d, 0, true); // style = PS_SOLID
							v.setInt16(d + 2, 2, true); // width
							v.setInt16(d + 4, 0, true); // widthY (ignored)
							v.setUint8(d + 6, 0xff); // R
							v.setUint8(d + 7, 0x00); // G
							v.setUint8(d + 8, 0x00); // B
							v.setUint8(d + 9, 0x00); // reserved
						},
					},
					{
						type: META_SELECTOBJECT,
						dataSize: 2,
						writer: (v, d) => {
							v.setUint16(d, 0, true); // object slot 0
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		describe('mETA_CREATEBRUSHINDIRECT + META_SELECTOBJECT', () => {
			it('creates a brush and selects it', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_CREATEBRUSHINDIRECT,
						dataSize: 8,
						writer: (v, d) => {
							v.setUint16(d, 0, true); // style = BS_SOLID
							v.setUint8(d + 2, 0x00); // R
							v.setUint8(d + 3, 0xff); // G
							v.setUint8(d + 4, 0x00); // B
							v.setUint8(d + 5, 0x00); // reserved
							v.setUint16(d + 6, 0, true); // hatch (ignored)
						},
					},
					{
						type: META_SELECTOBJECT,
						dataSize: 2,
						writer: (v, d) => {
							v.setUint16(d, 0, true);
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		describe('mETA_CREATEFONTINDIRECT + META_SELECTOBJECT', () => {
			it('creates a font and selects it', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_CREATEFONTINDIRECT,
						dataSize: 20,
						writer: (v, d) => {
							v.setInt16(d, -16, true); // height (negative = use absolute)
							v.setInt16(d + 2, 0, true); // width
							v.setInt16(d + 4, 0, true); // escapement
							v.setInt16(d + 6, 0, true); // orientation
							v.setInt16(d + 8, 700, true); // weight = bold
							v.setUint8(d + 10, 1); // italic = true
							v.setUint8(d + 11, 0); // underline
							v.setUint8(d + 12, 0); // strikeout
							v.setUint8(d + 13, 1); // charset
							// family name starting at offset 14
							const name = 'Times';
							for (let i = 0; i < name.length; i++) {
								v.setUint8(d + 14 + i, name.charCodeAt(i));
							}
							v.setUint8(d + 14 + name.length, 0); // null terminator
						},
					},
					{
						type: META_SELECTOBJECT,
						dataSize: 2,
						writer: (v, d) => {
							v.setUint16(d, 0, true);
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		describe('mETA_DELETEOBJECT', () => {
			it('deletes an object from the table', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_CREATEPENINDIRECT,
						dataSize: 10,
						writer: (v, d) => {
							v.setUint16(d, 0, true);
							v.setInt16(d + 2, 1, true);
							v.setInt16(d + 4, 0, true);
							v.setUint8(d + 6, 0);
							v.setUint8(d + 7, 0);
							v.setUint8(d + 8, 0);
						},
					},
					{
						type: META_DELETEOBJECT,
						dataSize: 2,
						writer: (v, d) => {
							v.setUint16(d, 0, true); // delete object 0
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		// -----------------------------------------------------------------------
		// Draw delegation
		// -----------------------------------------------------------------------

		describe('draw record delegation', () => {
			it('delegates META_RECTANGLE to draw handler', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: META_RECTANGLE,
						dataSize: 8,
						writer: (v, d) => {
							v.setInt16(d, 100, true); // bottom
							v.setInt16(d + 2, 80, true); // right
							v.setInt16(d + 4, 10, true); // top
							v.setInt16(d + 6, 5, true); // left
						},
					},
				]);
				const ctx = makeCtxStub();
				replayWmfRecords(view, ctx as unknown as CanvasRenderingContext2D, header, 500, 500);
				expect(ctx.fillRect as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
			});
		});

		// -----------------------------------------------------------------------
		// Record size validation
		// -----------------------------------------------------------------------

		describe('record size validation', () => {
			it('stops on record with recSize < 6', () => {
				const header = defaultHeader();
				const buf = new ArrayBuffer(100);
				const view = new DataView(buf);
				// Write an invalid record at header offset
				view.setUint32(header.headerSize, 2, true); // sizeWords=2 => 4 bytes < 6
				view.setUint16(header.headerSize + 4, META_RECTANGLE, true);

				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				// Should stop without crashing
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});

		// -----------------------------------------------------------------------
		// Coordinate mapping
		// -----------------------------------------------------------------------

		describe('coordinate mapping', () => {
			it('maps coordinates using window origin/extent and canvas size', () => {
				const header: WmfHeader = {
					headerSize: 18,
					maxRecordSize: 100,
					boundsLeft: 0,
					boundsTop: 0,
					boundsRight: 100,
					boundsBottom: 100,
					unitsPerInch: 96,
				};
				const view = buildWmf(header, [
					{
						type: META_RECTANGLE,
						dataSize: 8,
						writer: (v, d) => {
							// bottom=100, right=100, top=0, left=0
							v.setInt16(d, 100, true);
							v.setInt16(d + 2, 100, true);
							v.setInt16(d + 4, 0, true);
							v.setInt16(d + 6, 0, true);
						},
					},
				]);
				const ctx = makeCtxStub();
				// Canvas is 500x500, logical is 100x100 => scale = 5x
				replayWmfRecords(view, ctx as unknown as CanvasRenderingContext2D, header, 500, 500);
				const fillRect = ctx.fillRect as ReturnType<typeof vi.fn>;
				expect(fillRect).toHaveBeenCalledOnce();
				// fillRect(mx(left), my(top), mw(right-left), mh(bottom-top))
				// mx(0) = (0-0)/100 * 500 = 0
				// my(0) = (0-0)/100 * 500 = 0
				// mw(100) = 100/100 * 500 = 500
				// mh(100) = 100/100 * 500 = 500
				expect(fillRect.mock.calls[0]).toStrictEqual([0, 0, 500, 500]);
			});
		});

		// -----------------------------------------------------------------------
		// META_SETROP2 (no-op)
		// -----------------------------------------------------------------------

		describe('mETA_SETROP2', () => {
			it('is accepted without error (no-op)', () => {
				const header = defaultHeader();
				const view = buildWmf(header, [
					{
						type: 0x0104, // META_SETROP2
						dataSize: 2,
						writer: (v, d) => {
							v.setUint16(d, 13, true); // R2_COPYPEN
						},
					},
				]);
				const ctx = makeCtxStub() as unknown as CanvasRenderingContext2D;
				replayWmfRecords(view, ctx, header, 500, 500);
			});
		});
	});
});
