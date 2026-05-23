import { describe, it, expect } from 'vitest';

import { applyPen, applyBrush, applyFont, readUtf16LE, getStockObject } from './emf-canvas-helpers';
import type { DrawState } from './emf-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockCtx {
	strokeStyle: string;
	lineWidth: number;
	fillStyle: string;
	font: string;
	_lineDash: number[];
	setLineDash(dash: number[]): void;
}

function createMockCtx(): MockCtx {
	return {
		strokeStyle: '',
		lineWidth: 0,
		fillStyle: '',
		font: '',
		_lineDash: [] as number[],
		setLineDash(dash: number[]) {
			this._lineDash = dash;
		},
	};
}

const asCtx = (ctx: MockCtx): CanvasRenderingContext2D =>
	ctx as unknown as CanvasRenderingContext2D;

function createDefaultDrawState(overrides: Partial<DrawState> = {}): DrawState {
	return {
		penColor: '#000000',
		penWidth: 1,
		penStyle: 0,
		brushColor: '#ffffff',
		brushStyle: 0,
		textColor: '#000000',
		bkColor: '#ffffff',
		bkMode: 1,
		fontHeight: 12,
		fontWeight: 400,
		fontItalic: false,
		fontFamily: 'Arial',
		textAlign: 0,
		polyFillMode: 1,
		mapMode: 1,
		...overrides,
	} as DrawState;
}

// ---------------------------------------------------------------------------
// applyPen
// ---------------------------------------------------------------------------

describe('applyPen', () => {
	it('sets transparent stroke for null pen (style 5)', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ penStyle: 5 });
		applyPen(asCtx(ctx), state);
		expect(ctx.strokeStyle).toBe('rgba(0,0,0,0)');
		expect(ctx.lineWidth).toBe(0);
	});

	it('sets solid stroke with pen color and width', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ penColor: '#ff0000', penWidth: 3, penStyle: 0 });
		applyPen(asCtx(ctx), state);
		expect(ctx.strokeStyle).toBe('#ff0000');
		expect(ctx.lineWidth).toBe(3);
		expect(ctx._lineDash).toStrictEqual([]);
	});

	it('sets dash pattern for pen style 1', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ penStyle: 1 });
		applyPen(asCtx(ctx), state);
		expect(ctx._lineDash).toStrictEqual([8, 4]);
	});

	it('sets dot pattern for pen style 2', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ penStyle: 2 });
		applyPen(asCtx(ctx), state);
		expect(ctx._lineDash).toStrictEqual([2, 2]);
	});

	it('sets dash-dot pattern for pen style 3', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ penStyle: 3 });
		applyPen(asCtx(ctx), state);
		expect(ctx._lineDash).toStrictEqual([8, 4, 2, 4]);
	});

	it('sets dash-dot-dot pattern for pen style 4', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ penStyle: 4 });
		applyPen(asCtx(ctx), state);
		expect(ctx._lineDash).toStrictEqual([8, 4, 2, 4, 2, 4]);
	});

	it('enforces minimum line width of 1', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ penWidth: 0, penStyle: 0 });
		applyPen(asCtx(ctx), state);
		expect(ctx.lineWidth).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// applyBrush
// ---------------------------------------------------------------------------

describe('applyBrush', () => {
	it('sets transparent fill for hollow brush (style 1)', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ brushStyle: 1 });
		applyBrush(asCtx(ctx), state);
		expect(ctx.fillStyle).toBe('rgba(0,0,0,0)');
	});

	it('sets solid fill with brush color for style 0', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ brushColor: '#00ff00', brushStyle: 0 });
		applyBrush(asCtx(ctx), state);
		expect(ctx.fillStyle).toBe('#00ff00');
	});

	it('uses brush color for non-null non-hollow styles', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ brushColor: '#123456', brushStyle: 2 });
		applyBrush(asCtx(ctx), state);
		expect(ctx.fillStyle).toBe('#123456');
	});
});

// ---------------------------------------------------------------------------
// applyFont
// ---------------------------------------------------------------------------

describe('applyFont', () => {
	it('sets basic font string', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({
			fontHeight: 16,
			fontWeight: 400,
			fontItalic: false,
			fontFamily: 'Arial',
		});
		applyFont(asCtx(ctx), state);
		expect(ctx.font).toBe('16px Arial');
	});

	it('includes italic prefix when fontItalic is true', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ fontHeight: 14, fontItalic: true, fontFamily: 'Times' });
		applyFont(asCtx(ctx), state);
		expect(ctx.font).toContain('italic');
	});

	it('includes bold prefix for weight >= 700', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({
			fontHeight: 12,
			fontWeight: 700,
			fontFamily: 'Verdana',
		});
		applyFont(asCtx(ctx), state);
		expect(ctx.font).toContain('bold');
	});

	it('uses minimum font size of 8', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ fontHeight: 3, fontFamily: 'Courier' });
		applyFont(asCtx(ctx), state);
		expect(ctx.font).toContain('8px');
	});

	it('handles negative fontHeight by taking absolute value', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({ fontHeight: -20, fontFamily: 'Helvetica' });
		applyFont(asCtx(ctx), state);
		expect(ctx.font).toContain('20px');
	});

	it('combines italic and bold for heavy italic font', () => {
		const ctx = createMockCtx();
		const state = createDefaultDrawState({
			fontHeight: 18,
			fontWeight: 800,
			fontItalic: true,
			fontFamily: 'Georgia',
		});
		applyFont(asCtx(ctx), state);
		expect(ctx.font).toBe('italic bold 18px Georgia');
	});
});

// ---------------------------------------------------------------------------
// readUtf16LE
// ---------------------------------------------------------------------------

describe('readUtf16LE', () => {
	function makeView(chars: number[]): DataView {
		const buf = new ArrayBuffer(chars.length * 2);
		const view = new DataView(buf);
		for (let i = 0; i < chars.length; i++) {
			view.setUint16(i * 2, chars[i], true);
		}
		return view;
	}

	it('reads ASCII characters encoded as UTF-16LE', () => {
		const view = makeView([72, 101, 108, 108, 111]); // "Hello"
		expect(readUtf16LE(view, 0, 5)).toBe('Hello');
	});

	it('stops at null terminator', () => {
		const view = makeView([65, 66, 0, 67]); // "AB\0C"
		expect(readUtf16LE(view, 0, 4)).toBe('AB');
	});

	it('reads from specified offset', () => {
		const view = makeView([0, 0, 72, 105]); // skip 2 chars, then "Hi"
		expect(readUtf16LE(view, 4, 2)).toBe('Hi');
	});

	it('returns empty string for zero charCount', () => {
		const view = makeView([65]);
		expect(readUtf16LE(view, 0, 0)).toBe('');
	});

	it('handles offset beyond buffer without crashing', () => {
		const view = makeView([65]);
		expect(readUtf16LE(view, 100, 5)).toBe('');
	});

	it('reads Unicode characters', () => {
		// U+00E9 = e with accent, U+00F1 = n with tilde
		const view = makeView([0x00e9, 0x00f1]);
		expect(readUtf16LE(view, 0, 2)).toBe('\u00e9\u00f1');
	});
});

// ---------------------------------------------------------------------------
// getStockObject
// ---------------------------------------------------------------------------

describe('getStockObject', () => {
	it('returns white brush for index 0', () => {
		const obj = getStockObject(0);
		expect(obj).not.toBeNull();
		expect(obj!.kind).toBe('brush');
		expect((obj as Record<string, unknown>).color).toBe('#ffffff');
	});

	it('returns black brush for index 4', () => {
		const obj = getStockObject(4);
		expect(obj).not.toBeNull();
		expect(obj!.kind).toBe('brush');
		expect((obj as Record<string, unknown>).color).toBe('#000000');
	});

	it('returns hollow brush for index 5', () => {
		const obj = getStockObject(5);
		expect(obj).not.toBeNull();
		expect(obj!.kind).toBe('brush');
		expect((obj as Record<string, unknown>).style).toBe(1);
	});

	it('returns white pen for index 6', () => {
		const obj = getStockObject(6);
		expect(obj).not.toBeNull();
		expect(obj!.kind).toBe('pen');
		expect((obj as Record<string, unknown>).color).toBe('#ffffff');
	});

	it('returns black pen for index 7', () => {
		const obj = getStockObject(7);
		expect(obj).not.toBeNull();
		expect(obj!.kind).toBe('pen');
		expect((obj as Record<string, unknown>).color).toBe('#000000');
	});

	it('returns null pen for index 8', () => {
		const obj = getStockObject(8);
		expect(obj).not.toBeNull();
		expect(obj!.kind).toBe('pen');
		expect((obj as Record<string, unknown>).style).toBe(5);
	});

	it('returns monospace font for index 10', () => {
		const obj = getStockObject(10);
		expect(obj).not.toBeNull();
		expect(obj!.kind).toBe('font');
		expect((obj as Record<string, unknown>).family).toBe('monospace');
	});

	it('returns sans-serif font for index 13', () => {
		const obj = getStockObject(13);
		expect(obj).not.toBeNull();
		expect(obj!.kind).toBe('font');
		expect((obj as Record<string, unknown>).family).toBe('sans-serif');
	});

	it('returns null for unknown index', () => {
		expect(getStockObject(99)).toBeNull();
		expect(getStockObject(9)).toBeNull();
	});
});
