/**
 * The table root declares the shared default font family.
 *
 * Table cell text that authors no typeface used to inherit whatever the HOST
 * chrome declared, so the same deck resolved a different fallback stack (and
 * different type metrics) in every binding: React took its Tailwind stack,
 * Vue/Vanilla a `system-ui` list, Angular/Svelte a third. All five now declare
 * `DEFAULT_FONT_FAMILY` on the `<table>` itself; authored cell / run / table
 * style fonts still win below it.
 */
import type { TablePptxElement } from 'pptx-viewer-core';
import { DEFAULT_FONT_FAMILY } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { renderTableElement } from './table-render';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

function tableElement(): TablePptxElement {
	return {
		id: 'tbl-1',
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 120,
		tableData: {
			columnWidths: [0.5, 0.5],
			rows: [{ cells: [{ text: 'Feature' }, { text: 'Starter' }] }],
		},
	} as TablePptxElement;
}

describe('table default font', () => {
	it('sets the shared family on the <table> element', () => {
		const markup = renderToStaticMarkup(renderTableElement(tableElement()));
		expect(markup).toContain('<table');
		// React serialises the inline style with the quotes escaped.
		expect(markup).toContain('font-family:&quot;Segoe UI&quot;');
		expect(DEFAULT_FONT_FAMILY.startsWith('"Segoe UI"')).toBeTruthy();
	});

	it('declares the master otherStyle default cell font size on the <table> element (item 3)', () => {
		// Cell text with no explicit a:rPr@sz previously fell back to the
		// browser's own default font size (16px / 12pt) instead of the master's
		// p:otherStyle default (commonly 18pt). Declaring it on the table root
		// lets ordinary CSS inheritance supply it to every unstyled cell.
		const element = tableElement();
		element.tableData!.defaultCellFontSize = 18;
		const markup = renderToStaticMarkup(renderTableElement(element));
		expect(markup).toContain('font-size:18pt');
	});

	it('omits font-size when no default resolved', () => {
		const markup = renderToStaticMarkup(renderTableElement(tableElement()));
		expect(markup).not.toContain('font-size');
	});
});
