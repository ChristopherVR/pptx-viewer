import type { PptxTableCell, PptxTableData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { computeMergeCellRight, computeMergeCellDown, computeSplitCell } from './table-cell-merge';

function makeTable(
	rows: number,
	cols: number,
	overrides?: Record<string, Partial<PptxTableCell>>,
): PptxTableData {
	return {
		rows: Array.from({ length: rows }, (_row, ri) => ({
			cells: Array.from({ length: cols }, (_col, ci) => {
				const key = `${ri},${ci}`;
				return { text: `${ri}-${ci}`, ...overrides?.[key] };
			}),
		})),
		columnWidths: Array.from({ length: cols }, () => 100),
	} as unknown as PptxTableData;
}

describe('computeMergeCellRight', () => {
	it('merges two adjacent cells horizontally', () => {
		const table = makeTable(2, 3);
		const result = computeMergeCellRight(table, 0, 0);
		expect(result).not.toBeNull();
		expect(result![0].cells[0].gridSpan).toBe(2);
		expect(result![0].cells[1].hMerge).toBeTruthy();
		expect(result![0].cells[1].text).toBe('');
	});

	it('returns null for out-of-bounds row', () => {
		const table = makeTable(2, 3);
		expect(computeMergeCellRight(table, 5, 0)).toBeNull();
	});

	it('returns null when next cell is beyond table width', () => {
		const table = makeTable(2, 3);
		expect(computeMergeCellRight(table, 0, 2)).toBeNull();
	});

	it('returns null when next cell is already horizontally merged', () => {
		const table = makeTable(2, 3, { '0,1': { hMerge: true } });
		expect(computeMergeCellRight(table, 0, 0)).toBeNull();
	});

	it('does not affect other rows', () => {
		const table = makeTable(3, 3);
		const result = computeMergeCellRight(table, 1, 0);
		expect(result).not.toBeNull();
		expect(result![0].cells[0].gridSpan).toBeUndefined();
		expect(result![2].cells[0].gridSpan).toBeUndefined();
	});

	it('extends an already merged cell', () => {
		const table = makeTable(1, 4, {
			'0,0': { gridSpan: 2 },
			'0,1': { hMerge: true, text: '' },
		});
		const result = computeMergeCellRight(table, 0, 0);
		expect(result).not.toBeNull();
		expect(result![0].cells[0].gridSpan).toBe(3);
		expect(result![0].cells[2].hMerge).toBeTruthy();
	});
});

describe('computeMergeCellDown', () => {
	it('merges two vertically adjacent cells', () => {
		const table = makeTable(3, 2);
		const result = computeMergeCellDown(table, 0, 0);
		expect(result).not.toBeNull();
		expect(result![0].cells[0].rowSpan).toBe(2);
		expect(result![1].cells[0].vMerge).toBeTruthy();
		expect(result![1].cells[0].text).toBe('');
	});

	it('returns null for out-of-bounds row', () => {
		const table = makeTable(2, 2);
		expect(computeMergeCellDown(table, 5, 0)).toBeNull();
	});

	it('returns null when there is no row below', () => {
		const table = makeTable(2, 2);
		expect(computeMergeCellDown(table, 1, 0)).toBeNull();
	});

	it('returns null when target cell is already vertically merged', () => {
		const table = makeTable(3, 2, { '1,0': { vMerge: true } });
		expect(computeMergeCellDown(table, 0, 0)).toBeNull();
	});

	it('does not affect other columns', () => {
		const table = makeTable(3, 3);
		const result = computeMergeCellDown(table, 0, 1);
		expect(result).not.toBeNull();
		expect(result![0].cells[0].rowSpan).toBeUndefined();
		expect(result![0].cells[2].rowSpan).toBeUndefined();
	});

	it('extends an already merged cell downward', () => {
		const table = makeTable(4, 2, {
			'0,0': { rowSpan: 2 },
			'1,0': { vMerge: true, text: '' },
		});
		const result = computeMergeCellDown(table, 0, 0);
		expect(result).not.toBeNull();
		expect(result![0].cells[0].rowSpan).toBe(3);
		expect(result![2].cells[0].vMerge).toBeTruthy();
	});
});

describe('computeSplitCell', () => {
	it('returns null for a cell with no spans', () => {
		const table = makeTable(2, 2);
		expect(computeSplitCell(table, 0, 0)).toBeNull();
	});

	it('splits a horizontally merged cell', () => {
		const table = makeTable(1, 3, {
			'0,0': { gridSpan: 2 },
			'0,1': { hMerge: true, text: '' },
		});
		const result = computeSplitCell(table, 0, 0);
		expect(result).not.toBeNull();
		expect(result![0].cells[0].gridSpan).toBeUndefined();
		expect(result![0].cells[1].hMerge).toBeUndefined();
	});

	it('splits a vertically merged cell', () => {
		const table = makeTable(3, 2, {
			'0,0': { rowSpan: 2 },
			'1,0': { vMerge: true, text: '' },
		});
		const result = computeSplitCell(table, 0, 0);
		expect(result).not.toBeNull();
		expect(result![0].cells[0].rowSpan).toBeUndefined();
		expect(result![1].cells[0].vMerge).toBeUndefined();
	});

	it('returns null for out-of-bounds row', () => {
		const table = makeTable(2, 2);
		expect(computeSplitCell(table, 5, 0)).toBeNull();
	});

	it('returns null for out-of-bounds column', () => {
		const table = makeTable(2, 2);
		expect(computeSplitCell(table, 0, 5)).toBeNull();
	});

	it('preserves other cells unchanged', () => {
		const table = makeTable(2, 3, {
			'0,0': { gridSpan: 2 },
			'0,1': { hMerge: true, text: '' },
		});
		const result = computeSplitCell(table, 0, 0);
		expect(result).not.toBeNull();
		expect(result![0].cells[2].text).toBe('0-2');
		expect(result![1].cells[0].text).toBe('1-0');
	});
});

describe('rich cell text through cursor merge and split', () => {
	it.each([
		['right', computeMergeCellRight, 0, 1],
		['down', computeMergeCellDown, 1, 0],
	] as const)(
		'clears absorbed runs when merging %s without changing the anchor',
		(_direction, merge, row, col) => {
			const anchorRuns: PptxTableCell['textRuns'] = [
				{ text: 'Keep', bold: true },
				{ text: '', isLineBreak: true },
				{ text: 'me', italic: true },
			];
			const absorbedRuns: PptxTableCell['textRuns'] = [
				{ text: 'Remove', bold: true },
				{ text: ' me', italic: true },
			];
			const table = makeTable(2, 2, {
				'0,0': { text: 'Keep\nme', textRuns: anchorRuns },
				[`${row},${col}`]: { text: 'Remove me', textRuns: absorbedRuns, style: { fontSize: 24 } },
			});
			const original = structuredClone(table);
			const rows = merge(table, 0, 0)!;
			expect(rows[row].cells[col].text).toBe('');
			expect(rows[row].cells[col].textRuns).toBeUndefined();
			expect(rows[row].cells[col].style).toStrictEqual({ fontSize: 24 });
			expect(rows[0].cells[0].text).toBe('Keep\nme');
			expect(rows[0].cells[0].textRuns).toBe(anchorRuns);
			const split = computeSplitCell({ ...table, rows }, 0, 0)!;
			expect(split[row].cells[col].text).toBe('');
			expect(split[row].cells[col].textRuns).toBeUndefined();
			expect(split[0].cells[0].textRuns).toBe(anchorRuns);
			expect(split[1 - row].cells[1 - col]).toBe(table.rows[1 - row].cells[1 - col]);
			expect(table).toStrictEqual(original);
		},
	);

	it('clears every absorbed horizontal span cell, including stale runs on empty text', () => {
		const runs: PptxTableCell['textRuns'] = [{ text: 'Old content', bold: true }];
		const table = makeTable(1, 4, {
			'0,1': { gridSpan: 2, text: 'Old content', textRuns: runs },
			'0,2': { hMerge: true, text: '', textRuns: runs },
		});
		const original = structuredClone(table);
		const rows = computeMergeCellRight(table, 0, 0)!;
		expect(rows[0].cells[0].gridSpan).toBe(3);
		for (const index of [1, 2]) {
			expect(rows[0].cells[index]).toMatchObject({ text: '', hMerge: true });
			expect(rows[0].cells[index].textRuns).toBeUndefined();
		}
		const split = computeSplitCell({ ...table, rows }, 0, 0)!;
		expect(split[0].cells.slice(1, 3).map((cell) => cell.textRuns)).toStrictEqual([
			undefined,
			undefined,
		]);
		expect(rows[0].cells[3]).toBe(table.rows[0].cells[3]);
		expect(table).toStrictEqual(original);
	});

	it('clears a vertically spanning neighbor without changing its empty continuation cells', () => {
		const table = makeTable(4, 2, {
			'1,0': { rowSpan: 2, text: 'Remove', textRuns: [{ text: 'Remove', isField: true }] },
			'2,0': { vMerge: true, text: '' },
		});
		const original = structuredClone(table);
		const rows = computeMergeCellDown(table, 0, 0)!;
		expect(rows[0].cells[0].rowSpan).toBe(3);
		expect(rows[1].cells[0]).toMatchObject({ text: '', vMerge: true });
		expect(rows[1].cells[0].textRuns).toBeUndefined();
		expect(rows[2]).toBe(table.rows[2]);
		const split = computeSplitCell({ ...table, rows }, 0, 0)!;
		expect(split[1].cells[0].textRuns).toBeUndefined();
		expect(split[2].cells[0].text).toBe('');
		expect(split[2].cells[0].vMerge).toBeUndefined();
		expect(table).toStrictEqual(original);
	});

	it.each([computeMergeCellRight, computeMergeCellDown])(
		'leaves rich text untouched for an unavailable neighbor',
		(merge) => {
			const table = makeTable(1, 1, {
				'0,0': { text: 'Keep', textRuns: [{ text: 'Keep', bold: true }] },
			});
			const original = structuredClone(table);
			expect(merge(table, 0, 0)).toBeNull();
			expect(table).toStrictEqual(original);
		},
	);
});
