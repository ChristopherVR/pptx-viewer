import { describe, it, expect, vi, expectTypeOf } from 'vitest';

import {
	EMR_EXTTEXTOUTW,
	EMR_BITBLT,
	EMR_STRETCHDIBITS,
	EMR_INTERSECTCLIPRECT,
	EMR_EXTSELECTCLIPRGN,
	EMR_EXCLUDECLIPRECT,
	EMR_OFFSETCLIPRGN,
} from './emf-constants';
import { handleEmfGdiTextBitmapRecord } from './emf-gdi-draw-text-bitmap';
import { defaultState } from './emf-types';
import type { EmfGdiReplayCtx } from './emf-types';

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
		putImageData: vi.fn<() => void>(),
		measureText: vi.fn<(...args: any[]) => any>(() => ({ width: 50 })),
		strokeStyle: '#000000',
		fillStyle: '#ffffff',
		lineWidth: 1,
		font: '12px sans-serif',
		textBaseline: 'top' as string,
		textAlign: 'left' as string,
	};
}

function makeRCtx(bufSize = 1024): EmfGdiReplayCtx {
	const buf = new ArrayBuffer(bufSize);
	const view = new DataView(buf);
	const ctx = makeCtxStub();
	return {
		ctx: ctx as unknown as CanvasRenderingContext2D,
		view,
		objectTable: new Map(),
		state: defaultState(),
		stateStack: [],
		inPath: false,
		windowOrg: { x: 0, y: 0 },
		windowExt: { cx: 1000, cy: 1000 },
		viewportOrg: { x: 0, y: 0 },
		viewportExt: { cx: 1000, cy: 1000 },
		useMappingMode: false,
		clipSaveDepth: 0,
		bounds: { left: 0, top: 0, right: 1000, bottom: 1000 },
		canvasW: 500,
		canvasH: 500,
		sx: 0.5,
		sy: 0.5,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('emf-gdi-draw-text-bitmap', () => {
	describe('handleEmfGdiTextBitmapRecord()', () => {
		it('is a function with arity 5', () => {
			expectTypeOf(handleEmfGdiTextBitmapRecord).toBeFunction();
			expect(handleEmfGdiTextBitmapRecord).toHaveLength(5);
		});

		it('returns false for unrecognized record type', () => {
			const rCtx = makeRCtx();
			expect(handleEmfGdiTextBitmapRecord(rCtx, 0xffff, 0, 8, 8)).toBeFalsy();
		});

		// -----------------------------------------------------------------------
		// EMR_EXTTEXTOUTW
		// -----------------------------------------------------------------------

		describe('eMR_EXTTEXTOUTW', () => {
			it('returns true even for small recSize', () => {
				const rCtx = makeRCtx();
				expect(handleEmfGdiTextBitmapRecord(rCtx, EMR_EXTTEXTOUTW, 0, 8, 8)).toBeTruthy();
			});

			it('draws text when recSize is large enough and string data is valid', () => {
				const rCtx = makeRCtx();
				const offset = 0;
				const dataOff = 8;

				// Set up text out data at dataOff
				// refX at dataOff+28, refY at dataOff+32
				rCtx.view.setInt32(dataOff + 28, 100, true); // refX
				rCtx.view.setInt32(dataOff + 32, 200, true); // refY
				rCtx.view.setUint32(dataOff + 36, 2, true); // nChars = 2
				rCtx.view.setUint32(dataOff + 40, 76, true); // offString (relative to record start=offset)

				// Write "Hi" as UTF-16LE at offset + 76
				rCtx.view.setUint16(offset + 76, 72, true); // 'H'
				rCtx.view.setUint16(offset + 78, 105, true); // 'i'

				const result = handleEmfGdiTextBitmapRecord(rCtx, EMR_EXTTEXTOUTW, offset, dataOff, 80);
				expect(result).toBeTruthy();
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.fillText).toHaveBeenCalledOnce();
				expect(ctx.fillText.mock.calls[0][0]).toBe('Hi');
			});

			it('sets text alignment from state', () => {
				const rCtx = makeRCtx();
				rCtx.state.textAlign = 0x02; // TA_RIGHT
				const offset = 0;
				const dataOff = 8;
				rCtx.view.setInt32(dataOff + 28, 50, true);
				rCtx.view.setInt32(dataOff + 32, 50, true);
				rCtx.view.setUint32(dataOff + 36, 1, true); // 1 char
				rCtx.view.setUint32(dataOff + 40, 76, true);
				rCtx.view.setUint16(offset + 76, 65, true); // 'A'

				handleEmfGdiTextBitmapRecord(rCtx, EMR_EXTTEXTOUTW, offset, dataOff, 80);
				expect((rCtx.ctx as unknown as Record<string, string>).textAlign).toBe('right');
			});

			it('draws opaque background when bkMode is 2', () => {
				const rCtx = makeRCtx();
				rCtx.state.bkMode = 2; // OPAQUE
				rCtx.state.bkColor = '#ff0000';
				const offset = 0;
				const dataOff = 8;
				rCtx.view.setInt32(dataOff + 28, 0, true);
				rCtx.view.setInt32(dataOff + 32, 0, true);
				rCtx.view.setUint32(dataOff + 36, 1, true);
				rCtx.view.setUint32(dataOff + 40, 76, true);
				rCtx.view.setUint16(offset + 76, 65, true); // 'A'

				handleEmfGdiTextBitmapRecord(rCtx, EMR_EXTTEXTOUTW, offset, dataOff, 80);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				// fillRect should be called for background, then fillText for text
				expect(ctx.fillRect).toHaveBeenCalledOnce();
				expect(ctx.fillText).toHaveBeenCalledOnce();
			});

			it('skips text when nChars is 0', () => {
				const rCtx = makeRCtx();
				const dataOff = 8;
				rCtx.view.setInt32(dataOff + 28, 0, true);
				rCtx.view.setInt32(dataOff + 32, 0, true);
				rCtx.view.setUint32(dataOff + 36, 0, true); // nChars = 0

				handleEmfGdiTextBitmapRecord(rCtx, EMR_EXTTEXTOUTW, 0, dataOff, 76);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.fillText).not.toHaveBeenCalled();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_BITBLT
		// -----------------------------------------------------------------------

		describe('eMR_BITBLT', () => {
			it('returns true even for small recSize', () => {
				const rCtx = makeRCtx();
				expect(handleEmfGdiTextBitmapRecord(rCtx, EMR_BITBLT, 0, 8, 8)).toBeTruthy();
			});

			it('returns true for valid recSize but no bitmap data', () => {
				const rCtx = makeRCtx();
				const dataOff = 8;
				// Set offBmiSrc=0 (no bitmap)
				rCtx.view.setUint32(dataOff + 76, 0, true); // offBmiSrc = 0

				expect(handleEmfGdiTextBitmapRecord(rCtx, EMR_BITBLT, 0, dataOff, 96)).toBeTruthy();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_STRETCHDIBITS
		// -----------------------------------------------------------------------

		describe('eMR_STRETCHDIBITS', () => {
			it('returns true even for small recSize', () => {
				const rCtx = makeRCtx();
				expect(handleEmfGdiTextBitmapRecord(rCtx, EMR_STRETCHDIBITS, 0, 8, 8)).toBeTruthy();
			});

			it('returns true for valid recSize but no bitmap data', () => {
				const rCtx = makeRCtx();
				const dataOff = 8;
				rCtx.view.setUint32(dataOff + 40, 0, true); // offBmiSrc = 0

				expect(handleEmfGdiTextBitmapRecord(rCtx, EMR_STRETCHDIBITS, 0, dataOff, 80)).toBeTruthy();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_INTERSECTCLIPRECT
		// -----------------------------------------------------------------------

		describe('eMR_INTERSECTCLIPRECT', () => {
			it('sets up a clip region', () => {
				const rCtx = makeRCtx();
				const dataOff = 8;
				rCtx.view.setInt32(dataOff, 10, true); // left
				rCtx.view.setInt32(dataOff + 4, 20, true); // top
				rCtx.view.setInt32(dataOff + 8, 200, true); // right
				rCtx.view.setInt32(dataOff + 12, 300, true); // bottom

				const result = handleEmfGdiTextBitmapRecord(rCtx, EMR_INTERSECTCLIPRECT, 0, dataOff, 24);
				expect(result).toBeTruthy();
				expect(rCtx.clipSaveDepth).toBe(1);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.save).toHaveBeenCalledOnce();
				expect(ctx.clip).toHaveBeenCalledOnce();
				expect(ctx.rect).toHaveBeenCalledOnce();
			});

			it('returns true for small recSize (< 24)', () => {
				const rCtx = makeRCtx();
				const result = handleEmfGdiTextBitmapRecord(rCtx, EMR_INTERSECTCLIPRECT, 0, 8, 16);
				expect(result).toBeTruthy();
				expect(rCtx.clipSaveDepth).toBe(0); // no clip applied
			});
		});

		// -----------------------------------------------------------------------
		// EMR_EXTSELECTCLIPRGN
		// -----------------------------------------------------------------------

		describe('eMR_EXTSELECTCLIPRGN', () => {
			it('returns true for small recSize', () => {
				const rCtx = makeRCtx();
				expect(handleEmfGdiTextBitmapRecord(rCtx, EMR_EXTSELECTCLIPRGN, 0, 8, 8)).toBeTruthy();
			});

			it('resets clip with RGN_COPY and cbRgnData=0', () => {
				const rCtx = makeRCtx();
				rCtx.clipSaveDepth = 2;
				const dataOff = 8;
				rCtx.view.setUint32(dataOff, 0, true); // cbRgnData = 0
				rCtx.view.setUint32(dataOff + 4, 5, true); // iMode = RGN_COPY

				handleEmfGdiTextBitmapRecord(rCtx, EMR_EXTSELECTCLIPRGN, 0, dataOff, 16);
				expect(rCtx.clipSaveDepth).toBe(0);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.restore).toHaveBeenCalledTimes(2);
			});

			it('applies RGN_COPY with rectangles', () => {
				const rCtx = makeRCtx();
				const dataOff = 8;
				const rgnHeaderSize = 32;
				const numRects = 1;
				const rectData = numRects * 16;
				const cbRgnData = rgnHeaderSize + rectData;

				rCtx.view.setUint32(dataOff, cbRgnData, true); // cbRgnData
				rCtx.view.setUint32(dataOff + 4, 5, true); // iMode = RGN_COPY

				// RGNDATAHEADER at dataOff+8
				const rgnStart = dataOff + 8;
				rCtx.view.setUint32(rgnStart, 32, true); // dwSize
				rCtx.view.setUint32(rgnStart + 4, 1, true); // iType = RDH_RECTANGLES
				rCtx.view.setUint32(rgnStart + 8, numRects, true); // nCount

				// Rectangle at rgnStart + 32
				const rOff = rgnStart + 32;
				rCtx.view.setInt32(rOff, 10, true); // left
				rCtx.view.setInt32(rOff + 4, 20, true); // top
				rCtx.view.setInt32(rOff + 8, 100, true); // right
				rCtx.view.setInt32(rOff + 12, 200, true); // bottom

				handleEmfGdiTextBitmapRecord(rCtx, EMR_EXTSELECTCLIPRGN, 0, dataOff, 8 + cbRgnData);
				expect(rCtx.clipSaveDepth).toBe(1);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.clip).toHaveBeenCalledOnce();
			});

			it('ignores non-RGN_COPY modes', () => {
				const rCtx = makeRCtx();
				const dataOff = 8;
				rCtx.view.setUint32(dataOff, 32, true); // cbRgnData
				rCtx.view.setUint32(dataOff + 4, 1, true); // iMode = RGN_AND (not 5)

				handleEmfGdiTextBitmapRecord(rCtx, EMR_EXTSELECTCLIPRGN, 0, dataOff, 16);
				expect(rCtx.clipSaveDepth).toBe(0); // no clip applied
			});
		});

		// -----------------------------------------------------------------------
		// EMR_EXCLUDECLIPRECT (stub)
		// -----------------------------------------------------------------------

		describe('eMR_EXCLUDECLIPRECT', () => {
			it('returns true (stub handler)', () => {
				const rCtx = makeRCtx();
				const dataOff = 8;
				rCtx.view.setInt32(dataOff, 0, true);
				rCtx.view.setInt32(dataOff + 4, 0, true);
				rCtx.view.setInt32(dataOff + 8, 100, true);
				rCtx.view.setInt32(dataOff + 12, 100, true);

				expect(
					handleEmfGdiTextBitmapRecord(rCtx, EMR_EXCLUDECLIPRECT, 0, dataOff, 24),
				).toBeTruthy();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_OFFSETCLIPRGN (stub)
		// -----------------------------------------------------------------------

		describe('eMR_OFFSETCLIPRGN', () => {
			it('returns true (stub handler)', () => {
				const rCtx = makeRCtx();
				const dataOff = 8;
				rCtx.view.setInt32(dataOff, 5, true); // dx
				rCtx.view.setInt32(dataOff + 4, 10, true); // dy

				expect(handleEmfGdiTextBitmapRecord(rCtx, EMR_OFFSETCLIPRGN, 0, dataOff, 16)).toBeTruthy();
			});
		});
	});
});
