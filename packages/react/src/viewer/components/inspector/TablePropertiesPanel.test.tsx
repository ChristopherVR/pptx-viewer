// @vitest-environment happy-dom
/* oxlint-disable eslint/one-var -- many independent it() blocks, each with
   its own short arrange/act/assert consts. */
import type { PptxElement, TablePptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
			React.createElement(TablePropertiesPanel, {
				tableElement: element,
				canEdit: true,
				onUpdateElement,
			}),
		);
	});
}

describe('tablePropertiesPanel', () => {
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
});
