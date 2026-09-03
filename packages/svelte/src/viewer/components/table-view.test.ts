import type { PptxElement, PptxTableCell, PptxTableData } from 'pptx-viewer-core';
import type { CellTextRun } from 'pptx-viewer-shared';
import { DEFAULT_FONT_FAMILY } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * TableView tests: mount the dispatcher with fabricated table elements and
 * assert the rendered `<table>` structure (colgroup widths, spans, banding,
 * per-cell styles, diagonal SVG overlay, rich runs), mirroring the vanilla
 * binding's table renderer tests.
 */

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 3 },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

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

describe('tableView', () => {
	it('renders nothing for tables without data or rows', () => {
		const noData = mountEl({ type: 'table', id: 'nd', x: 0, y: 0, width: 10, height: 10 });
		expect(noData.querySelector('table')).toBeNull();
		cleanup?.();
		const empty = mountEl(buildTableElement({ rows: [], columnWidths: [] }));
		expect(empty.querySelector('table')).toBeNull();
	});

	it('renders a positioned container with a real <table>', () => {
		const target = mountEl(buildTableElement());
		const container = target.querySelector<HTMLElement>('[data-element-id="el-table"]');
		expect(container?.className).toContain('pptx-svelte-table');
		const style = container?.getAttribute('style') ?? '';
		expect(style).toContain('left: 20px');
		expect(style).toContain('top: 30px');
		expect(style).toContain('z-index: 3');
		expect(container?.querySelector('table.pptx-svelte-table-grid')).not.toBeNull();
	});

	it('renders proportional column widths in a <colgroup>', () => {
		const cols = mountEl(buildTableElement()).querySelectorAll<HTMLElement>('colgroup col');
		expect(cols).toHaveLength(3);
		expect(cols[0].getAttribute('style')).toContain('50.00%');
		expect(cols[1].getAttribute('style')).toContain('30.00%');
		expect(cols[2].getAttribute('style')).toContain('20.00%');
	});

	it('applies row heights and header-row emphasis', () => {
		const rows = mountEl(buildTableElement()).querySelectorAll<HTMLElement>('tbody tr');
		expect(rows).toHaveLength(3);
		expect(rows[0].getAttribute('style')).toContain('height: 40px');
		const headerCell = rows[0].querySelector<HTMLElement>('td');
		expect(headerCell?.style.fontWeight).toBe('700');
		expect(headerCell?.style.backgroundColor).toBeTruthy();
	});

	it('resolves grid spans and skips cells absorbed by a merge', () => {
		const secondRow = mountEl(buildTableElement()).querySelectorAll('tbody tr')[1];
		const cells = secondRow.querySelectorAll<HTMLTableCellElement>('td');
		// Three grid columns but only two rendered cells (hMerge absorbed).
		expect(cells).toHaveLength(2);
		expect(cells[0].colSpan).toBe(2);
	});

	it('layers explicit cell styles over band styles', () => {
		const secondRow = mountEl(buildTableElement()).querySelectorAll('tbody tr')[1];
		const styled = secondRow.querySelectorAll<HTMLElement>('td')[0];
		expect(styled.style.backgroundColor).toBe('#ff0000');
		expect(styled.style.fontWeight).toBe('bold');
		// The unstyled band-row neighbour keeps the band fill.
		const banded = secondRow.querySelectorAll<HTMLElement>('td')[1];
		expect(banded.style.backgroundColor).toContain('rgba(217, 226, 243');
	});

	it('renders diagonal cell borders as an SVG overlay', () => {
		const secondRow = mountEl(buildTableElement()).querySelectorAll('tbody tr')[1];
		const line = secondRow.querySelectorAll('td')[1]?.querySelector('svg line');
		expect(line).toBeTruthy();
		expect(line?.getAttribute('stroke')).toBe('#00ff00');
		expect(line?.getAttribute('stroke-width')).toBe('2');
	});

	it('renders rich per-run cell text with styled spans and line breaks', () => {
		const richTd = mountEl(buildTableElement())
			.querySelectorAll('tbody tr')[2]
			.querySelector<HTMLElement>('td');
		const spans = richTd?.querySelectorAll<HTMLElement>('span') ?? [];
		expect(spans).toHaveLength(2);
		expect(spans[0].textContent).toBe('Hello');
		expect(spans[0].style.fontWeight).toBe('bold');
		expect(spans[1].textContent).toBe('World');
		expect(spans[1].style.color).toBeTruthy();
		expect(richTd?.querySelector('br')).toBeTruthy();
	});

	it('falls back to plain cell text when no runs are present', () => {
		const plainTd = mountEl(buildTableElement())
			.querySelectorAll('tbody tr')[0]
			.querySelectorAll('td')[1];
		expect(plainTd.querySelector('span')?.textContent).toBe('Q1');
	});

	it('puts no whitespace between cells in the table text', () => {
		// Svelte keeps a text node for the indentation between `<td>` and its
		// content, so a pretty-printed cell used to contribute a stray space and
		// this binding alone read "Name Q1 Q2" where the other four read
		// "NameQ1Q2". Anything that compares a table element's text (the
		// cross-binding parity harness does) saw that as a content difference.
		const table = mountEl(buildTableElement()).querySelector('table');
		const headerRow = table?.querySelectorAll('tbody tr')[0];
		expect(headerRow?.textContent).toBe('NameQ1Q2');
	});

	it('declares the shared default font family on the table root', () => {
		// Without it an unstyled cell inherits the HOST chrome's font stack, and
		// the same deck measured different type metrics in every binding.
		const table = mountEl(buildTableElement()).querySelector<HTMLElement>('table');
		expect(table?.style.fontFamily).toBe(DEFAULT_FONT_FAMILY);
	});

	it('renders a resolved cell image fill as a cover background', () => {
		const tableData: PptxTableData = {
			columnWidths: [1],
			rows: [
				{
					cells: [
						{
							text: 'Photo',
							style: {
								fillMode: 'image',
								backgroundImageFillData: 'data:image/png;base64,AAAA',
							},
						},
					],
				},
			],
		};
		const td = mountEl(buildTableElement(tableData)).querySelector('td') as HTMLElement;
		expect(td.style.backgroundImage).toBe('url("data:image/png;base64,AAAA")');
		expect(td.style.backgroundSize).toBe('cover');
	});

	it('renders fractional cell font sizes in PowerPoint points', () => {
		const tableData: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [{ text: 'Sized', style: { fontSize: 14.5 } }] }],
		};
		const td = mountEl(buildTableElement(tableData)).querySelector('td') as HTMLElement;
		expect(td.style.fontSize).toBe('14.5pt');
	});

	it('renders an explicit zero cell margin as zero padding, not the base default', () => {
		const tableData: PptxTableData = {
			columnWidths: [1],
			rows: [{ cells: [{ text: 'Dense', style: { marginLeft: 0, marginTop: 0 } }] }],
		};
		const td = mountEl(buildTableElement(tableData)).querySelector('td') as HTMLElement;
		expect(td.style.paddingLeft).toBe('0px');
		expect(td.style.paddingTop).toBe('0px');
	});
});
