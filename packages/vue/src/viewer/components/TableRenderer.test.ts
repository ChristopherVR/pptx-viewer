import { mount } from '@vue/test-utils';
import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import TableRenderer from './TableRenderer.vue';

function table(tableData: PptxTableData, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'table',
		id: 'tbl 1',
		x: 50,
		y: 200,
		width: 400,
		height: 200,
		tableData,
		...overrides,
	} as PptxElement;
}

const basicGrid: PptxTableData = {
	columnWidths: [0.5, 0.5],
	rows: [{ cells: [{ text: 'A1' }, { text: 'B1' }] }, { cells: [{ text: 'A2' }, { text: 'B2' }] }],
};

describe('tableRenderer', () => {
	it('renders a positioned wrapper with the table grid', () => {
		const wrapper = mount(TableRenderer, { props: { element: table(basicGrid), zIndex: 7 } });
		const root = wrapper.get('[data-element-id="tbl 1"]');
		expect(root.attributes('style')).toContain('left: 50px');
		expect(root.attributes('style')).toContain('top: 200px');
		expect(root.attributes('style')).toContain('z-index: 7');
		expect(wrapper.find('table').exists()).toBeTruthy();
	});

	it('renders the right number of rows and cells for a basic grid', () => {
		const wrapper = mount(TableRenderer, { props: { element: table(basicGrid), zIndex: 0 } });
		expect(wrapper.findAll('tr')).toHaveLength(2);
		expect(wrapper.findAll('td')).toHaveLength(4);
	});

	it('emits a colgroup with proportional column widths', () => {
		const wrapper = mount(TableRenderer, {
			props: { element: table({ ...basicGrid, columnWidths: [0.7, 0.3] }), zIndex: 0 },
		});
		const cols = wrapper.findAll('col');
		expect(cols).toHaveLength(2);
		expect(cols[0].attributes('style')).toContain('width: 70.00%');
		expect(cols[1].attributes('style')).toContain('width: 30.00%');
	});

	it('renders cell text content', () => {
		const wrapper = mount(TableRenderer, { props: { element: table(basicGrid), zIndex: 0 } });
		const texts = wrapper.findAll('td').map((td) => td.text());
		expect(texts).toStrictEqual(['A1', 'B1', 'A2', 'B2']);
	});

	it('applies a horizontal merge as colspan and skips the absorbed cell', () => {
		const merged: PptxTableData = {
			columnWidths: [0.5, 0.5],
			rows: [
				{
					cells: [
						{ text: 'Spans both', gridSpan: 2 },
						{ text: '', hMerge: true },
					],
				},
				{ cells: [{ text: 'A2' }, { text: 'B2' }] },
			],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(merged), zIndex: 0 } });
		const firstRowCells = wrapper.findAll('tr')[0].findAll('td');
		// The hMerge continuation cell is not rendered.
		expect(firstRowCells).toHaveLength(1);
		expect(firstRowCells[0].attributes('colspan')).toBe('2');
		expect(firstRowCells[0].text()).toBe('Spans both');
	});

	it('applies a vertical merge as rowspan and skips the absorbed cell', () => {
		const merged: PptxTableData = {
			columnWidths: [0.5, 0.5],
			rows: [
				{ cells: [{ text: 'Tall', rowSpan: 2 }, { text: 'B1' }] },
				{ cells: [{ text: '', vMerge: true }, { text: 'B2' }] },
			],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(merged), zIndex: 0 } });
		const rows = wrapper.findAll('tr');
		expect(rows[0].findAll('td')[0].attributes('rowspan')).toBe('2');
		// Second row only renders its single non-merged cell.
		expect(rows[1].findAll('td')).toHaveLength(1);
		expect(rows[1].findAll('td')[0].text()).toBe('B2');
	});

	it('applies an explicit cell fill colour', () => {
		const filled: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [{ text: 'Filled', style: { backgroundColor: '#ff0000' } }] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(filled), zIndex: 0 } });
		const cell = wrapper.get('td');
		expect(cell.attributes('style')).toContain('background-color: #ff0000');
	});

	it('applies header-row banding (bold + background) when firstRowHeader is set', () => {
		const headed: PptxTableData = {
			columnWidths: [1],
			firstRowHeader: true,
			rows: [{ cells: [{ text: 'Header' }] }, { cells: [{ text: 'Body' }] }],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(headed), zIndex: 0 } });
		const headerCell = wrapper.findAll('tr')[0].get('td');
		expect(headerCell.attributes('style')).toContain('font-weight: 700');
		expect(headerCell.attributes('style')).toContain('background-color');
	});

	it('renders a diagonal-border SVG overlay when configured', () => {
		const diag: PptxTableData = {
			columnWidths: [1],
			rows: [
				{
					cells: [{ text: 'X', style: { borderDiagDownColor: '#000000', borderDiagDownWidth: 1 } }],
				},
			],
		};
		const wrapper = mount(TableRenderer, { props: { element: table(diag), zIndex: 0 } });
		expect(wrapper.find('svg line').exists()).toBeTruthy();
	});

	it('renders nothing for an empty table', () => {
		const wrapper = mount(TableRenderer, {
			props: { element: table({ columnWidths: [], rows: [] }), zIndex: 0 },
		});
		expect(wrapper.find('table').exists()).toBeFalsy();
	});
});
