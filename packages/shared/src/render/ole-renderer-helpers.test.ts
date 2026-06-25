/**
 * tests for the framework-agnostic OLE type-resolution helpers.
 *
 * ported from the Angular binding's `ole-renderer-helpers.test.ts` so all three
 * bindings share one behavioural contract for OLE type resolution, colours,
 * labels, badges, aria labels, display names, and placeholder styles.
 */
import type { OlePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	getOleAriaLabel,
	getOleBadgeLabel,
	getOleDisplayName,
	getOleTypeColor,
	getOleTypeLabel,
	getPlaceholderStyle,
	resolveOleType,
} from './ole-renderer-helpers';
import type { ResolvedOleType } from './ole-renderer-helpers';

function makeOle(overrides: Partial<OlePptxElement> = {}): OlePptxElement {
	return {
		id: 'ole_test',
		type: 'ole',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		...overrides,
	};
}

const ALL_TYPES: ResolvedOleType[] = ['excel', 'word', 'pdf', 'visio', 'mathtype', 'unknown'];

describe('resolveOleType', () => {
	it('maps each known oleObjectType directly', () => {
		expect(resolveOleType(makeOle({ oleObjectType: 'excel' }))).toBe('excel');
		expect(resolveOleType(makeOle({ oleObjectType: 'word' }))).toBe('word');
		expect(resolveOleType(makeOle({ oleObjectType: 'pdf' }))).toBe('pdf');
		expect(resolveOleType(makeOle({ oleObjectType: 'visio' }))).toBe('visio');
		expect(resolveOleType(makeOle({ oleObjectType: 'mathtype' }))).toBe('mathtype');
	});

	it('falls back to progId when oleObjectType is package or unknown', () => {
		expect(resolveOleType(makeOle({ oleObjectType: 'package', oleProgId: 'Excel.Sheet.12' }))).toBe(
			'excel',
		);
		expect(
			resolveOleType(makeOle({ oleObjectType: 'unknown', oleProgId: 'Word.Document.12' })),
		).toBe('word');
	});

	it('detects types from progId heuristics', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'Excel.Sheet.12' }))).toBe('excel');
		expect(resolveOleType(makeOle({ oleProgId: 'Word.Document.8' }))).toBe('word');
		expect(resolveOleType(makeOle({ oleProgId: 'AcroExch.Document' }))).toBe('pdf');
		expect(resolveOleType(makeOle({ oleProgId: 'Acrobat.Document' }))).toBe('pdf');
		expect(resolveOleType(makeOle({ oleProgId: 'Visio.Drawing.11' }))).toBe('visio');
		expect(resolveOleType(makeOle({ oleProgId: 'Equation.3' }))).toBe('mathtype');
		expect(resolveOleType(makeOle({ oleProgId: 'MathType' }))).toBe('mathtype');
	});

	it('is case-insensitive for progId matching', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'EXCEL.Sheet.12' }))).toBe('excel');
	});

	it("returns 'unknown' when no type information exists or is unrecognised", () => {
		expect(resolveOleType(makeOle({}))).toBe('unknown');
		expect(resolveOleType(makeOle({ oleProgId: 'SomethingRandom.App.1' }))).toBe('unknown');
	});
});

describe('getOleTypeColor', () => {
	it('returns the documented brand colour per type', () => {
		expect(getOleTypeColor('excel')).toBe('#217346');
		expect(getOleTypeColor('word')).toBe('#2B579A');
		expect(getOleTypeColor('pdf')).toBe('#D4272E');
		expect(getOleTypeColor('visio')).toBe('#3955A3');
		expect(getOleTypeColor('mathtype')).toBe('#7B2D8E');
		expect(getOleTypeColor('unknown')).toBe('#666666');
	});

	it('returns a valid 6-digit hex colour for every type', () => {
		for (const t of ALL_TYPES) {
			expect(getOleTypeColor(t)).toMatch(/^#[0-9A-Fa-f]{6}$/u);
		}
	});
});

describe('getOleTypeLabel', () => {
	it('returns the human-readable label per type', () => {
		expect(getOleTypeLabel('excel')).toBe('Excel Spreadsheet');
		expect(getOleTypeLabel('word')).toBe('Word Document');
		expect(getOleTypeLabel('pdf')).toBe('PDF Document');
		expect(getOleTypeLabel('visio')).toBe('Visio Diagram');
		expect(getOleTypeLabel('mathtype')).toBe('Math Equation');
		expect(getOleTypeLabel('unknown')).toBe('Embedded Object');
	});

	it('returns a non-empty string for every type', () => {
		for (const t of ALL_TYPES) {
			expect(getOleTypeLabel(t).length).toBeGreaterThan(0);
		}
	});
});

describe('getOleBadgeLabel', () => {
	it("returns 'OLE' for unknown and the upper-cased type otherwise", () => {
		expect(getOleBadgeLabel('unknown')).toBe('OLE');
		expect(getOleBadgeLabel('excel')).toBe('EXCEL');
		expect(getOleBadgeLabel('pdf')).toBe('PDF');
		expect(getOleBadgeLabel('word')).toBe('WORD');
		expect(getOleBadgeLabel('visio')).toBe('VISIO');
		expect(getOleBadgeLabel('mathtype')).toBe('MATHTYPE');
	});

	it('returns an upper-case string for every known type', () => {
		for (const t of ALL_TYPES) {
			const label = getOleBadgeLabel(t);
			expect(label).toBe(label.toUpperCase());
		}
	});
});

describe('getOleAriaLabel', () => {
	it('includes the filename when available', () => {
		expect(getOleAriaLabel(makeOle({ oleObjectType: 'excel', fileName: 'budget.xlsx' }))).toBe(
			'Excel Spreadsheet: budget.xlsx',
		);
		expect(getOleAriaLabel(makeOle({ fileName: 'data.bin' }))).toBe('Embedded Object: data.bin');
	});

	it('uses the type label alone when no file name is present', () => {
		expect(getOleAriaLabel(makeOle({ oleObjectType: 'word' }))).toBe('Word Document');
		expect(getOleAriaLabel(makeOle({ oleProgId: 'AcroExch.Document.11' }))).toBe('PDF Document');
		expect(getOleAriaLabel(makeOle({}))).toBe('Embedded Object');
	});
});

describe('getOleDisplayName', () => {
	it('returns the file name when present', () => {
		expect(getOleDisplayName(makeOle({ oleObjectType: 'excel', fileName: 'budget.xlsx' }))).toBe(
			'budget.xlsx',
		);
	});

	it('falls back to the type label when fileName is absent', () => {
		expect(getOleDisplayName(makeOle({ oleObjectType: 'word' }))).toBe('Word Document');
		expect(getOleDisplayName(makeOle({}))).toBe('Embedded Object');
	});
});

describe('getPlaceholderStyle', () => {
	it('produces a style map with border, border-radius, and background-color', () => {
		const style = getPlaceholderStyle('excel');
		expect(style['border']).toBeDefined();
		expect(style['border-radius']).toBeDefined();
		expect(style['background-color']).toBeDefined();
	});

	it('incorporates the brand colour and differs per type', () => {
		expect(getPlaceholderStyle('excel')['border'] as string).toContain('#217346');
		expect(getPlaceholderStyle('excel')['border']).not.toBe(getPlaceholderStyle('pdf')['border']);
	});

	it('returns a style for every resolved type', () => {
		for (const t of ALL_TYPES) {
			expect(Object.keys(getPlaceholderStyle(t)).length).toBeGreaterThan(0);
		}
	});
});

describe('ole helper consistency', () => {
	it('colour, label, and badge are defined for all types', () => {
		for (const t of ALL_TYPES) {
			expect(getOleTypeColor(t)).toBeTruthy();
			expect(getOleTypeLabel(t)).toBeTruthy();
			expect(getOleBadgeLabel(t)).toBeTruthy();
		}
	});
});
