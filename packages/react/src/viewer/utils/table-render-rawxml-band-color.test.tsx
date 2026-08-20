/**
 * A raw-XML table (loaded from a real .pptx) must let the table style's own
 * header/band text colour show through when a cell declares no explicit run
 * colour - the normal case, since table styles exist precisely so authors
 * don't have to hand-colour every header cell.
 *
 * `extractTableCellStyle` used to unconditionally seed its result with the
 * element's plain fallback colour, so the merge `{...bandStyle, ...xmlCellStyle}`
 * always let that fallback clobber the band's own colour. The structured-model
 * path (`table-render-data.tsx`, covered by `table-render-data-banding.test.tsx`)
 * never had this bug; this is the raw-XML path every table loaded from an
 * actual .pptx file goes through.
 */
import type { TablePptxElement, XmlObject } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { renderTableElement } from './table-render';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

function cellXml(text: string): XmlObject {
	return {
		'a:txBody': {
			'a:p': { 'a:r': { 'a:t': text } },
		},
	} as XmlObject;
}

function rowXml(cells: string[]): XmlObject {
	return { 'a:tc': cells.map(cellXml) } as XmlObject;
}

/** A raw-XML table with a header row, no explicit per-cell colour anywhere. */
function rawXmlTable(): TablePptxElement {
	const tblXml: XmlObject = {
		'a:tblGrid': { 'a:gridCol': [{ '@_w': '1828800' }, { '@_w': '1828800' }] },
		'a:tr': [rowXml(['H1', 'H2']), rowXml(['A1', 'A2'])],
	};
	return {
		id: 'tbl-1',
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 120,
		tableData: {
			columnWidths: [0.5, 0.5],
			firstRowHeader: true,
			bandedRows: true,
			rows: [
				{ cells: [{ text: 'H1' }, { text: 'H2' }] },
				{ cells: [{ text: 'A1' }, { text: 'A2' }] },
			],
		},
		rawXml: {
			'a:graphic': { 'a:graphicData': { 'a:tbl': tblXml } },
		} as XmlObject,
	} as TablePptxElement;
}

/** Every `<td …style="…">` fragment, in document order. */
function cellStyles(markup: string): string[] {
	return Array.from(markup.matchAll(/<td[^>]*style="([^"]*)"/gu)).map((match) => match[1]);
}

describe('raw-XML table band colour', () => {
	it("lets the header band's own text colour survive an un-styled cell", () => {
		// A non-trivial element default colour: proves the band colour is not
		// merely surviving because there was nothing to clobber it with.
		const markup = renderToStaticMarkup(renderTableElement(rawXmlTable(), { color: '#000000' }));
		const [header] = cellStyles(markup);
		// The default header emphasis (no table-style GUID) paints white text on
		// a dark fill; the fallback bug painted the element's plain default
		// colour instead, silently losing the band's white.
		expect(header).toContain('color:#ffffff');
	});
});
