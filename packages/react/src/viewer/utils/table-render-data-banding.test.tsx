/**
 * Programmatic tables must be banded in React too.
 *
 * React has two table renderers. The rawXml one (`table-render.tsx`) called the
 * shared band cascade; the structured-model one (`table-render-data.tsx`), which
 * is what a table inserted from the ribbon or built by the AI panel goes
 * through, imported `TableStyleContext` as a TYPE and called
 * `getTableCellBandStyle` nowhere. So the same table that Vue, Angular, Svelte
 * and Vanilla painted with a header row and alternating bands came out
 * completely flat in React, and no unit suite could see it because both paths
 * rendered "a table".
 *
 * The cascade now lives in `pptx-viewer-shared`'s `tableCellCss`, so this
 * asserts the effect (distinct header / band-1 / band-2 fills) rather than that
 * a particular helper was called.
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

/** Exactly what shared's `newTableElement` produces for Insert > Table. */
function insertedTable(): TablePptxElement {
	return {
		id: 'tbl-1',
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: {
			columnWidths: [0.5, 0.5],
			firstRowHeader: true,
			bandedRows: true,
			rows: [
				{ cells: [{ text: 'H1' }, { text: 'H2' }] },
				{ cells: [{ text: 'A1' }, { text: 'A2' }] },
				{ cells: [{ text: 'B1' }, { text: 'B2' }] },
			],
		},
	} as TablePptxElement;
}

/** Every `<td …style="…">` fragment, in document order. */
function cellStyles(markup: string): string[] {
	return Array.from(markup.matchAll(/<td[^>]*style="([^"]*)"/gu)).map((match) => match[1]);
}

describe('programmatic table banding', () => {
	it('paints the header row and alternating bands', () => {
		const markup = renderToStaticMarkup(renderTableElement(insertedTable(), {}));
		const styles = cellStyles(markup);
		// 2 columns x 3 rows.
		expect(styles).toHaveLength(6);
		const [header, , band1, , band2] = styles;
		expect(header).toContain('background-color');
		expect(header).toContain('font-weight:700');
		// Banded body rows differ from each other and from the header.
		expect(band1).not.toBe(band2);
		expect(band1).not.toBe(header);
	});

	it('lets an explicit cell fill beat the band underneath it', () => {
		const element = insertedTable();
		element.tableData!.rows[1].cells[0].style = { backgroundColor: '#00ff00' };
		const markup = renderToStaticMarkup(renderTableElement(element, {}));
		expect(cellStyles(markup)[2]).toContain('background-color:#00ff00');
	});

	it('floors an unstyled body cell at the dark slide-text colour', () => {
		const element = insertedTable();
		element.tableData!.firstRowHeader = false;
		element.tableData!.bandedRows = false;
		const markup = renderToStaticMarkup(renderTableElement(element, {}));
		expect(cellStyles(markup)[0]).toContain('color:#111827');
	});
});
