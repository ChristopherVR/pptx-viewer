import { describe, expect, it } from 'vitest';

import { INSERT_CHART_TYPES } from '../internal/shared';
import {
	newChartElement,
	newEquationElement,
	newShapeElement,
	newSmartArtElement,
	newTableElement,
	newTextElement,
} from './editor-insert';

describe('newTextElement', () => {
	it('returns type "text"', () => {
		expect(newTextElement().type).toBe('text');
	});

	it('leaves id as empty string', () => {
		expect(newTextElement().id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newTextElement();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses sensible default position when no args given', () => {
		const el = newTextElement();
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});

	it('accepts custom x/y overrides', () => {
		const el = newTextElement(250, 300);
		expect(el.x).toBe(250);
		expect(el.y).toBe(300);
	});

	it('carries non-empty text content', () => {
		const el = newTextElement();
		expect(el.type).toBe('text');
		// Narrow to access text-specific field.
		if (el.type === 'text') {
			expect(el.text).toBeTypeOf('string');
			expect((el.text ?? '').length).toBeGreaterThan(0);
		}
	});
});

describe('newShapeElement', () => {
	it('returns type "shape"', () => {
		expect(newShapeElement('rect').type).toBe('shape');
	});

	it('leaves id as empty string', () => {
		expect(newShapeElement('ellipse').id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newShapeElement('rect');
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('preserves the shapeType for rect', () => {
		const el = newShapeElement('rect');
		if (el.type === 'shape') {
			expect(el.shapeType).toBe('rect');
		}
	});

	it('preserves the shapeType for ellipse', () => {
		const el = newShapeElement('ellipse');
		if (el.type === 'shape') {
			expect(el.shapeType).toBe('ellipse');
		}
	});

	it('preserves the shapeType for line', () => {
		const el = newShapeElement('line');
		if (el.type === 'shape') {
			expect(el.shapeType).toBe('line');
		}
	});

	it('accepts custom x/y overrides', () => {
		const el = newShapeElement('rect', 400, 200);
		expect(el.x).toBe(400);
		expect(el.y).toBe(200);
	});

	it('uses sensible default position when no args given', () => {
		const el = newShapeElement('ellipse');
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});
});

describe('newTableElement', () => {
	it('returns type "table"', () => {
		expect(newTableElement().type).toBe('table');
	});

	it('leaves id as empty string', () => {
		expect(newTableElement().id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newTableElement();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses sensible default position when no args given', () => {
		const el = newTableElement();
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});

	it('accepts custom x/y overrides', () => {
		const el = newTableElement(3, 3, 200, 300);
		expect(el.x).toBe(200);
		expect(el.y).toBe(300);
	});

	it('produces tableData with the requested row and column counts', () => {
		const el = newTableElement(4, 5);
		if (el.type === 'table') {
			expect(el.tableData?.rows).toHaveLength(4);
			for (const row of el.tableData?.rows ?? []) {
				expect(row.cells).toHaveLength(5);
			}
		}
	});

	it('column widths sum to 1 (approximately)', () => {
		const el = newTableElement(3, 4);
		if (el.type === 'table') {
			const total = (el.tableData?.columnWidths ?? []).reduce((a, b) => a + b, 0);
			expect(total).toBeCloseTo(1, 5);
		}
	});

	it('sets firstRowHeader on tableData', () => {
		const el = newTableElement();
		if (el.type === 'table') {
			expect(el.tableData?.firstRowHeader).toBeTruthy();
		}
	});

	it('uses default 3×3 grid when called with no arguments', () => {
		const el = newTableElement();
		if (el.type === 'table') {
			expect(el.tableData?.rows.length).toBe(3);
			expect(el.tableData?.rows[0]?.cells.length).toBe(3);
		}
	});
});

describe('newSmartArtElement', () => {
	it('returns type "smartArt"', () => {
		expect(newSmartArtElement().type).toBe('smartArt');
	});

	it('leaves id as empty string', () => {
		expect(newSmartArtElement().id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newSmartArtElement();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses sensible default position when no args given', () => {
		const el = newSmartArtElement();
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});

	it('accepts custom x/y overrides', () => {
		const el = newSmartArtElement(250, 350);
		expect(el.x).toBe(250);
		expect(el.y).toBe(350);
	});

	it('produces smartArtData with at least one node', () => {
		const el = newSmartArtElement();
		if (el.type === 'smartArt') {
			expect(el.smartArtData?.nodes.length).toBeGreaterThan(0);
		}
	});

	it('sets layout to basicBlockList', () => {
		const el = newSmartArtElement();
		if (el.type === 'smartArt') {
			expect(el.smartArtData?.layout).toBe('basicBlockList');
		}
	});

	it('assigns unique node ids', () => {
		const el = newSmartArtElement();
		if (el.type === 'smartArt') {
			const ids = el.smartArtData?.nodes.map((n) => n.id) ?? [];
			expect(new Set(ids).size).toBe(ids.length);
		}
	});
});

describe('newEquationElement', () => {
	it('returns type "shape" (equation rendered via textSegments)', () => {
		expect(newEquationElement().type).toBe('shape');
	});

	it('leaves id as empty string', () => {
		expect(newEquationElement().id).toBe('');
	});

	it('has a positive default width and height', () => {
		const el = newEquationElement();
		expect(el.width).toBeGreaterThan(0);
		expect(el.height).toBeGreaterThan(0);
	});

	it('uses sensible default position when no args given', () => {
		const el = newEquationElement();
		expect(el.x).toBeGreaterThanOrEqual(0);
		expect(el.y).toBeGreaterThanOrEqual(0);
	});

	it('accepts custom x/y overrides', () => {
		const el = newEquationElement(300, 400);
		expect(el.x).toBe(300);
		expect(el.y).toBe(400);
	});

	it('carries at least one textSegment with equationXml', () => {
		const el = newEquationElement();
		if (el.type === 'shape') {
			expect(el.textSegments).toBeDefined();
			expect(el.textSegments?.length).toBeGreaterThan(0);
			const firstSeg = el.textSegments?.[0];
			expect(firstSeg?.equationXml).toBeDefined();
			expect(firstSeg?.equationXml).toBeTypeOf('object');
		}
	});

	it('has non-empty fallback text', () => {
		const el = newEquationElement();
		if (el.type === 'shape') {
			expect((el.text ?? '').length).toBeGreaterThan(0);
		}
	});
});

describe('newChartElement', () => {
	it('offers Pareto in the dropdown and inserts a valid histogram+cumulative-percent chart (docs/guide/limitations.md ChartEx row)', () => {
		const pareto = INSERT_CHART_TYPES.find((opt) => opt.id === 'pareto');
		expect(pareto).toBeDefined();
		expect(pareto?.type).toBe('histogram');

		const el = newChartElement('pareto');
		expect(el.type).toBe('chart');
		expect(el.id).toBe('');
		if (el.type === 'chart') {
			expect(el.chartData?.chartType).toBe('histogram');
			expect(el.chartData?.series).toHaveLength(2);
			expect(el.chartData?.series?.[1].histogramOptions?.layout).toBe('pareto');
		}
	});
});
