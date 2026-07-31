/**
 * Tests for the advanced table-cell fill controls.
 *
 * Focus: the pattern-preset select used to render `PATTERN_OPTIONS` (the bare
 * `a:pattFill/@prst` token list) as its own option text, so the user chose
 * between `ltDnDiag` and `narVert`. The guard below asserts both halves of the
 * fix: the text is now a dictionary key, and the VALUES are untouched, because
 * the value is what lands in `patternFillPreset` and what the other bindings
 * are diffed against.
 */
import type { PptxTableCellStyle } from 'pptx-viewer-core';
import { PATTERN_OPTIONS } from 'pptx-viewer-shared';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { TableCellAdvancedFill } = await import('./TableCellAdvancedFill');

function renderPattern(style: Partial<PptxTableCellStyle> = {}): string {
	return renderToStaticMarkup(
		<TableCellAdvancedFill
			cellStyle={{ fillMode: 'pattern', ...style } as PptxTableCellStyle}
			canEdit
			onUpdateCellStyle={vi.fn()}
		/>,
	);
}

describe('tableCellAdvancedFill - pattern presets', () => {
	it('offers exactly the shared preset list, by value', () => {
		const html = renderPattern();
		for (const preset of PATTERN_OPTIONS) {
			expect(html).toContain(`value="${preset}"`);
		}
	});

	it('spells each preset instead of printing its wire token', () => {
		const html = renderPattern();
		expect(html).toContain('pptx.fillPatterns.pct5');
		expect(html).toContain('pptx.fillPatterns.lightHorizontal');
		expect(html).toContain('pptx.fillPatterns.narrowVertical');
		// The raw tokens must no longer appear as option text.
		expect(html).not.toMatch(/>ltHorz</u);
		expect(html).not.toMatch(/>narVert</u);
		expect(html).not.toMatch(/>pct5</u);
	});

	it('keeps the fill-mode select untouched', () => {
		const html = renderPattern();
		expect(html).toContain('pptx.table.fillMode');
		expect(html).toContain('value="pattern"');
	});
});
