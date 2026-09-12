// @vitest-environment happy-dom
/* oxlint-disable eslint/one-var -- many independent it() blocks, each with
   its own short arrange/act/assert consts. */
import type {
	ParsedTableStyleMap,
	PptxElement,
	TablePptxElement,
	XmlObject,
} from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderTableElement } from '../../utils/table-render';
import { TablePropertiesPanel } from './TablePropertiesPanel';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, vars?: Record<string, unknown>) =>
			vars ? `${key}:${Object.values(vars).join(',')}` : key,
	}),
}));

function table(): TablePptxElement {
	return {
		id: 't1',
		type: 'table',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		tableData: {
			columnWidths: [0.2, 0.3, 0.5],
			rows: [
				{ height: 20, cells: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] },
				{ height: 60, cells: [{ text: 'd' }, { text: 'e' }, { text: 'f' }] },
			],
		},
	} as unknown as TablePptxElement;
}

function loadedTable(): TablePptxElement {
	const element = table();
	element.rawXml = {
		'a:graphic': {
			'a:graphicData': {
				'a:tbl': {
					'a:tblGrid': { 'a:gridCol': [20, 30, 50].map((w) => ({ '@_w': w * 9525 })) },
					'a:tr': element.tableData!.rows.map((row) => ({
						'@_h': row.height! * 9525,
						'a:tc': row.cells.map((cell) => ({
							'a:txBody': {
								'a:bodyPr': { '@_anchor': 'ctr' },
								'a:p': {
									'a:pPr': { '@_marL': '12700' },
									'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': cell.text },
								},
							},
							'a:tcPr': { '@_marL': '91440' },
						})),
					})),
				},
			},
		},
	};
	return element;
}

function xmlCells(element: TablePptxElement, row: number): XmlObject[] {
	const graphic = element.rawXml!['a:graphic'] as XmlObject;
	const data = graphic['a:graphicData'] as XmlObject;
	const tbl = data['a:tbl'] as XmlObject;
	return (tbl['a:tr'] as XmlObject[])[row]['a:tc'] as XmlObject[];
}

function clickTableButton(key: string) {
	const button = [...host.querySelectorAll('button')].find(
		(item) => item.textContent === `pptx.table.${key}`,
	);
	expect(button).toBeDefined();
	act(() => button!.click());
}

function renderedCells(element: TablePptxElement): HTMLTableCellElement[] {
	const container = document.createElement('div');
	container.innerHTML = renderToStaticMarkup(renderTableElement(element, {}));
	return [...container.querySelectorAll<HTMLTableCellElement>('td')];
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
});

afterEach(() => {
	act(() => root.unmount());
	host.remove();
});

function render(
	element: TablePptxElement,
	onUpdateElement: (u: Partial<PptxElement>) => void,
	tableEditorState?: { rowIndex: number; columnIndex: number },
) {
	act(() => {
		root.render(
			React.createElement(TablePropertiesPanel, {
				tableElement: element,
				canEdit: true,
				onUpdateElement,
				tableEditorState,
			}),
		);
	});
}

describe('tablePropertiesPanel', () => {
	it.each([
		{
			command: 'mergeRight',
			span: 'gridSpan',
			xmlSpan: '@_gridSpan',
			htmlSpan: 'colspan',
			row: 0,
			col: 1,
		},
		{
			command: 'mergeDown',
			span: 'rowSpan',
			xmlSpan: '@_rowSpan',
			htmlSpan: 'rowspan',
			row: 1,
			col: 0,
		},
	] as const)(
		'repaints loaded-table $command and split with one immutable update each',
		({ command, span, xmlSpan, htmlSpan, row, col }) => {
			const element = loadedTable();
			const original = structuredClone(element);
			const onUpdate = vi.fn();
			render(element, onUpdate, { rowIndex: 0, columnIndex: 0 });
			clickTableButton(command);

			expect(onUpdate).toHaveBeenCalledOnce();
			const patch = onUpdate.mock.calls[0][0] as Partial<TablePptxElement>;
			const merged = { ...element, ...patch };
			expect(merged.tableData!.rows[0].cells[0][span]).toBe(2);
			expect(xmlCells(merged, 0)[0][xmlSpan]).toBe('2');
			expect(merged.tableData!.rows[row].cells[col].text).toBe('');
			const cells = renderedCells(merged);
			expect(cells).toHaveLength(5);
			expect(cells[0].getAttribute(htmlSpan)).toBe('2');
			expect(cells.map((cell) => cell.textContent)).not.toContain(
				original.tableData!.rows[row].cells[col].text,
			);
			// The synchronizer preserves the anchor and untouched rich XML, not just plain text.
			expect(xmlCells(merged, 0)[0]['a:txBody']).toStrictEqual(
				xmlCells(original, 0)[0]['a:txBody'],
			);
			expect(xmlCells(merged, 0)[2]).toStrictEqual(xmlCells(original, 0)[2]);
			expect(element).toStrictEqual(original);

			render(merged, onUpdate, { rowIndex: 0, columnIndex: 0 });
			clickTableButton('split');
			expect(onUpdate).toHaveBeenCalledTimes(2);
			const split = { ...merged, ...onUpdate.mock.calls[1][0] } as TablePptxElement;
			expect(xmlCells(split, 0)[0][xmlSpan]).toBeUndefined();
			const splitCells = renderedCells(split);
			expect(splitCells).toHaveLength(6);
			expect(splitCells[row * 3 + col].textContent?.trim()).toBe('');
			expect(xmlCells(split, 0)[0]['a:txBody']).toStrictEqual(xmlCells(original, 0)[0]['a:txBody']);
			expect(merged.tableData!.rows[0].cells[0][span]).toBe(2);
			expect(xmlCells(merged, 0)[0][xmlSpan]).toBe('2');
		},
	);

	it.each([
		{ command: 'mergeRight', rowIndex: 0, columnIndex: 2 },
		{ command: 'mergeDown', rowIndex: 1, columnIndex: 0 },
		{ command: 'split', rowIndex: 0, columnIndex: 0 },
	])('does not emit updates for invalid $command', ({ command, rowIndex, columnIndex }) => {
		const onUpdate = vi.fn();
		render(loadedTable(), onUpdate, { rowIndex, columnIndex });
		clickTableButton(command);
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('keeps programmatic merges on the data-only renderer without adding rawXml', () => {
		const element = table();
		const onUpdate = vi.fn();
		render(element, onUpdate, { rowIndex: 0, columnIndex: 0 });
		clickTableButton('mergeRight');
		const patch = onUpdate.mock.calls[0][0] as Partial<TablePptxElement>;
		expect(patch).not.toHaveProperty('rawXml');
		expect(renderedCells({ ...element, ...patch })[0].colSpan).toBe(2);
	});

	it('keeps ordinary cell styling on the generic data-only update path', () => {
		const element = loadedTable();
		const original = structuredClone(element);
		const onUpdate = vi.fn();
		render(element, onUpdate, { rowIndex: 0, columnIndex: 0 });
		const bold = host.querySelector<HTMLButtonElement>('button.font-bold');
		expect(bold).not.toBeNull();
		act(() => bold!.click());
		expect(onUpdate).toHaveBeenCalledOnce();
		expect(onUpdate.mock.calls[0][0]).not.toHaveProperty('rawXml');
		expect(onUpdate.mock.calls[0][0].tableData.rows[0].cells[0].style.bold).toBeTruthy();
		expect(element).toStrictEqual(original);
	});

	it('sets a column to the exact requested width via the shared redistribution formula', () => {
		const onUpdate = vi.fn();
		render(table(), onUpdate);

		const slider = host.querySelector<HTMLInputElement>('input[type="range"]');
		if (!slider) {
			throw new Error('column width slider not found');
		}
		act(() => {
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set as (
				v: string,
			) => void;
			setter.call(slider, '60');
			slider.dispatchEvent(new Event('change', { bubbles: true }));
		});

		expect(onUpdate).toHaveBeenCalledOnce();
		const widths = (onUpdate.mock.calls[0][0] as Partial<TablePptxElement>).tableData?.columnWidths;
		expect(widths?.[0]).toBeCloseTo(0.6, 5);
		expect(widths?.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
		// The untouched columns' 0.3:0.5 ratio to each other is preserved.
		expect((widths?.[2] ?? 0) / (widths?.[1] ?? 1)).toBeCloseTo(0.5 / 0.3, 5);
	});

	it('distributes column widths evenly', () => {
		const onUpdate = vi.fn();
		render(table(), onUpdate);

		const evenButtons = [...host.querySelectorAll('button')].filter(
			(b) => b.textContent === 'pptx.table.even',
		);
		act(() => evenButtons[0]?.click());

		const widths = (onUpdate.mock.calls[0][0] as Partial<TablePptxElement>).tableData?.columnWidths;
		expect(widths).toStrictEqual([1 / 3, 1 / 3, 1 / 3]);
	});

	it('distributes row heights evenly, rounded to the average', () => {
		const onUpdate = vi.fn();
		render(table(), onUpdate);

		const evenButtons = [...host.querySelectorAll('button')].filter(
			(b) => b.textContent === 'pptx.table.even',
		);
		act(() => evenButtons[1]?.click());

		const rows = (onUpdate.mock.calls[0][0] as Partial<TablePptxElement>).tableData?.rows;
		expect(rows?.[0].height).toBe(40);
		expect(rows?.[1].height).toBe(40);
	});

	it('applies a quick-style preset via the shared assignment helper', () => {
		const onUpdate = vi.fn();
		const el = table();
		if (el.tableData) {
			el.tableData.firstRowHeader = true;
		}
		render(el, onUpdate);

		const presetButton = host.querySelector<HTMLButtonElement>('button[title="Light 1"]');
		if (!presetButton) {
			throw new Error('Light 1 preset swatch not found');
		}
		act(() => presetButton.click());

		expect(onUpdate).toHaveBeenCalledOnce();
		const rows = (onUpdate.mock.calls[0][0] as Partial<TablePptxElement>).tableData?.rows;
		expect(rows?.[0].cells[0].style?.backgroundColor).toBe('#4472C4');
		expect(rows?.[0].cells[0].style?.bold).toBeTruthy();
	});

	it('keeps anchor runs and clears absorbed runs through merge-right then split', () => {
		const el = table();
		const anchorRuns = [{ text: 'a', bold: true }];
		el.tableData!.rows[0].cells[0].textRuns = anchorRuns;
		el.tableData!.rows[0].cells[1].textRuns = [{ text: 'b', italic: true }];
		const onUpdate = vi.fn();
		render(el, onUpdate, { rowIndex: 0, columnIndex: 0 });

		const mergeRight = [...host.querySelectorAll('button')].find(
			(button) => button.textContent === 'pptx.table.mergeRight',
		);
		act(() => mergeRight?.click());

		const merged = (onUpdate.mock.calls[0][0] as Partial<TablePptxElement>).tableData!;
		expect(merged.rows[0].cells[0].textRuns).toBe(anchorRuns);
		expect(merged.rows[0].cells[1].textRuns).toBeUndefined();

		const mergedElement = { ...el, tableData: merged };
		render(mergedElement, onUpdate, { rowIndex: 0, columnIndex: 0 });
		const split = [...host.querySelectorAll('button')].find(
			(button) => button.textContent === 'pptx.table.split',
		);
		act(() => split?.click());

		const splitData = (onUpdate.mock.calls[1][0] as Partial<TablePptxElement>).tableData!;
		expect(splitData.rows[0].cells[0].textRuns).toBe(anchorRuns);
		expect(splitData.rows[0].cells[1]).toMatchObject({ text: '' });
		expect(splitData.rows[0].cells[1].textRuns).toBeUndefined();
	});

	it('enables "Edit style..." with no tableStyleId, and assigns a created style to the table', () => {
		window.prompt = () => 'Brand New Style';
		const onUpdate = vi.fn();
		const onTableStyleMapChange = vi.fn();
		const el = table();
		act(() => {
			root.render(
				React.createElement(TablePropertiesPanel, {
					tableElement: el,
					canEdit: true,
					onUpdateElement: onUpdate,
					tableStyleMap: undefined,
					onTableStyleMapChange,
				}),
			);
		});

		const editButton = [...host.querySelectorAll('button')].find(
			(b) => b.textContent === 'pptx.tableStyleEditor.editButton',
		) as HTMLButtonElement;
		expect(editButton.disabled).toBeFalsy();
		act(() => editButton.click());

		const createButton = [...host.querySelectorAll('button')].find(
			(b) => b.textContent === 'pptx.tableStyleEditor.newStyle',
		) as HTMLButtonElement;
		expect(createButton).toBeTruthy();
		act(() => createButton.click());

		expect(onTableStyleMapChange).toHaveBeenCalledOnce();
		const nextMap = onTableStyleMapChange.mock.calls[0][0] as ParsedTableStyleMap;
		const newId = Object.keys(nextMap)[0];
		expect(onUpdate).toHaveBeenCalledWith({
			tableData: expect.objectContaining({ tableStyleId: newId }),
		});
	});
});
