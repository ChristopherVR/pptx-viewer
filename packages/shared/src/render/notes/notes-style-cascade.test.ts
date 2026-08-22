import type { PptxTextStyleLevels } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyNotesLevelDefaults, resolveNotesLevelStyle } from './notes-style-cascade';

describe('resolveNotesLevelStyle', () => {
	it('returns an empty descriptor when notesStyle is absent', () => {
		expect(resolveNotesLevelStyle(undefined, 0)).toStrictEqual({});
	});

	it('converts a level fontSize from px (PlaceholderTextLevelStyle convention) to pt', () => {
		const notesStyle: PptxTextStyleLevels = {
			0: { fontSize: 24, bold: true },
		};
		const descriptor = resolveNotesLevelStyle(notesStyle, 0);
		expect(descriptor.fontSize).toBeCloseTo(18, 5); // 24px * 0.75 = 18pt
		expect(descriptor.bold).toBeTruthy();
	});

	it('falls back to the defPPr default (level -1) for a field the level omits', () => {
		const notesStyle: PptxTextStyleLevels = {
			[-1]: { fontSize: 12, color: '#222222' },
			0: { bold: true },
		};
		const descriptor = resolveNotesLevelStyle(notesStyle, 0);
		expect(descriptor.fontSize).toBeCloseTo(9, 5); // 12px * 0.75 = 9pt
		expect(descriptor.color).toBe('#222222');
		expect(descriptor.bold).toBeTruthy();
	});

	it('prefers the level value over defPPr when both are set', () => {
		const notesStyle: PptxTextStyleLevels = {
			[-1]: { fontSize: 12 },
			0: { fontSize: 32 },
		};
		expect(resolveNotesLevelStyle(notesStyle, 0).fontSize).toBeCloseTo(24, 5);
	});

	it('resolves any of the nine outline levels independently', () => {
		const notesStyle: PptxTextStyleLevels = {
			0: { fontSize: 24 },
			3: { fontSize: 16 },
		};
		expect(resolveNotesLevelStyle(notesStyle, 3).fontSize).toBeCloseTo(12, 5);
		// Level 4 has no own entry and no defPPr fallback: empty descriptor.
		expect(resolveNotesLevelStyle(notesStyle, 4)).toStrictEqual({});
	});

	it('omits keys the notes style never defines rather than setting them to undefined', () => {
		const notesStyle: PptxTextStyleLevels = { 0: { fontSize: 24 } };
		const descriptor = resolveNotesLevelStyle(notesStyle, 0);
		expect(Object.keys(descriptor)).toStrictEqual(['fontSize']);
	});
});

describe('applyNotesLevelDefaults', () => {
	it('returns segments unchanged when the descriptor is empty', () => {
		const segments = [{ text: 'hi', style: {} }];
		expect(applyNotesLevelDefaults(segments, {})).toBe(segments);
	});

	it('fills in an unset fontSize without overriding an explicit one', () => {
		const segments = [
			{ text: 'inherits', style: {} },
			{ text: 'explicit', style: { fontSize: 30 } },
		];
		const result = applyNotesLevelDefaults(segments, { fontSize: 18 });
		expect(result[0].style.fontSize).toBe(18);
		expect(result[1].style.fontSize).toBe(30);
	});

	it('leaves paragraph-break segments untouched', () => {
		const segments = [{ text: '', style: {}, isParagraphBreak: true }];
		const result = applyNotesLevelDefaults(segments, { fontSize: 18 });
		expect(result[0]).toStrictEqual(segments[0]);
	});

	it('fills fontFamily, bold, italic, color, and marginLeft independently', () => {
		const segments = [{ text: 'x', style: { bold: true } }];
		const result = applyNotesLevelDefaults(segments, {
			fontFamily: 'Calibri',
			bold: false,
			italic: true,
			color: '#111111',
			marginLeft: 12,
		});
		expect(result[0].style).toStrictEqual({
			bold: true, // explicit value preserved, not overridden by the descriptor's `false`
			fontFamily: 'Calibri',
			italic: true,
			color: '#111111',
			paragraphMarginLeft: 12,
		});
	});
});
