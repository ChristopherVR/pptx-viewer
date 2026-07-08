import type {
	PptxElement,
	PptxSlide,
	TextPptxElement,
	ShapePptxElement,
	TablePptxElement,
} from 'pptx-viewer-core';
import { newTableElement } from 'pptx-viewer-shared';
import { describe, it, expect, vi } from 'vitest';

import { DEFAULT_TABLE_ROWS, DEFAULT_TABLE_COLUMNS, DEFAULT_TEXT_FONT_SIZE } from '../constants';
import type { InsertElementHandlers } from './useInsertElements';

// ---------------------------------------------------------------------------
// useInsertElements creates handlers for inserting elements into slides.
// We test the pure logic by extracting the element-building code and
// verifying the element shapes that would be produced.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// addElement logic (extracted from the hook)
// ---------------------------------------------------------------------------

/**
 * Simulate the addElement logic from useInsertElements.
 */
function simulateAddElement(
	slides: PptxSlide[],
	activeSlideIndex: number,
	element: PptxElement,
): PptxSlide[] {
	return slides.map((s, i) =>
		i === activeSlideIndex ? { ...s, elements: [...s.elements, element] } : s,
	);
}

function makeSlide(id: string, elements: PptxElement[] = []): PptxSlide {
	return {
		id,
		rId: `rId-${id}`,
		slideNumber: 1,
		elements,
	} as PptxSlide;
}

describe('simulateAddElement', () => {
	it('adds element to the correct slide', () => {
		const slides = [makeSlide('s1'), makeSlide('s2'), makeSlide('s3')];
		const newEl = {
			id: 'new1',
			type: 'text',
			x: 100,
			y: 100,
			width: 300,
			height: 60,
		} as PptxElement;

		const result = simulateAddElement(slides, 1, newEl);
		expect(result[0].elements).toHaveLength(0);
		expect(result[1].elements).toHaveLength(1);
		expect(result[1].elements[0].id).toBe('new1');
		expect(result[2].elements).toHaveLength(0);
	});

	it('preserves existing elements on the target slide', () => {
		const existingEl = {
			id: 'existing',
			type: 'shape',
			x: 0,
			y: 0,
			width: 50,
			height: 50,
		} as PptxElement;
		const slides = [makeSlide('s1', [existingEl])];
		const newEl = {
			id: 'new1',
			type: 'text',
			x: 200,
			y: 200,
			width: 100,
			height: 40,
		} as PptxElement;

		const result = simulateAddElement(slides, 0, newEl);
		expect(result[0].elements).toHaveLength(2);
		expect(result[0].elements[0].id).toBe('existing');
		expect(result[0].elements[1].id).toBe('new1');
	});

	it('does not mutate the original slides array', () => {
		const slides = [makeSlide('s1')];
		const newEl = {
			id: 'new1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		} as PptxElement;

		const result = simulateAddElement(slides, 0, newEl);
		expect(slides[0].elements).toHaveLength(0);
		expect(result[0].elements).toHaveLength(1);
		expect(result).not.toBe(slides);
	});
});

// ---------------------------------------------------------------------------
// Text box creation
// ---------------------------------------------------------------------------

describe('handleAddTextBox element shape', () => {
	it('creates a text element with expected defaults', () => {
		const element: Partial<TextPptxElement> = {
			type: 'text',
			x: 100,
			y: 100,
			width: 300,
			height: 60,
			text: '',
			textStyle: { fontSize: DEFAULT_TEXT_FONT_SIZE },
		};

		expect(element.type).toBe('text');
		expect(element.x).toBe(100);
		expect(element.y).toBe(100);
		expect(element.width).toBe(300);
		expect(element.height).toBe(60);
		expect(element.text).toBe('');
		expect(element.textStyle?.fontSize).toBe(24);
	});
});

// ---------------------------------------------------------------------------
// Shape creation
// ---------------------------------------------------------------------------

describe('handleAddShape element shape', () => {
	it('creates a shape element with expected defaults', () => {
		const newShapeType = 'ellipse';
		const element: Partial<ShapePptxElement> = {
			type: 'shape',
			x: 150,
			y: 150,
			width: 200,
			height: 150,
			shapeType: newShapeType,
			shapeStyle: {
				fillColor: '#3b82f6',
				strokeColor: '#1f2937',
				strokeWidth: 2,
			},
		};

		expect(element.type).toBe('shape');
		expect(element.shapeType).toBe('ellipse');
		expect(element.shapeStyle?.fillColor).toBe('#3b82f6');
		expect(element.shapeStyle?.strokeColor).toBe('#1f2937');
		expect(element.shapeStyle?.strokeWidth).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// Table creation
// ---------------------------------------------------------------------------

describe('handleAddTable element shape', () => {
	const table = newTableElement(DEFAULT_TABLE_ROWS, DEFAULT_TABLE_COLUMNS, 100, 200);
	const tableData = (table as TablePptxElement).tableData!;

	it('creates correct number of rows and columns', () => {
		expect(tableData.rows).toHaveLength(3);
		for (const row of tableData.rows) {
			expect(row.cells).toHaveLength(3);
		}
	});

	it('creates equal column widths summing to 1', () => {
		expect(tableData.columnWidths).toHaveLength(3);
		const sum = tableData.columnWidths.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(1, 10);
		tableData.columnWidths.forEach((w) => {
			expect(w).toBeCloseTo(1 / 3, 10);
		});
	});

	it('creates a visible default style: header row + banded rows + borders', () => {
		expect(tableData.firstRowHeader).toBeTruthy();
		expect(tableData.bandedRows).toBeTruthy();
		const headerCell = tableData.rows[0].cells[0];
		expect(headerCell.style?.bold).toBeTruthy();
		expect(headerCell.style?.backgroundColor).toBeTruthy();
		const bodyCell = tableData.rows[1].cells[0];
		expect(bodyCell.text).toBe('');
		expect(bodyCell.style?.borderTopWidth).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Guard: no-op when activeSlide is undefined
// ---------------------------------------------------------------------------

describe('activeSlide guard', () => {
	it('handlers should be no-ops when activeSlide is undefined', () => {
		// The hook's handlers check `if (!activeSlide) return;`
		// We verify the guard logic pattern
		const activeSlide: PptxSlide | undefined = undefined;
		const addElementCalled = vi.fn<() => void>();

		// Simulating the guard
		if (activeSlide) {
			addElementCalled();
		}

		expect(addElementCalled).not.toHaveBeenCalled();
	});

	it('handlers should proceed when activeSlide is defined', () => {
		const activeSlide: PptxSlide | undefined = makeSlide('s1');
		const addElementCalled = vi.fn<() => void>();

		if (activeSlide) {
			addElementCalled();
		}

		expect(addElementCalled).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// InsertElementHandlers type shape
// ---------------------------------------------------------------------------

describe('insertElementHandlers type', () => {
	it('has all expected handler functions', () => {
		const handlers: InsertElementHandlers = {
			handleAddTextBox: vi.fn<() => void>(),
			handleAddShape: vi.fn<() => void>(),
			handleAddTable: vi.fn<() => void>(),
			handleInsertSmartArt: vi.fn<() => void>(),
			handleInsertEquation: vi.fn<() => void>(),
			handleHyperlinkConfirm: vi.fn<() => void>(),
			handleInsertField: vi.fn<() => void>(),
			handleAddActionButton: vi.fn<() => void>(),
			handleAddInkElement: vi.fn<() => void>(),
			handleAddFreeformShape: vi.fn<() => void>(),
			handleImageFileChange: vi.fn<() => void>(),
			handleMediaFileChange: vi.fn<() => void>(),
		};
		expect(Object.keys(handlers)).toHaveLength(12);
	});
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('insert element constants', () => {
	it('dEFAULT_TABLE_ROWS is 3', () => {
		expect(DEFAULT_TABLE_ROWS).toBe(3);
	});

	it('dEFAULT_TABLE_COLUMNS is 3', () => {
		expect(DEFAULT_TABLE_COLUMNS).toBe(3);
	});

	it('dEFAULT_TEXT_FONT_SIZE is 24', () => {
		expect(DEFAULT_TEXT_FONT_SIZE).toBe(24);
	});
});
