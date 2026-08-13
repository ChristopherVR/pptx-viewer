import { XMLParser } from 'fast-xml-parser';
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { annotateParagraphSiblingOrder } from '../runtime/paragraph-sibling-order';
import { PptxTableDataParser } from './PptxTableDataParser';
import { extractTableCellTextRuns } from './table-cell-runs';
import type { TableCellRunsContext } from './table-cell-runs';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
	trimValues: false,
});

function ensureArray(value: unknown): unknown[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

const context: TableCellRunsContext = {
	ensureArray,
	parseColor: (colorNode) => {
		const srgb = (colorNode as XmlObject | undefined)?.['a:srgbClr'] as XmlObject | undefined;
		return srgb ? `#${String(srgb['@_val'])}` : undefined;
	},
};

/** Parse a `<a:tc>` fragment, running the sibling-order annotator over it. */
function parseCell(xml: string): XmlObject {
	const parsed = parser.parse(xml) as XmlObject;
	annotateParagraphSiblingOrder(xml, parsed);
	return parsed['a:tc'] as XmlObject;
}

describe('extractTableCellTextRuns', () => {
	it('returns undefined for a cell with no runs', () => {
		const cell = parseCell('<a:tc><a:txBody><a:bodyPr/><a:p/></a:txBody></a:tc>');
		expect(extractTableCellTextRuns(cell, context)).toBeUndefined();
	});

	it('captures per-run bold, colour, size and typeface', () => {
		// The pre-fix model kept only the FIRST run's rPr for the whole cell, so
		// "grew 42%" rendered in the plain style of "Revenue ".
		const cell = parseCell(
			'<a:tc><a:txBody><a:bodyPr/><a:p>' +
				'<a:r><a:rPr lang="en-US" sz="1200"/><a:t>Revenue </a:t></a:r>' +
				'<a:r><a:rPr lang="en-US" sz="1800" b="1" i="1" u="sng" strike="sngStrike">' +
				'<a:solidFill><a:srgbClr val="C00000"/></a:solidFill>' +
				'<a:latin typeface="Georgia"/></a:rPr><a:t>grew 42%</a:t></a:r>' +
				'</a:p></a:txBody></a:tc>',
		);
		const runs = extractTableCellTextRuns(cell, context);
		expect(runs).toHaveLength(2);
		expect(runs?.[0]).toStrictEqual({ text: 'Revenue ', fontSize: 12 });
		expect(runs?.[1]).toStrictEqual({
			text: 'grew 42%',
			bold: true,
			italic: true,
			underline: true,
			strikethrough: true,
			fontSize: 18,
			color: '#C00000',
			fontFamily: 'Georgia',
		});
	});

	it('falls back to a:ea / a:cs when a:latin is absent', () => {
		const cell = parseCell(
			'<a:tc><a:txBody><a:bodyPr/><a:p><a:r>' +
				'<a:rPr lang="ar-SA"><a:cs typeface="Traditional Arabic"/></a:rPr><a:t>x</a:t>' +
				'</a:r></a:p></a:txBody></a:tc>',
		);
		expect(extractTableCellTextRuns(cell, context)?.[0].fontFamily).toBe('Traditional Arabic');
	});

	it('marks paragraph boundaries between paragraphs', () => {
		const cell = parseCell(
			'<a:tc><a:txBody><a:bodyPr/>' +
				'<a:p><a:r><a:t>one</a:t></a:r></a:p>' +
				'<a:p><a:r><a:t>two</a:t></a:r></a:p>' +
				'</a:txBody></a:tc>',
		);
		const runs = extractTableCellTextRuns(cell, context);
		expect(runs?.map((r) => r.text)).toStrictEqual(['one', '', 'two']);
		expect(runs?.[1].isParagraphBreak).toBeTruthy();
	});

	it('keeps a soft break in its authored position among the runs', () => {
		// fast-xml-parser collapses same-tag siblings, so without the sibling-order
		// annotator the `a:br` would be emitted after BOTH runs.
		const cell = parseCell(
			'<a:tc><a:txBody><a:bodyPr/><a:p>' +
				'<a:r><a:t>top</a:t></a:r><a:br/><a:r><a:t>bottom</a:t></a:r>' +
				'</a:p></a:txBody></a:tc>',
		);
		const runs = extractTableCellTextRuns(cell, context);
		expect(runs?.map((r) => (r.isLineBreak ? '<br>' : r.text))).toStrictEqual([
			'top',
			'<br>',
			'bottom',
		]);
	});

	it('leaves the flat cell text untouched, so the #68 save guard still fires', () => {
		// The writer decides a cell was EDITED by comparing the flattened text it
		// re-derives from the source `a:txBody` against `cell.text`; an unedited
		// rich cell is then left verbatim. Runs are ADDITIVE, so `cell.text` must
		// stay the plain run-join it always was, or every rich cell would look
		// edited on save and be rebuilt as a single flat run.
		const table = new PptxTableDataParser({
			emuPerPx: 9525,
			ensureArray,
			parseColor: context.parseColor,
		}).parseTableData(
			parser.parse(
				'<a:tbl><a:tblGrid><a:gridCol w="100"/></a:tblGrid><a:tr h="100"><a:tc><a:txBody>' +
					'<a:bodyPr/><a:p><a:r><a:rPr b="1"/><a:t>Revenue </a:t></a:r>' +
					'<a:r><a:t>grew</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl>',
			) as XmlObject,
		);
		const cell = table?.rows[0].cells[0];
		expect(cell?.text).toBe('Revenue grew');
		expect(cell?.textRuns).toHaveLength(2);
		expect(cell?.textRuns?.[0].bold).toBeTruthy();
		expect(cell?.textRuns?.[1].bold).toBeUndefined();
	});
});
