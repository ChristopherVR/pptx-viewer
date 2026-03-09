import { describe, it, expect } from 'vitest';
import {
	computeNotesPageLayout,
	computeAllNotesPages,
	getNotesPrintableArea,
} from './notes-page-layout-utils';
import { A4_PORTRAIT } from './handout-layout-utils';

describe('computeNotesPageLayout', () => {
	it('should return correct page and slide indices', () => {
		const layout = computeNotesPageLayout(0, 5);
		expect(layout.pageIndex).toBe(0);
		expect(layout.slideIndex).toBe(5);
	});

	it('should produce slide area with positive dimensions', () => {
		const layout = computeNotesPageLayout(0, 0);
		expect(layout.slideArea.width).toBeGreaterThan(0);
		expect(layout.slideArea.height).toBeGreaterThan(0);
	});

	it('should produce text area with positive dimensions', () => {
		const layout = computeNotesPageLayout(0, 0);
		expect(layout.textArea.width).toBeGreaterThan(0);
		expect(layout.textArea.height).toBeGreaterThan(0);
	});

	it('should maintain 16:9 aspect ratio for slide thumbnail', () => {
		const layout = computeNotesPageLayout(0, 0);
		const ratio = layout.slideArea.width / layout.slideArea.height;
		expect(ratio).toBeCloseTo(16 / 9, 1);
	});

	it('should position text area below slide area', () => {
		const layout = computeNotesPageLayout(0, 0);
		expect(layout.textArea.y).toBeGreaterThan(layout.slideArea.y);
	});

	it('should fit within printable area', () => {
		const printable = getNotesPrintableArea();
		const layout = computeNotesPageLayout(0, 0);

		expect(layout.slideArea.x).toBeGreaterThanOrEqual(0);
		expect(layout.slideArea.y).toBeGreaterThanOrEqual(0);
		expect(layout.slideArea.x + layout.slideArea.width).toBeLessThanOrEqual(
			printable.width + 0.01,
		);
		expect(layout.textArea.width).toBeLessThanOrEqual(printable.width + 0.01);
	});

	it('should centre the slide thumbnail horizontally', () => {
		const printable = getNotesPrintableArea();
		const layout = computeNotesPageLayout(0, 0);
		const expectedX = (printable.width - layout.slideArea.width) / 2;
		expect(layout.slideArea.x).toBeCloseTo(expectedX, 5);
	});

	it('should use A4 portrait by default', () => {
		const layout = computeNotesPageLayout(0, 0);
		expect(layout.textArea.width).toBeCloseTo(
			A4_PORTRAIT.width -
				A4_PORTRAIT.marginLeft -
				A4_PORTRAIT.marginRight,
			5,
		);
	});
});

describe('computeAllNotesPages', () => {
	it('should return empty array for empty slide list', () => {
		expect(computeAllNotesPages([])).toEqual([]);
	});

	it('should produce one page per slide', () => {
		const pages = computeAllNotesPages([0, 1, 2]);
		expect(pages.length).toBe(3);
	});

	it('should assign correct slide indices', () => {
		const pages = computeAllNotesPages([10, 20, 30]);
		expect(pages[0].slideIndex).toBe(10);
		expect(pages[1].slideIndex).toBe(20);
		expect(pages[2].slideIndex).toBe(30);
	});

	it('should assign sequential page indices', () => {
		const pages = computeAllNotesPages([0, 1, 2, 3]);
		pages.forEach((page, idx) => {
			expect(page.pageIndex).toBe(idx);
		});
	});

	it('should produce consistent layouts for all pages', () => {
		const pages = computeAllNotesPages([0, 1]);
		// Both pages should have the same dimensions (only indices differ)
		expect(pages[0].slideArea.width).toBe(pages[1].slideArea.width);
		expect(pages[0].slideArea.height).toBe(pages[1].slideArea.height);
		expect(pages[0].textArea.width).toBe(pages[1].textArea.width);
		expect(pages[0].textArea.height).toBe(pages[1].textArea.height);
	});

	it('should handle single slide', () => {
		const pages = computeAllNotesPages([42]);
		expect(pages.length).toBe(1);
		expect(pages[0].slideIndex).toBe(42);
		expect(pages[0].pageIndex).toBe(0);
	});
});

describe('getNotesPrintableArea', () => {
	it('should return portrait A4 printable dimensions', () => {
		const area = getNotesPrintableArea();
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

	it('should return positive dimensions', () => {
		const area = getNotesPrintableArea();
		expect(area.width).toBeGreaterThan(0);
		expect(area.height).toBeGreaterThan(0);
	});
});
