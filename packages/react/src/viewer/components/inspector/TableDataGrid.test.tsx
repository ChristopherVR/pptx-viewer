// @vitest-environment happy-dom
import type { PptxElement, TablePptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableDataGrid } from './TableDataGrid';

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
			columnWidths: [0.5, 0.5],
			rows: [{ cells: [{ text: 'a' }, { text: 'b' }] }, { cells: [{ text: 'c' }, { text: 'd' }] }],
		},
	} as unknown as TablePptxElement;
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

function render(element: TablePptxElement, onUpdateElement: (u: Partial<PptxElement>) => void) {
	act(() => {
		root.render(
			React.createElement(TableDataGrid, { tableElement: element, canEdit: true, onUpdateElement }),
		);
	});
}

function cellInput(row: number, col: number): HTMLInputElement {
	const label = `pptx.tableDataEditor.cellAriaLabel:${row},${col}`;
	const found = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
	if (!found) {
		throw new Error(`no cell input for ${label}`);
	}
	return found;
}

describe('tableDataGrid', () => {
	it('renders one labelled text input per cell', () => {
		render(table(), () => {});
		expect(host.querySelectorAll('[role="gridcell"] input')).toHaveLength(4);
		expect(cellInput(1, 1).value).toBe('a');
		expect(cellInput(2, 2).value).toBe('d');
	});

	it('commits a cell text edit as a tableData patch', () => {
		const onUpdate = vi.fn();
		render(table(), onUpdate);

		const input = cellInput(1, 2);
		act(() => {
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set as (
				v: string,
			) => void;
			setter.call(input, 'B!');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});

		expect(onUpdate).toHaveBeenCalledOnce();
		const patch = onUpdate.mock.calls[0][0] as Partial<TablePptxElement>;
		expect(patch.tableData?.rows[0].cells[1].text).toBe('B!');
		expect(patch.tableData?.rows[1].cells[0].text).toBe('c');
	});

	it('adds and removes rows and columns through the header controls', () => {
		const onUpdate = vi.fn();
		const el = table();
		render(el, onUpdate);

		const byText = (text: string) =>
			[...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

		act(() => byText('pptx.tableDataEditor.addRowLabel')?.click());
		expect((onUpdate.mock.calls[0][0] as Partial<TablePptxElement>).tableData?.rows).toHaveLength(
			3,
		);

		act(() => byText('pptx.tableDataEditor.addColumnLabel')?.click());
		expect(
			(onUpdate.mock.calls[1][0] as Partial<TablePptxElement>).tableData?.columnWidths,
		).toHaveLength(3);

		act(() => byText('pptx.tableDataEditor.removeRowLabel')?.click());
		expect((onUpdate.mock.calls[2][0] as Partial<TablePptxElement>).tableData?.rows).toHaveLength(
			1,
		);

		act(() => byText('pptx.tableDataEditor.removeColumnLabel')?.click());
		expect(
			(onUpdate.mock.calls[3][0] as Partial<TablePptxElement>).tableData?.columnWidths,
		).toHaveLength(1);
	});

	it('removes a specific row and column from the header x buttons', () => {
		const onUpdate = vi.fn();
		render(table(), onUpdate);

		const remove = (label: string) =>
			host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

		act(() => remove('pptx.tableDataEditor.removeRowN:1')?.click());
		const rows = (onUpdate.mock.calls[0][0] as Partial<TablePptxElement>).tableData?.rows;
		expect(rows).toHaveLength(1);
		expect(rows?.[0].cells[0].text).toBe('c');

		act(() => remove('pptx.tableDataEditor.removeColumnN:1')?.click());
		const cols = (onUpdate.mock.calls[1][0] as Partial<TablePptxElement>).tableData;
		expect(cols?.columnWidths).toHaveLength(1);
		expect(cols?.rows[0].cells[0].text).toBe('b');
	});

	it('disables editing and hides structural controls when canEdit is false', () => {
		act(() => {
			root.render(
				React.createElement(TableDataGrid, {
					tableElement: table(),
					canEdit: false,
					onUpdateElement: () => {},
				}),
			);
		});
		expect(host.querySelectorAll('button')).toHaveLength(0);
		expect(cellInput(1, 1).disabled).toBeTruthy();
	});

	it('renders nothing for a table with no data', () => {
		act(() => {
			root.render(
				React.createElement(TableDataGrid, {
					tableElement: { id: 't', type: 'table' } as unknown as TablePptxElement,
					canEdit: true,
					onUpdateElement: () => {},
				}),
			);
		});
		expect(host.innerHTML).toBe('');
	});
});
