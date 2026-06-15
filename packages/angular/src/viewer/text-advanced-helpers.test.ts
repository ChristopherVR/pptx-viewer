/**
 * text-advanced-helpers.test.ts — Unit tests for text-advanced-helpers.ts.
 *
 * All tests are pure (no TestBed / DOM). They exercise the reader and
 * patch-builder functions directly.
 */

import { describe, expect, it } from 'vitest';

import {
	alignPatch,
	characterSpacingPatch,
	lineSpacingPatch,
	textAdvancedPatch,
	textAdvancedStateFromStyle,
	textAdvancedStateOf,
	textDirectionPatch,
	vAlignPatch,
} from './text-advanced-helpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTextEl(textStyle: Record<string, unknown> = {}): Record<string, unknown> {
	return { id: 'el-1', type: 'text', x: 0, y: 0, width: 100, height: 100, textStyle };
}

function makeShapeEl(): Record<string, unknown> {
	return {
		id: 'el-2',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle: {},
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asEl = (x: unknown): any => x;

function getTextStyle(patch: unknown): Record<string, unknown> {
	return (patch as Record<string, unknown>)['textStyle'] as Record<string, unknown>;
}

// ── textAdvancedStateFromStyle ────────────────────────────────────────────────

describe('textAdvancedStateFromStyle', () => {
	it('returns defaults when style is undefined', () => {
		const state = textAdvancedStateFromStyle(undefined);
		expect(state.characterSpacing).toBe(0);
		expect(state.lineSpacing).toBeCloseTo(1.0);
		expect(state.lineSpacingExactPt).toBeNull();
		expect(state.align).toBe('left');
		expect(state.vAlign).toBe('top');
		expect(state.textDirection).toBe('horizontal');
		expect(state.rtl).toBeFalsy();
	});

	it('reads character spacing', () => {
		const state = textAdvancedStateFromStyle({ characterSpacing: 200 });
		expect(state.characterSpacing).toBe(200);
	});

	it('reads lineSpacing multiplier', () => {
		const state = textAdvancedStateFromStyle({ lineSpacing: 1.5 });
		expect(state.lineSpacing).toBeCloseTo(1.5);
		expect(state.lineSpacingExactPt).toBeNull();
	});

	it('reads exact line spacing when set', () => {
		const state = textAdvancedStateFromStyle({ lineSpacingExactPt: 18 });
		expect(state.lineSpacingExactPt).toBe(18);
	});

	it('reads paragraph spacing before and after', () => {
		const state = textAdvancedStateFromStyle({
			paragraphSpacingBefore: 6,
			paragraphSpacingAfter: 12,
		});
		expect(state.paragraphSpacingBefore).toBe(6);
		expect(state.paragraphSpacingAfter).toBe(12);
	});

	it('reads alignment and vertical anchor', () => {
		const state = textAdvancedStateFromStyle({ align: 'center', vAlign: 'middle' });
		expect(state.align).toBe('center');
		expect(state.vAlign).toBe('middle');
	});

	it('reads indent and margin left', () => {
		const state = textAdvancedStateFromStyle({
			paragraphIndent: 20,
			paragraphMarginLeft: 40,
		});
		expect(state.paragraphIndent).toBe(20);
		expect(state.paragraphMarginLeft).toBe(40);
	});

	it('reads text direction and RTL', () => {
		const state = textAdvancedStateFromStyle({ textDirection: 'vertical', rtl: true });
		expect(state.textDirection).toBe('vertical');
		expect(state.rtl).toBeTruthy();
	});
});

// ── textAdvancedStateOf ───────────────────────────────────────────────────────

describe('textAdvancedStateOf', () => {
	it('returns defaults for a non-text element', () => {
		const state = textAdvancedStateOf(asEl(makeShapeEl()));
		expect(state.align).toBe('left');
		expect(state.characterSpacing).toBe(0);
	});

	it('reads from textStyle on a text element', () => {
		const el = makeTextEl({ align: 'right', characterSpacing: 100 });
		const state = textAdvancedStateOf(asEl(el));
		expect(state.align).toBe('right');
		expect(state.characterSpacing).toBe(100);
	});
});

// ── textAdvancedPatch ─────────────────────────────────────────────────────────

describe('textAdvancedPatch', () => {
	it('merges changes into existing textStyle without losing other fields', () => {
		const el = makeTextEl({ fontSize: 16, color: '#ff0000' });
		const patch = textAdvancedPatch(asEl(el), { characterSpacing: 150 });
		const ts = getTextStyle(patch);
		expect(ts['characterSpacing']).toBe(150);
		expect(ts['fontSize']).toBe(16);
		expect(ts['color']).toBe('#ff0000');
	});

	it('works for non-text elements (uses empty base)', () => {
		const el = makeShapeEl();
		const patch = textAdvancedPatch(asEl(el), { align: 'center' });
		const ts = getTextStyle(patch);
		expect(ts['align']).toBe('center');
	});
});

// ── characterSpacingPatch ─────────────────────────────────────────────────────

describe('characterSpacingPatch', () => {
	it('sets characterSpacing', () => {
		const el = makeTextEl({ fontSize: 12 });
		const ts = getTextStyle(characterSpacingPatch(asEl(el), 200));
		expect(ts['characterSpacing']).toBe(200);
		expect(ts['fontSize']).toBe(12);
	});
});

// ── lineSpacingPatch ──────────────────────────────────────────────────────────

describe('lineSpacingPatch', () => {
	it('sets multiplier and clears exactPt when exactPt is null', () => {
		const el = makeTextEl({ lineSpacingExactPt: 18 });
		const ts = getTextStyle(lineSpacingPatch(asEl(el), 1.5, null));
		expect(ts['lineSpacing']).toBeCloseTo(1.5);
		expect(ts['lineSpacingExactPt']).toBeUndefined();
	});

	it('sets exactPt and clears multiplier when exactPt is provided', () => {
		const el = makeTextEl({ lineSpacing: 1.2 });
		const ts = getTextStyle(lineSpacingPatch(asEl(el), 1.0, 18));
		expect(ts['lineSpacingExactPt']).toBe(18);
		expect(ts['lineSpacing']).toBeUndefined();
	});
});

// ── alignPatch ────────────────────────────────────────────────────────────────

describe('alignPatch', () => {
	it('sets align', () => {
		const el = makeTextEl({ align: 'left' });
		const ts = getTextStyle(alignPatch(asEl(el), 'center'));
		expect(ts['align']).toBe('center');
	});

	it('accepts justify', () => {
		const el = makeTextEl();
		const ts = getTextStyle(alignPatch(asEl(el), 'justify'));
		expect(ts['align']).toBe('justify');
	});
});

// ── vAlignPatch ───────────────────────────────────────────────────────────────

describe('vAlignPatch', () => {
	it('sets vAlign to middle', () => {
		const el = makeTextEl({ vAlign: 'top' });
		const ts = getTextStyle(vAlignPatch(asEl(el), 'middle'));
		expect(ts['vAlign']).toBe('middle');
	});
});

// ── textDirectionPatch ────────────────────────────────────────────────────────

describe('textDirectionPatch', () => {
	it('sets textDirection to vertical', () => {
		const el = makeTextEl({ textDirection: 'horizontal' });
		const ts = getTextStyle(textDirectionPatch(asEl(el), 'vertical'));
		expect(ts['textDirection']).toBe('vertical');
	});

	it('preserves existing textStyle fields', () => {
		const el = makeTextEl({ fontSize: 14, color: '#00ff00' });
		const ts = getTextStyle(textDirectionPatch(asEl(el), 'vertical270'));
		expect(ts['fontSize']).toBe(14);
		expect(ts['color']).toBe('#00ff00');
	});
});
