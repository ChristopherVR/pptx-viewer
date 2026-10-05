/**
 * A table cell draws no border of its own. The deck's borders come from the cell style, so a side
 * with none renders with none (as PowerPoint draws it) instead of a default 1px border that pushes
 * the cell content in.
 */
import type { TablePptxElement } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { renderTableElement } from './table-render';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

function table(): TablePptxElement {
	return {
		id: 'tbl-1',
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: {
			columnWidths: [0.5, 0.5],
			rows: [
				{
					cells: [
						{ text: 'plain' },
						{ text: 'ruled', style: { borderLeftWidth: 2, borderLeftColor: '#ff0000' } },
					],
				},
			],
		},
	} as TablePptxElement;
}

describe('table cell default border', () => {
	it('adds no border class to a read-only cell and keeps an explicit border', () => {
		const markup = renderToStaticMarkup(renderTableElement(table(), {}));
		const cells = Array.from(markup.matchAll(/<td([^>]*)>/gu)).map((match) => match[1] ?? '');
		expect(cells).toHaveLength(2);
		for (const attributes of cells) {
			expect(attributes).not.toMatch(/class="[^"]*\bborder\b/u);
			expect(attributes).not.toContain('border-white');
		}
		expect(cells[1]).toContain('border-left:2px solid #ff0000');
		expect(cells[0]).not.toContain('border-left');
	});
});
