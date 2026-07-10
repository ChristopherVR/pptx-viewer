import type { PptxElement, PptxTableCell, PptxTableData } from 'pptx-viewer-core';
import type { CellTextRun } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { registerTableChartRenderers } from './register-table-chart';
import { renderTableElement } from './table';

function buildContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	registerTableChartRenderers(registry);
	const context: ElementRenderContext = {
		document,
		slide: { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		presenting: false,
		registry,
		renderElement(element, zIndex) {
			return registry.resolve(element.type)(element, zIndex, context);
		},
	};
	return context;
}

/** Rich-run cell (duck-typed `textRuns` extension, like the other bindings). */
function richCell(text: string, textRuns: CellTextRun[]): PptxTableCell {
	return { text, textRuns } as PptxTableCell & { textRuns: CellTextRun[] };
}

function buildTableData(): PptxTableData {
	return {
		columnWidths: [0.5, 0.3, 0.2],
		firstRowHeader: true,
		bandedRows: true,
		rows: [
			{ height: 40, cells: [{ text: 'Name' }, { text: 'Q1' }, { text: 'Q2' }] },
			{
				cells: [
					{ text: 'Widget', gridSpan: 2, style: { backgroundColor: '#ff0000', bold: true } },
					{ text: '', hMerge: true },
					{ text: '12', style: { borderDiagDownColor: '#00ff00', borderDiagDownWidth: 2 } },
				],
			},
			{
				cells: [
					richCell('Hello World', [
						{ text: 'Hello', bold: true },
						{ text: '', isLineBreak: true },
						{ text: 'World', color: '#0000ff' },
					]),
					{ text: '5' },
					{ text: '7' },
				],
			},
		],
	};
}

function buildTableElement(tableData?: PptxTableData): PptxElement {
	return {
		type: 'table',
		id: 'el-table',
		x: 20,
		y: 30,
		width: 400,
		height: 200,
		tableData: tableData ?? buildTableData(),
	};
}

function renderTable(element: PptxElement = buildTableElement()): HTMLElement {
	const node = renderTableElement(element, 3, buildContext());
	expect(node).toBeTruthy();
	return node as HTMLElement;
}

describe('renderTableElement', () => {
	it('returns null for non-table elements and empty tables', () => {
		const context = buildContext();
		const text: PptxElement = { type: 'text', id: 't', x: 0, y: 0, width: 10, height: 10 };
		expect(renderTableElement(text, 0, context)).toBeNull();
		const noData: PptxElement = { type: 'table', id: 'nd', x: 0, y: 0, width: 10, height: 10 };
		expect(renderTableElement(noData, 0, context)).toBeNull();
		expect(
			renderTableElement(buildTableElement({ rows: [], columnWidths: [] }), 0, context),
		).toBeNull();
	});

	it('renders a positioned container with a fixed-layout <table>', () => {
		const container = renderTable();
		expect(container.dataset.elementId).toBe('el-table');
		expect(container.style.left).toBe('20px');
		expect(container.style.top).toBe('30px');
		expect(container.style.zIndex).toBe('3');
		const table = container.querySelector('table');
		expect(table).toBeTruthy();
		expect(table?.style.borderCollapse).toBe('collapse');
		expect(table?.style.tableLayout).toBe('fixed');
	});

	it('renders proportional column widths in a <colgroup>', () => {
		const cols = renderTable().querySelectorAll('colgroup col');
		expect(cols).toHaveLength(3);
		expect((cols[0] as HTMLElement).style.width).toBe('50.00%');
		expect((cols[1] as HTMLElement).style.width).toBe('30.00%');
		expect((cols[2] as HTMLElement).style.width).toBe('20.00%');
	});

	it('applies row heights and header-row emphasis', () => {
		const rows = renderTable().querySelectorAll('tbody tr');
		expect(rows).toHaveLength(3);
		expect((rows[0] as HTMLElement).style.height).toBe('40px');
		const headerCell = rows[0].querySelector('td') as HTMLElement;
		expect(headerCell.style.fontWeight).toBe('700');
		expect(headerCell.style.backgroundColor).toBeTruthy();
	});

	it('resolves grid spans and skips cells absorbed by a merge', () => {
		const secondRow = renderTable().querySelectorAll('tbody tr')[1];
		const cells = secondRow.querySelectorAll('td');
		// Three grid columns but only two rendered cells (hMerge absorbed).
		expect(cells).toHaveLength(2);
		expect((cells[0] as HTMLTableCellElement).colSpan).toBe(2);
	});

	it('layers explicit cell styles over band styles', () => {
		const secondRow = renderTable().querySelectorAll('tbody tr')[1];
		const styled = secondRow.querySelectorAll('td')[0] as HTMLElement;
		expect(styled.style.backgroundColor).toBe('#ff0000');
		expect(styled.style.fontWeight).toBe('bold');
		// The unstyled band-row neighbour keeps the band fill.
		const banded = secondRow.querySelectorAll('td')[1] as HTMLElement;
		expect(banded.style.backgroundColor).toContain('rgba(217, 226, 243');
	});

	it('renders diagonal cell borders as an SVG overlay', () => {
		const secondRow = renderTable().querySelectorAll('tbody tr')[1];
		const line = secondRow.querySelectorAll('td')[1]?.querySelector('svg line');
		expect(line).toBeTruthy();
		expect(line?.getAttribute('stroke')).toBe('#00ff00');
		expect(line?.getAttribute('stroke-width')).toBe('2');
	});

	it('renders rich per-run cell text with styled spans and line breaks', () => {
		const richTd = renderTable().querySelectorAll('tbody tr')[2].querySelector('td') as HTMLElement;
		const spans = richTd.querySelectorAll('span');
		expect(spans).toHaveLength(2);
		expect(spans[0].textContent).toBe('Hello');
		expect((spans[0] as HTMLElement).style.fontWeight).toBe('bold');
		expect(spans[1].textContent).toBe('World');
		expect((spans[1] as HTMLElement).style.color).toBeTruthy();
		expect(richTd.querySelector('br')).toBeTruthy();
	});

	it('falls back to plain cell text when no runs are present', () => {
		const plainTd = renderTable().querySelectorAll('tbody tr')[0].querySelectorAll('td')[1];
		expect(plainTd.querySelector('span')?.textContent).toBe('Q1');
	});

	it('is dispatched through the registry via registerTableChartRenderers', () => {
		const context = buildContext();
		const node = context.renderElement(buildTableElement(), 0);
		expect((node as HTMLElement).querySelector('table')).toBeTruthy();
	});
});
