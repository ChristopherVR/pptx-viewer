/**
 * Regression guard for the AI `merge_tables` render path.
 *
 * A vertical merge of two 5-row tables must RENDER 10 `<tr>` rows, not 5. The
 * pure {@link mergeTableElements} produces a 10-row `tableData`, but a table
 * loaded from a real `.pptx` also carries `rawXml` (the `<a:tbl>` graphic
 * frame). `renderTableElement` prefers that XML over `tableData`, so if the
 * merge leaves A's stale 5-row `rawXml` on the merged element the viewer shows
 * only A's 5 rows: exactly the browser observation. The merge therefore strips
 * `rawXml`, making `tableData` the single source of truth for the merged table.
 */
import type { TablePptxElement, XmlObject } from 'pptx-viewer-core';
import { mergeTableElements } from 'pptx-viewer-shared/ai';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { renderTableElement } from './table-render';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

/** Build a `<a:tbl>` graphic-frame `rawXml` for an `rows` x `cols` cell grid. */
function tableRawXml(grid: string[][]): XmlObject {
	const cols = grid[0].length;
	return {
		'a:graphic': {
			'a:graphicData': {
				'a:tbl': {
					'a:tblGrid': {
						'a:gridCol': Array.from({ length: cols }, () => ({ '@_w': 1000 })),
					},
					'a:tr': grid.map((cells) => ({
						'@_h': 370,
						'a:tc': cells.map((text) => ({
							'a:txBody': { 'a:p': { 'a:r': { 'a:t': text } } },
						})),
					})),
				},
			},
		},
	} as unknown as XmlObject;
}

/** A real-deck-style table element: structured `tableData` AND parsed `rawXml`. */
function tableWithRawXml(
	id: string,
	grid: string[][],
	bounds: { x: number; y: number; width: number; height: number },
): TablePptxElement {
	const cols = grid[0].length;
	return {
		id,
		type: 'table',
		...bounds,
		rawXml: tableRawXml(grid),
		tableData: {
			rows: grid.map((cells) => ({ cells: cells.map((text) => ({ text })) })),
			columnWidths: Array.from({ length: cols }, () => 1 / cols),
		},
	} as unknown as TablePptxElement;
}

/** Five distinct rows x two columns. */
function fiveRowGrid(tag: string): string[][] {
	return Array.from({ length: 5 }, (_unused, r) => [`${tag}-r${r}-c0`, `${tag}-r${r}-c1`]);
}

function countRows(markup: string): number {
	return (markup.match(/<tr\b/gu) ?? []).length;
}

describe('merge_tables render path (rawXml-bearing tables)', () => {
	it('renders 10 <tr> for a vertical merge of two 5-row real tables', () => {
		const a = tableWithRawXml('tbl-a', fiveRowGrid('A'), { x: 0, y: 0, width: 300, height: 200 });
		const b = tableWithRawXml('tbl-b', fiveRowGrid('B'), { x: 0, y: 210, width: 300, height: 200 });

		const merged = mergeTableElements(a, b, { direction: 'vertical' });
		expect(merged.tableData?.rows).toHaveLength(10);

		const markup = renderToStaticMarkup(renderTableElement(merged, {}));
		expect(countRows(markup)).toBe(10);
	});

	it('renders 10 <tr> even when the two tables are IDENTICAL duplicates', () => {
		// Mirrors the browser repro: table B is a Ctrl+D duplicate of A, so its
		// rawXml + tableData are structurally identical to A's.
		const grid = fiveRowGrid('DUP');
		const a = tableWithRawXml('dup-a', grid, { x: 0, y: 0, width: 300, height: 200 });
		const b = tableWithRawXml('dup-b', grid, { x: 0, y: 210, width: 300, height: 200 });

		const merged = mergeTableElements(a, b, { direction: 'vertical' });
		expect(merged.tableData?.rows).toHaveLength(10);

		const markup = renderToStaticMarkup(renderTableElement(merged, {}));
		expect(countRows(markup)).toBe(10);
	});
});
