// @vitest-environment happy-dom
/**
 * G8 (OpenXML parity audit, D3): `a:graphicFrameLocks/@noDrilldown` was
 * parsed and round-tripped but never enforced - a table's cells stayed
 * selectable/editable (double-click to edit) regardless of the lock, gated
 * only on `options.editable`.
 */
import type { TablePptxElement, XmlObject } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderTableElement } from './table-render';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

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

function table(overrides: Partial<TablePptxElement> = {}): TablePptxElement {
	return {
		id: 'tbl1',
		type: 'table',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		rawXml: tableRawXml([
			['A', 'B'],
			['C', 'D'],
		]),
		...overrides,
	} as TablePptxElement;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function mount(el: TablePptxElement, onSelectCell: (cell: unknown) => void): void {
	function Wrapper() {
		return (
			<table>
				<tbody>{renderTableElement(el, {}, { editable: true, onSelectCell })}</tbody>
			</table>
		);
	}
	act(() => {
		root.render(<Wrapper />);
	});
}

/** A structured (Insert > Table / AI-built) table, exercising `table-render-data.tsx`. */
function programmaticTable(overrides: Partial<TablePptxElement> = {}): TablePptxElement {
	return {
		id: 'tbl2',
		type: 'table',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: {
			columnWidths: [0.5, 0.5],
			rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }, { cells: [{ text: 'C' }, { text: 'D' }] }],
		},
		...overrides,
	} as TablePptxElement;
}

describe('table cell drilldown with a:graphicFrameLocks/@noDrilldown', () => {
	it('does not enter cell-edit mode on double-click when noDrilldown is set', () => {
		const onSelectCell = vi.fn();
		mount(table({ locks: { noDrilldown: true } } as Partial<TablePptxElement>), onSelectCell);
		const cell = container.querySelector('td')!;
		act(() => {
			cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		});
		expect(onSelectCell).not.toHaveBeenCalled();
	});

	it('enters cell-edit mode on double-click on an unlocked table', () => {
		const onSelectCell = vi.fn();
		mount(table(), onSelectCell);
		const cell = container.querySelector('td')!;
		act(() => {
			cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		});
		expect(onSelectCell).toHaveBeenCalledWith(
			expect.objectContaining({ rowIndex: 0, columnIndex: 0, isEditing: true }),
		);
	});

	it('also blocks the programmatic (Insert > Table) renderer when noDrilldown is set', () => {
		const onSelectCell = vi.fn();
		mount(
			programmaticTable({ locks: { noDrilldown: true } } as Partial<TablePptxElement>),
			onSelectCell,
		);
		const cell = container.querySelector('td')!;
		act(() => {
			cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		});
		expect(onSelectCell).not.toHaveBeenCalled();
	});
});
