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

	it('vertical: two 5-row tables yield 10 rows in A-then-B order', () => {
		const gridA = Array.from({ length: 5 }, (_u, r) => [`A${r}c0`, `A${r}c1`]);
		const gridB = Array.from({ length: 5 }, (_u, r) => [`B${r}c0`, `B${r}c1`]);
		const a = table('a', gridA, { x: 0, y: 0, width: 100, height: 100 });
		const b = table('b', gridB, { x: 0, y: 110, width: 100, height: 100 });

		const merged = mergeTableElements(a, b, { direction: 'vertical' });
		const rows = merged.tableData?.rows ?? [];
		expect(rows).toHaveLength(10);
		expect(rows[0].cells.map((c) => c.text)).toStrictEqual(['A0c0', 'A0c1']);
		expect(rows[4].cells.map((c) => c.text)).toStrictEqual(['A4c0', 'A4c1']);
		expect(rows[5].cells.map((c) => c.text)).toStrictEqual(['B0c0', 'B0c1']);
		expect(rows[9].cells.map((c) => c.text)).toStrictEqual(['B4c0', 'B4c1']);
	});

	it('vertical: IDENTICAL tables sharing row object references still yield 10 rows', () => {
		// Mirrors a Ctrl+D duplicate whose tableData shares the SAME row objects
		// as the original. structuredClone must break the aliasing so no rows are
		// collapsed downstream.
		const grid = Array.from({ length: 5 }, (_u, r) => [`R${r}`]);
		const a = table('a', grid, { x: 0, y: 0, width: 100, height: 100 });
		const b = table('b', grid, { x: 0, y: 110, width: 100, height: 100 });
		// Force B to literally share A's row objects (worst-case shallow duplicate).
		(b.tableData as { rows: unknown }).rows = a.tableData!.rows;

		const merged = mergeTableElements(a, b, { direction: 'vertical' });
		const rows = merged.tableData?.rows ?? [];
		expect(rows).toHaveLength(10);
		// Merged rows must be independent copies, not aliases of the source rows.
		expect(rows[0]).not.toBe(a.tableData!.rows[0]);
		expect(rows[5]).not.toBe(a.tableData!.rows[0]);
		rows[0].cells[0].text = 'mutated';
		expect(a.tableData!.rows[0].cells[0].text).toBe('R0');
	});

	it('strips stale rawXml so tableData is the single source of truth', () => {
		const a = table('a', [['A0'], ['A1']], B);
		const b = table('b', [['B0'], ['B1']], B);
		// A real loaded table carries its original <a:tbl> graphic frame.
		(a as { rawXml?: unknown }).rawXml = {
			'a:graphic': { 'a:graphicData': { 'a:tbl': { 'a:tr': [{}, {}] } } },
		};

		const merged = mergeTableElements(a, b, { direction: 'vertical' });
		expect((merged as { rawXml?: unknown }).rawXml).toBeUndefined();
		expect(merged.tableData?.rows).toHaveLength(4);
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

	it('full executor -> stage -> apply yields one 10-row table (both originals gone)', async () => {
		const grid5 = (tag: string) =>
			Array.from({ length: 5 }, (_u, r) => [`${tag}${r}c0`, `${tag}${r}c1`]);
		const tableA = table('tbl-a', grid5('A'), { x: 0, y: 0, width: 200, height: 200 });
		const tableB = table('tbl-b', grid5('B'), { x: 0, y: 210, width: 200, height: 200 });
		const slide: PptxSlide = makeSlide(0, [tableA, tableB] as unknown as PptxSlide['elements']);
		const bridge = makeMockBridge({ slides: [slide] });
		const proposals = new ProposalStore(bridge);
		const executors = buildToolExecutors(bridge, proposals, { connection: CONNECTION });

		const result = (await executors.get('merge_tables')!({
			slideIndex: 0,
			elementIdA: 'tbl-a',
			elementIdB: 'tbl-b',
			direction: 'vertical',
		})) as { staged?: boolean; mergedElementId?: string };

		expect(result.staged).toBeTruthy();
		expect(bridge.edits).toHaveLength(0);

		const [proposal] = proposals.list();
		expect(proposals.apply(proposal.id)).toBeTruthy();
		expect(bridge.edits).toHaveLength(1);

		const elements = bridge.getSlides()[0].elements;
		expect(elements).toHaveLength(1);
		expect(elements.find((e) => e.id === 'tbl-a')).toBeUndefined();
		expect(elements.find((e) => e.id === 'tbl-b')).toBeUndefined();
		const merged = elements[0] as TablePptxElement;
		expect(merged.id).toBe(result.mergedElementId);
		expect(merged.tableData?.rows).toHaveLength(10);
		expect(merged.tableData?.rows[9].cells.map((c) => c.text)).toStrictEqual(['B4c0', 'B4c1']);
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
