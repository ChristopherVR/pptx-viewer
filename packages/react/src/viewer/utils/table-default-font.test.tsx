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
});
