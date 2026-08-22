/**
 * Table cell image fill (`a:tcPr/a:blipFill`) and an explicitly-zeroed cell
 * margin must both render, through the same shared `tableCellCss` cascade
 * `table-render-data-banding.test.tsx` exercises for banding.
 */
import type { PptxTableCellStyle, TablePptxElement } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { renderTableElement } from './table-render';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

function tableWith(cellStyle: PptxTableCellStyle): TablePptxElement {
	return {
		id: 'tbl-image',
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: {
			columnWidths: [1],
			rows: [{ cells: [{ text: 'Cell', style: cellStyle }] }],
		},
	} as TablePptxElement;
}

/**
 * The first `<td …style="…">` fragment's style attribute value, with HTML
 * entities (`renderToStaticMarkup` escapes the quotes inside a `url("...")`
 * value as `&quot;`) decoded back to plain characters.
 */
function firstCellStyle(markup: string): string {
	const raw = Array.from(markup.matchAll(/<td[^>]*style="([^"]*)"/gu))[0]?.[1] ?? '';
	return raw.replace(/&quot;/g, '"');
}

describe('table cell image fill', () => {
	it('renders a resolved image fill as a cover background', () => {
		const element = tableWith({
			fillMode: 'image',
			backgroundImageFillData: 'data:image/png;base64,AAAA',
		});
		const markup = renderToStaticMarkup(renderTableElement(element, {}));
		const style = firstCellStyle(markup);
		expect(style).toContain('background-image:url("data:image/png;base64,AAAA")');
		expect(style).toContain('background-size:cover');
	});

	it('renders no background for an unresolved raw archive path', () => {
		const element = tableWith({
			fillMode: 'image',
			backgroundImageFillPath: 'ppt/media/image1.png',
		});
		const markup = renderToStaticMarkup(renderTableElement(element, {}));
		expect(firstCellStyle(markup)).not.toContain('background-image');
	});
});

describe('table cell explicit zero margin', () => {
	it('renders 0px padding rather than falling back to the default', () => {
		const element = tableWith({ marginLeft: 0, marginTop: 4 });
		const markup = renderToStaticMarkup(renderTableElement(element, {}));
		const style = firstCellStyle(markup);
		expect(style).toContain('padding-left:0px');
		expect(style).toContain('padding-top:4px');
	});
});
