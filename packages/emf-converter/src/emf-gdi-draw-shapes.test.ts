import { expectTypeOf } from '@jest/globals';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';

import {
	EMR_SETPIXELV,
	EMR_MOVETOEX,
	EMR_LINETO,
	EMR_RECTANGLE,
	EMR_ROUNDRECT,
	EMR_ELLIPSE,
	EMR_ARC,
	EMR_ARCTO,
	EMR_CHORD,
	EMR_PIE,
} from './emf-constants';
import { handleEmfGdiShapeRecord } from './emf-gdi-draw-shapes';
import type { EmfGdiReplayCtx } from './emf-types';
import { defaultState } from './emf-types';

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
		arcTo: vi.fn(),
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
		strokeStyle: '#000000',
		fillStyle: '#ffffff',
		lineWidth: 1,
		font: '12px sans-serif',
		textBaseline: 'top' as string,
		textAlign: 'left' as string,
	};
}

function makeRCtx(bufSize = 512): EmfGdiReplayCtx {
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

describe('emf-gdi-draw-shapes', () => {
	describe('handleEmfGdiShapeRecord()', () => {
		it('is a function with arity 4', () => {
			expectTypeOf(handleEmfGdiShapeRecord).toBeFunction();
			expect(handleEmfGdiShapeRecord).toHaveLength(4);
		});

		it('returns false for unrecognized record type', () => {
			const rCtx = makeRCtx();
			expect(handleEmfGdiShapeRecord(rCtx, 0xffff, 8, 8)).toBe(false);
		});

		// -----------------------------------------------------------------------
		// EMR_SETPIXELV
		// -----------------------------------------------------------------------

		describe('eMR_SETPIXELV', () => {
			it('draws a single pixel', () => {
				const rCtx = makeRCtx();
				const d = 8;
				rCtx.view.setInt32(d, 50, true); // x
				rCtx.view.setInt32(d + 4, 75, true); // y
				// colorRef at d+8
				rCtx.view.setUint8(d + 8, 0xff); // R
				rCtx.view.setUint8(d + 9, 0x00); // G
				rCtx.view.setUint8(d + 10, 0x00); // B

				const result = handleEmfGdiShapeRecord(rCtx, EMR_SETPIXELV, d, 20);
				expect(result).toBe(true);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.fillRect).toHaveBeenCalledOnce();
				// fillRect(gmx(50), gmy(75), 1, 1) — gmx/gmy apply scaling
			});

			it('ignores if recSize < 20', () => {
				const rCtx = makeRCtx();
				handleEmfGdiShapeRecord(rCtx, EMR_SETPIXELV, 8, 12);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.fillRect).not.toHaveBeenCalled();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_MOVETOEX
		// -----------------------------------------------------------------------

		describe('eMR_MOVETOEX', () => {
			it('updates curX and curY in state', () => {
				const rCtx = makeRCtx();
				const d = 8;
				rCtx.view.setInt32(d, 100, true); // x
				rCtx.view.setInt32(d + 4, 200, true); // y

				const result = handleEmfGdiShapeRecord(rCtx, EMR_MOVETOEX, d, 16);
				expect(result).toBe(true);
				expect(rCtx.state.curX).toBe(100);
				expect(rCtx.state.curY).toBe(200);
			});

			it('calls ctx.moveTo when inPath is true', () => {
				const rCtx = makeRCtx();
				rCtx.inPath = true;
				const d = 8;
				rCtx.view.setInt32(d, 10, true);
				rCtx.view.setInt32(d + 4, 20, true);

				handleEmfGdiShapeRecord(rCtx, EMR_MOVETOEX, d, 16);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.moveTo).toHaveBeenCalledOnce();
			});

			it('does not call ctx.moveTo when not inPath', () => {
				const rCtx = makeRCtx();
				rCtx.inPath = false;
				const d = 8;
				rCtx.view.setInt32(d, 10, true);
				rCtx.view.setInt32(d + 4, 20, true);

				handleEmfGdiShapeRecord(rCtx, EMR_MOVETOEX, d, 16);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.moveTo).not.toHaveBeenCalled();
			});

			it('ignores if recSize < 16', () => {
				const rCtx = makeRCtx();
				handleEmfGdiShapeRecord(rCtx, EMR_MOVETOEX, 8, 8);
				expect(rCtx.state.curX).toBe(0); // unchanged
			});
		});

		// -----------------------------------------------------------------------
		// EMR_LINETO
		// -----------------------------------------------------------------------

		describe('eMR_LINETO', () => {
			it('draws a line when not in path mode', () => {
				const rCtx = makeRCtx();
				rCtx.state.curX = 10;
				rCtx.state.curY = 20;
				const d = 8;
				rCtx.view.setInt32(d, 100, true); // lx
				rCtx.view.setInt32(d + 4, 200, true); // ly

				const result = handleEmfGdiShapeRecord(rCtx, EMR_LINETO, d, 16);
				expect(result).toBe(true);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.beginPath).toHaveBeenCalledOnce();
				expect(ctx.moveTo).toHaveBeenCalledOnce();
				expect(ctx.lineTo).toHaveBeenCalledOnce();
				expect(ctx.stroke).toHaveBeenCalledOnce();
				expect(rCtx.state.curX).toBe(100);
				expect(rCtx.state.curY).toBe(200);
			});

			it('uses ctx.lineTo when inPath is true', () => {
				const rCtx = makeRCtx();
				rCtx.inPath = true;
				rCtx.state.curX = 0;
				rCtx.state.curY = 0;
				const d = 8;
				rCtx.view.setInt32(d, 50, true);
				rCtx.view.setInt32(d + 4, 60, true);

				handleEmfGdiShapeRecord(rCtx, EMR_LINETO, d, 16);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.lineTo).toHaveBeenCalledOnce();
				expect(ctx.beginPath).not.toHaveBeenCalled(); // should NOT beginPath in path mode
				expect(ctx.stroke).not.toHaveBeenCalled();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_RECTANGLE
		// -----------------------------------------------------------------------

		describe('eMR_RECTANGLE', () => {
			it('fills and strokes a rectangle', () => {
				const rCtx = makeRCtx();
				const d = 8;
				rCtx.view.setInt32(d, 10, true); // left
				rCtx.view.setInt32(d + 4, 20, true); // top
				rCtx.view.setInt32(d + 8, 100, true); // right
				rCtx.view.setInt32(d + 12, 200, true); // bottom

				const result = handleEmfGdiShapeRecord(rCtx, EMR_RECTANGLE, d, 24);
				expect(result).toBe(true);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.fillRect).toHaveBeenCalledOnce();
				expect(ctx.strokeRect).toHaveBeenCalledOnce();
			});

			it('uses ctx.rect when inPath', () => {
				const rCtx = makeRCtx();
				rCtx.inPath = true;
				const d = 8;
				rCtx.view.setInt32(d, 0, true);
				rCtx.view.setInt32(d + 4, 0, true);
				rCtx.view.setInt32(d + 8, 50, true);
				rCtx.view.setInt32(d + 12, 50, true);

				handleEmfGdiShapeRecord(rCtx, EMR_RECTANGLE, d, 24);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.rect).toHaveBeenCalledOnce();
				expect(ctx.fillRect).not.toHaveBeenCalled();
			});

			it('ignores if recSize < 24', () => {
				const rCtx = makeRCtx();
				handleEmfGdiShapeRecord(rCtx, EMR_RECTANGLE, 8, 16);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.fillRect).not.toHaveBeenCalled();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_ROUNDRECT
		// -----------------------------------------------------------------------

		describe('eMR_ROUNDRECT', () => {
			it('draws a rounded rectangle with fill and stroke', () => {
				const rCtx = makeRCtx();
				const d = 8;
				rCtx.view.setInt32(d, 0, true); // left
				rCtx.view.setInt32(d + 4, 0, true); // top
				rCtx.view.setInt32(d + 8, 200, true); // right
				rCtx.view.setInt32(d + 12, 100, true); // bottom
				rCtx.view.setInt32(d + 16, 20, true); // corner width
				rCtx.view.setInt32(d + 20, 20, true); // corner height

				const result = handleEmfGdiShapeRecord(rCtx, EMR_ROUNDRECT, d, 32);
				expect(result).toBe(true);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.beginPath).toHaveBeenCalledOnce();
				expect(ctx.fill).toHaveBeenCalledOnce();
				expect(ctx.stroke).toHaveBeenCalledOnce();
			});

			it('draws round rect path when inPath', () => {
				const rCtx = makeRCtx();
				rCtx.inPath = true;
				const d = 8;
				rCtx.view.setInt32(d, 0, true);
				rCtx.view.setInt32(d + 4, 0, true);
				rCtx.view.setInt32(d + 8, 100, true);
				rCtx.view.setInt32(d + 12, 50, true);
				rCtx.view.setInt32(d + 16, 10, true);
				rCtx.view.setInt32(d + 20, 10, true);

				handleEmfGdiShapeRecord(rCtx, EMR_ROUNDRECT, d, 32);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.beginPath).not.toHaveBeenCalled(); // NOT called in path mode
				expect(ctx.closePath).toHaveBeenCalledOnce(); // drawRoundRect calls closePath
			});

			it('ignores if recSize < 32', () => {
				const rCtx = makeRCtx();
				handleEmfGdiShapeRecord(rCtx, EMR_ROUNDRECT, 8, 24);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.fill).not.toHaveBeenCalled();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_ELLIPSE
		// -----------------------------------------------------------------------

		describe('eMR_ELLIPSE', () => {
			it('draws an ellipse with fill and stroke', () => {
				const rCtx = makeRCtx();
				const d = 8;
				rCtx.view.setInt32(d, 0, true); // left
				rCtx.view.setInt32(d + 4, 0, true); // top
				rCtx.view.setInt32(d + 8, 100, true); // right
				rCtx.view.setInt32(d + 12, 80, true); // bottom

				const result = handleEmfGdiShapeRecord(rCtx, EMR_ELLIPSE, d, 24);
				expect(result).toBe(true);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.beginPath).toHaveBeenCalledOnce();
				expect(ctx.ellipse).toHaveBeenCalledOnce();
				expect(ctx.fill).toHaveBeenCalledOnce();
				expect(ctx.stroke).toHaveBeenCalledOnce();
			});

			it('only adds to path when inPath', () => {
				const rCtx = makeRCtx();
				rCtx.inPath = true;
				const d = 8;
				rCtx.view.setInt32(d, 0, true);
				rCtx.view.setInt32(d + 4, 0, true);
				rCtx.view.setInt32(d + 8, 50, true);
				rCtx.view.setInt32(d + 12, 50, true);

				handleEmfGdiShapeRecord(rCtx, EMR_ELLIPSE, d, 24);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.ellipse).toHaveBeenCalledOnce();
				expect(ctx.beginPath).not.toHaveBeenCalled();
				expect(ctx.fill).not.toHaveBeenCalled();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_ARC
		// -----------------------------------------------------------------------

		describe('eMR_ARC', () => {
			it('draws an arc (stroke only, no fill)', () => {
				const rCtx = makeRCtx();
				const d = 8;
				rCtx.view.setInt32(d, 0, true); // left
				rCtx.view.setInt32(d + 4, 0, true); // top
				rCtx.view.setInt32(d + 8, 100, true); // right
				rCtx.view.setInt32(d + 12, 100, true); // bottom
				rCtx.view.setInt32(d + 16, 100, true); // startX
				rCtx.view.setInt32(d + 20, 50, true); // startY
				rCtx.view.setInt32(d + 24, 50, true); // endX
				rCtx.view.setInt32(d + 28, 100, true); // endY

				const result = handleEmfGdiShapeRecord(rCtx, EMR_ARC, d, 40);
				expect(result).toBe(true);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.stroke).toHaveBeenCalledOnce();
				expect(ctx.fill).not.toHaveBeenCalled(); // ARC does not fill
			});

			it('ignores if recSize < 40', () => {
				const rCtx = makeRCtx();
				handleEmfGdiShapeRecord(rCtx, EMR_ARC, 8, 32);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.stroke).not.toHaveBeenCalled();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_ARCTO
		// -----------------------------------------------------------------------

		describe('eMR_ARCTO', () => {
			it('draws an arc and updates curX/curY', () => {
				const rCtx = makeRCtx();
				rCtx.state.curX = 0;
				rCtx.state.curY = 0;
				const d = 8;
				rCtx.view.setInt32(d, 0, true);
				rCtx.view.setInt32(d + 4, 0, true);
				rCtx.view.setInt32(d + 8, 100, true);
				rCtx.view.setInt32(d + 12, 100, true);
				rCtx.view.setInt32(d + 16, 100, true); // startX
				rCtx.view.setInt32(d + 20, 50, true); // startY
				rCtx.view.setInt32(d + 24, 0, true); // endX
				rCtx.view.setInt32(d + 28, 50, true); // endY

				handleEmfGdiShapeRecord(rCtx, EMR_ARCTO, d, 40);
				expect(rCtx.state.curX).toBe(0); // endX
				expect(rCtx.state.curY).toBe(50); // endY
			});

			it('uses lineTo to connect to arc start', () => {
				const rCtx = makeRCtx();
				const d = 8;
				rCtx.view.setInt32(d, 0, true);
				rCtx.view.setInt32(d + 4, 0, true);
				rCtx.view.setInt32(d + 8, 100, true);
				rCtx.view.setInt32(d + 12, 100, true);
				rCtx.view.setInt32(d + 16, 100, true);
				rCtx.view.setInt32(d + 20, 50, true);
				rCtx.view.setInt32(d + 24, 50, true);
				rCtx.view.setInt32(d + 28, 100, true);

				handleEmfGdiShapeRecord(rCtx, EMR_ARCTO, d, 40);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.lineTo).toHaveBeenCalledOnce(); // lineTo for arc start connection
			});
		});

		// -----------------------------------------------------------------------
		// EMR_CHORD
		// -----------------------------------------------------------------------

		describe('eMR_CHORD', () => {
			it('draws a chord (filled with closePath)', () => {
				const rCtx = makeRCtx();
				const d = 8;
				rCtx.view.setInt32(d, 0, true);
				rCtx.view.setInt32(d + 4, 0, true);
				rCtx.view.setInt32(d + 8, 100, true);
				rCtx.view.setInt32(d + 12, 100, true);
				rCtx.view.setInt32(d + 16, 100, true);
				rCtx.view.setInt32(d + 20, 50, true);
				rCtx.view.setInt32(d + 24, 0, true);
				rCtx.view.setInt32(d + 28, 50, true);

				const result = handleEmfGdiShapeRecord(rCtx, EMR_CHORD, d, 40);
				expect(result).toBe(true);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.closePath).toHaveBeenCalledOnce();
				expect(ctx.fill).toHaveBeenCalledOnce();
				expect(ctx.stroke).toHaveBeenCalledOnce();
			});
		});

		// -----------------------------------------------------------------------
		// EMR_PIE
		// -----------------------------------------------------------------------

		describe('eMR_PIE', () => {
			it('draws a pie (filled with moveTo to center and closePath)', () => {
				const rCtx = makeRCtx();
				const d = 8;
				rCtx.view.setInt32(d, 0, true);
				rCtx.view.setInt32(d + 4, 0, true);
				rCtx.view.setInt32(d + 8, 100, true);
				rCtx.view.setInt32(d + 12, 100, true);
				rCtx.view.setInt32(d + 16, 100, true);
				rCtx.view.setInt32(d + 20, 50, true);
				rCtx.view.setInt32(d + 24, 0, true);
				rCtx.view.setInt32(d + 28, 50, true);

				const result = handleEmfGdiShapeRecord(rCtx, EMR_PIE, d, 40);
				expect(result).toBe(true);
				const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
				expect(ctx.moveTo).toHaveBeenCalledOnce(); // moveTo center
				expect(ctx.closePath).toHaveBeenCalledOnce();
				expect(ctx.fill).toHaveBeenCalledOnce();
				expect(ctx.stroke).toHaveBeenCalledOnce();
			});

			it('does not update curX/curY (not arcTo)', () => {
				const rCtx = makeRCtx();
				rCtx.state.curX = 0;
				rCtx.state.curY = 0;
				const d = 8;
				rCtx.view.setInt32(d, 0, true);
				rCtx.view.setInt32(d + 4, 0, true);
				rCtx.view.setInt32(d + 8, 100, true);
				rCtx.view.setInt32(d + 12, 100, true);
				rCtx.view.setInt32(d + 16, 100, true);
				rCtx.view.setInt32(d + 20, 50, true);
				rCtx.view.setInt32(d + 24, 50, true);
				rCtx.view.setInt32(d + 28, 100, true);

				handleEmfGdiShapeRecord(rCtx, EMR_PIE, d, 40);
				// curX/curY should NOT change for EMR_PIE
				expect(rCtx.state.curX).toBe(0);
				expect(rCtx.state.curY).toBe(0);
			});
		});
	});
});
