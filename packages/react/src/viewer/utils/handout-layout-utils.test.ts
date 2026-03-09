import { describe, it, expect } from 'vitest';
import {
	getHandoutGrid,
	computePageCount,
	computePageCells,
	computeHandoutLayout,
	getPrintableArea,
	generateNoteLineCount,
	A4_PORTRAIT,
	A4_LANDSCAPE,
} from './handout-layout-utils';

describe('getHandoutGrid', () => {
	it('should return 1x1 grid for 1 slide per page', () => {
		const grid = getHandoutGrid(1);
		expect(grid).toEqual({ rows: 1, columns: 1 });
	});

	it('should return 2x1 grid for 2 slides per page', () => {
		const grid = getHandoutGrid(2);
		expect(grid).toEqual({ rows: 2, columns: 1 });
	});

	it('should return 3x1 grid for 3 slides per page', () => {
		const grid = getHandoutGrid(3);
		expect(grid).toEqual({ rows: 3, columns: 1 });
	});

	it('should return 2x2 grid for 4 slides per page', () => {
		const grid = getHandoutGrid(4);
		expect(grid).toEqual({ rows: 2, columns: 2 });
	});

	it('should return 3x2 grid for 6 slides per page', () => {
		const grid = getHandoutGrid(6);
		expect(grid).toEqual({ rows: 3, columns: 2 });
	});

	it('should return 3x3 grid for 9 slides per page', () => {
		const grid = getHandoutGrid(9);
		expect(grid).toEqual({ rows: 3, columns: 3 });
	});
});

describe('computePageCount', () => {
	it('should return 0 for 0 slides', () => {
		expect(computePageCount(0, 6)).toBe(0);
	});

	it('should return 0 for negative slide count', () => {
		expect(computePageCount(-1, 6)).toBe(0);
	});

	it('should return 1 page when slides fit on one page', () => {
		expect(computePageCount(6, 6)).toBe(1);
		expect(computePageCount(1, 6)).toBe(1);
	});

	it('should round up to next page for overflow', () => {
		expect(computePageCount(7, 6)).toBe(2);
		expect(computePageCount(13, 6)).toBe(3);
	});

	it('should handle 1 slide per page', () => {
		expect(computePageCount(5, 1)).toBe(5);
	});

	it('should handle exact multiples', () => {
		expect(computePageCount(9, 9)).toBe(1);
		expect(computePageCount(18, 9)).toBe(2);
	});
});

describe('computePageCells', () => {
	it('should produce correct number of cells for 4 per page layout', () => {
		const page = computePageCells(0, 4, 10, 0);
		expect(page.cells.length).toBe(4);
		expect(page.pageIndex).toBe(0);
		expect(page.hasNoteLines).toBe(false);
	});

	it('should mark empty slots with slideIndex -1', () => {
		const page = computePageCells(0, 6, 4, 0);
		const filledCells = page.cells.filter((c) => c.slideIndex >= 0);
		const emptyCells = page.cells.filter((c) => c.slideIndex === -1);
		expect(filledCells.length).toBe(4);
		expect(emptyCells.length).toBe(2);
	});

	it('should set hasNoteLines for 3 slides per page', () => {
		const page = computePageCells(0, 3, 3, 0);
		expect(page.hasNoteLines).toBe(true);
		expect(page.cells.length).toBe(3);
	});

	it('should assign correct row/col indices for 6-per-page grid', () => {
		const page = computePageCells(0, 6, 6, 0);
		expect(page.cells[0]).toMatchObject({ row: 0, col: 0 });
		expect(page.cells[1]).toMatchObject({ row: 0, col: 1 });
		expect(page.cells[2]).toMatchObject({ row: 1, col: 0 });
		expect(page.cells[3]).toMatchObject({ row: 1, col: 1 });
		expect(page.cells[4]).toMatchObject({ row: 2, col: 0 });
		expect(page.cells[5]).toMatchObject({ row: 2, col: 1 });
	});

	it('should compute positive width and height for all cells', () => {
		const page = computePageCells(0, 9, 9, 0);
		for (const cell of page.cells) {
			expect(cell.width).toBeGreaterThan(0);
			expect(cell.height).toBeGreaterThan(0);
		}
	});

	it('should use landscape dimensions when specified', () => {
		const portrait = computePageCells(0, 4, 4, 0, A4_PORTRAIT);
		const landscape = computePageCells(0, 4, 4, 0, A4_LANDSCAPE);
		// Landscape cells should be wider than portrait cells
		expect(landscape.cells[0].width).toBeGreaterThan(
			portrait.cells[0].width,
		);
	});
});

describe('computeHandoutLayout', () => {
	it('should return empty array for no slides', () => {
		expect(computeHandoutLayout([], 6)).toEqual([]);
	});

	it('should produce correct number of pages', () => {
		const layout = computeHandoutLayout([0, 1, 2, 3, 4, 5, 6], 6);
		expect(layout.length).toBe(2);
	});

	it('should remap slide indices correctly', () => {
		const layout = computeHandoutLayout([10, 20, 30], 3);
		expect(layout.length).toBe(1);
		const filledCells = layout[0].cells.filter((c) => c.slideIndex >= 0);
		expect(filledCells.map((c) => c.slideIndex)).toEqual([10, 20, 30]);
	});

	it('should mark excess cells as empty (-1)', () => {
		const layout = computeHandoutLayout([0, 1], 4);
		const emptyCells = layout[0].cells.filter((c) => c.slideIndex === -1);
		expect(emptyCells.length).toBe(2);
	});

	it('should support landscape orientation', () => {
		const layout = computeHandoutLayout([0, 1, 2, 3], 4, 'landscape');
		expect(layout.length).toBe(1);
		expect(layout[0].cells.length).toBe(4);
	});

	it('should handle single slide correctly', () => {
		const layout = computeHandoutLayout([5], 1);
		expect(layout.length).toBe(1);
		expect(layout[0].cells[0].slideIndex).toBe(5);
	});
});

describe('getPrintableArea', () => {
	it('should compute portrait printable area correctly', () => {
		const area = getPrintableArea('portrait');
		expect(area.width).toBe(
			A4_PORTRAIT.width -
				A4_PORTRAIT.marginLeft -
				A4_PORTRAIT.marginRight,
		);
		expect(area.height).toBe(
			A4_PORTRAIT.height -
				A4_PORTRAIT.marginTop -
				A4_PORTRAIT.marginBottom,
		);
	});

	it('should compute landscape printable area correctly', () => {
		const area = getPrintableArea('landscape');
		expect(area.width).toBe(
			A4_LANDSCAPE.width -
				A4_LANDSCAPE.marginLeft -
				A4_LANDSCAPE.marginRight,
		);
	});

	it('should default to portrait', () => {
		const area = getPrintableArea();
		const portrait = getPrintableArea('portrait');
		expect(area).toEqual(portrait);
	});
});

describe('generateNoteLineCount', () => {
	it('should return 8', () => {
		expect(generateNoteLineCount()).toBe(8);
	});
});

describe('A4 dimension constants', () => {
	it('should have standard A4 portrait dimensions', () => {
		expect(A4_PORTRAIT.width).toBe(210);
		expect(A4_PORTRAIT.height).toBe(297);
	});

	it('should have standard A4 landscape dimensions (swapped)', () => {
		expect(A4_LANDSCAPE.width).toBe(297);
		expect(A4_LANDSCAPE.height).toBe(210);
	});
});
