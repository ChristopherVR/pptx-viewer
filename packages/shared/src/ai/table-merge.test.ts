import type { PptxSlide, TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { PptxAiConfig } from './config';
import { makeMockBridge, makeSlide } from './mock-bridge';
import { ProposalStore } from './proposals';
import { mergeTableElements } from './table-merge';
import { buildToolExecutors } from './tools';

/** Build a table element with a cell-text grid and explicit bounds. */
function table(
	id: string,
	grid: string[][],
	bounds: { x: number; y: number; width: number; height: number },
	extra: Partial<TablePptxElement['tableData']> = {},
): TablePptxElement {
	const cols = grid[0].length;
	return {
		id,
		type: 'table',
		...bounds,
		tableData: {
			rows: grid.map((cells) => ({ cells: cells.map((text) => ({ text })) })),
			columnWidths: Array.from({ length: cols }, () => 1 / cols),
			...extra,
		},
	} as unknown as TablePptxElement;
}

const B = { x: 0, y: 0, width: 100, height: 100 };

describe('mergeTableElements', () => {
	it('vertical: appends B rows beneath A, keeps A style, unions bounds', () => {
		const a = table(
			'a',
			[
				['Region', 'Q1'],
				['North', '100'],
			],
			{ x: 10, y: 10, width: 100, height: 100 },
			{ firstRowHeader: true, tableStyleId: 'STYLE-A' },
		);
		const b = table(
			'b',
			[
				['Region', 'Q2'],
				['South', '200'],
			],
			{ x: 10, y: 120, width: 100, height: 100 },
		);

		const merged = mergeTableElements(a, b);
		expect(merged.tableData?.rows).toHaveLength(4);
		expect(merged.tableData?.rows[3].cells.map((c) => c.text)).toStrictEqual(['South', '200']);
		expect(merged.tableData?.firstRowHeader).toBeTruthy();
		expect(merged.tableData?.tableStyleId).toBe('STYLE-A');
		expect(merged.id).not.toBe('a');
		expect(merged.id).not.toBe('b');
		// Union bounds of the two stacked tables.
		expect({ x: merged.x, y: merged.y, width: merged.width, height: merged.height }).toStrictEqual({
			x: 10,
			y: 10,
			width: 100,
			height: 210,
		});
	});

	it('horizontal: appends B columns to A rows and renormalises widths', () => {
		const a = table('a', [['A1'], ['A2']], B);
		const b = table('b', [['B1'], ['B2']], B);
		const merged = mergeTableElements(a, b, { direction: 'horizontal' });
		expect(merged.tableData?.rows).toHaveLength(2);
		expect(merged.tableData?.rows[0].cells.map((c) => c.text)).toStrictEqual(['A1', 'B1']);
		expect(merged.tableData?.columnWidths).toHaveLength(2);
		const sum = (merged.tableData?.columnWidths ?? []).reduce((s, w) => s + w, 0);
		expect(sum).toBeCloseTo(1, 6);
	});

	it('throws when vertical column counts differ', () => {
		const a = table('a', [['1', '2']], B);
		const b = table('b', [['1', '2', '3']], B);
		expect(() => mergeTableElements(a, b)).toThrow(/column counts differ/u);
	});

	it('throws when horizontal row counts differ', () => {
		const a = table('a', [['1'], ['2']], B);
		const b = table('b', [['1']], B);
		expect(() => mergeTableElements(a, b, { direction: 'horizontal' })).toThrow(
			/row counts differ/u,
		);
	});
});

const CONNECTION: PptxAiConfig['connection'] = { kind: 'endpoint', api: '/api/chat' };

/** A mock bridge whose slide 0 holds two mergeable tables (plus one non-table). */
function twoTableBridge() {
	const tableA = table(
		'tbl-a',
		[
			['Region', 'Sales'],
			['North', '100'],
		],
		{ x: 10, y: 10, width: 200, height: 100 },
	);
	const tableB = table('tbl-b', [['South', '200']], { x: 10, y: 120, width: 200, height: 60 });
	const slide: PptxSlide = makeSlide(0, [tableA, tableB] as unknown as PptxSlide['elements']);
	return makeMockBridge({ slides: [slide] });
}

describe('merge_tables tool', () => {
	it('stages a proposal that merges two tables into one (single history entry)', async () => {
		const bridge = twoTableBridge();
		const proposals = new ProposalStore(bridge);
		const executors = buildToolExecutors(bridge, proposals, { connection: CONNECTION });

		const result = (await executors.get('merge_tables')!({
			slideIndex: 0,
			elementIdA: 'tbl-a',
			elementIdB: 'tbl-b',
		})) as { staged?: boolean; mergedElementId?: string };

		expect(result.staged).toBeTruthy();
		expect(result.mergedElementId).toBeDefined();
		expect(proposals.size).toBe(1);
		// Nothing applied yet.
		expect(bridge.edits).toHaveLength(0);

		const [proposal] = proposals.list();
		proposals.apply(proposal.id);

		// One undoable history entry.
		expect(bridge.edits).toHaveLength(1);

		const elements = bridge.getSlides()[0].elements;
		expect(elements).toHaveLength(1);
		const merged = elements[0] as TablePptxElement;
		expect(merged.type).toBe('table');
		expect(merged.id).toBe(result.mergedElementId);
		// Rows = A (2) + B (1).
		expect(merged.tableData?.rows).toHaveLength(3);
		expect(merged.tableData?.rows[2].cells.map((c) => c.text)).toStrictEqual(['South', '200']);
	});

	it('errors clearly when an id is not a table', async () => {
		const bridge = twoTableBridge();
		// Add a text element to target.
		bridge.getSlides()[0].elements.push({
			id: 'txt-1',
			type: 'text',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			text: 'hi',
		} as unknown as PptxSlide['elements'][number]);
		const proposals = new ProposalStore(bridge);
		const executors = buildToolExecutors(bridge, proposals, { connection: CONNECTION });

		await expect(
			executors.get('merge_tables')!({
				slideIndex: 0,
				elementIdA: 'tbl-a',
				elementIdB: 'txt-1',
			}),
		).rejects.toThrow(/is not a table/u);
	});
});
