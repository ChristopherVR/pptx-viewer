// @vitest-environment jsdom
/**
 * `makeTextTexture` tests. jsdom supplies `document`; the canvas 2D context
 * itself is stubbed (jsdom has no real font metrics, matching
 * `text-metric-tracking.test.ts`'s established pattern) since the point here
 * is the font-string/colour/underline LOGIC the emphasis override drives, not
 * a rendered glyph.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTextTexture } from './text-texture';

interface FakeCtx2D {
	font: string;
	fillStyle: string;
	strokeStyle: string;
	lineWidth: number;
	fillText: ReturnType<typeof vi.fn>;
	measureText: ReturnType<typeof vi.fn>;
	clearRect: ReturnType<typeof vi.fn>;
	beginPath: ReturnType<typeof vi.fn>;
	moveTo: ReturnType<typeof vi.fn>;
	lineTo: ReturnType<typeof vi.fn>;
	stroke: ReturnType<typeof vi.fn>;
	textAlign: string;
	textBaseline: string;
}

function fakeCtx(): FakeCtx2D {
	return {
		font: '',
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 0,
		textAlign: '',
		textBaseline: '',
		fillText: vi.fn(),
		measureText: vi.fn(() => ({ width: 40 })),
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
	};
}

let ctx: FakeCtx2D;

beforeEach(() => {
	ctx = fakeCtx();
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		ctx as unknown as CanvasRenderingContext2D,
	);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('makeTextTexture', () => {
	it('returns null for empty text', () => {
		expect(makeTextTexture('', '#000', 12, 100, 40)).toBeNull();
	});

	it('uses the default weight (600) and fill colour with no emphasis', () => {
		makeTextTexture('Hello', '#333', 12, 100, 40);
		expect(ctx.font).toMatch(/^600 /);
		expect(ctx.font).not.toMatch(/italic/);
		expect(ctx.fillStyle).toBe('#333');
	});

	it('applies bold (700) and italic to the font string', () => {
		makeTextTexture('Hello', '#333', 12, 100, 40, { bold: true, italic: true });
		expect(ctx.font).toMatch(/^italic 700 /);
	});

	it('applies an explicit non-bold override (400)', () => {
		makeTextTexture('Hello', '#333', 12, 100, 40, { bold: false });
		expect(ctx.font).toMatch(/^400 /);
	});

	it('overrides the fill colour when the emphasis carries one', () => {
		makeTextTexture('Hello', '#333', 12, 100, 40, { color: '#f00' });
		expect(ctx.fillStyle).toBe('#f00');
	});

	it('draws an underline stroke under each line when underline is set', () => {
		makeTextTexture('Hello', '#333', 12, 100, 40, { underline: true });
		expect(ctx.stroke).toHaveBeenCalledOnce();
		expect(ctx.moveTo).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
		expect(ctx.lineTo).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
	});

	it('does not draw an underline when not set', () => {
		makeTextTexture('Hello', '#333', 12, 100, 40);
		expect(ctx.stroke).not.toHaveBeenCalled();
	});

	it('scales the requested font size by fontScale', () => {
		makeTextTexture('Hi', '#333', 10, 100, 40, { fontScale: 2 });
		const match = /^(?:italic )?\d+ (\d+(?:\.\d+)?)px/.exec(ctx.font);
		expect(match).not.toBeNull();
		// Base attempt uses `fontSize * scale * SUPERSAMPLE`; with fontSize=10,
		// scale=2, this should be noticeably larger than the un-scaled case.
		const unscaled = fakeCtx();
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
			unscaled as unknown as CanvasRenderingContext2D,
		);
		makeTextTexture('Hi', '#333', 10, 100, 40);
		const unscaledMatch = /^(?:italic )?\d+ (\d+(?:\.\d+)?)px/.exec(unscaled.font);
		expect(unscaledMatch).not.toBeNull();
		expect(Number(match![1])).toBeGreaterThan(Number(unscaledMatch![1]));
	});

	it('ignores a non-finite or non-positive fontScale', () => {
		makeTextTexture('Hi', '#333', 10, 100, 40, { fontScale: Number.NaN });
		const withNaN = ctx.font;
		const clean = fakeCtx();
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
			clean as unknown as CanvasRenderingContext2D,
		);
		makeTextTexture('Hi', '#333', 10, 100, 40);
		expect(withNaN).toBe(clean.font);
	});
});
