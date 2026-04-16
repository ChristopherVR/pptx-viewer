import { describe, it, expect } from 'vitest';

import type {
	PptxSmartArtData,
	PptxSmartArtNode,
	PptxSmartArtDrawingShape,
	SmartArtLayoutType,
} from '../types';
import { relayoutSmartArt } from './smartart-relayout';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeNode(id: string, text: string, parentId?: string): PptxSmartArtNode {
	return { id, text, parentId };
}

function makeData(
	nodes: PptxSmartArtNode[],
	resolvedLayoutType?: SmartArtLayoutType,
	overrides?: Partial<PptxSmartArtData>,
): PptxSmartArtData {
	return {
		nodes,
		resolvedLayoutType,
		...overrides,
	};
}

const W = 800;
const H = 400;

// ── Tests ───────────────────────────────────────────────────────────────

describe('relayoutSmartArt', () => {
	// 1. List layout produces horizontal arrangement (vertical stacking via linear)
	it('list layout produces shapes for each content node', () => {
		const nodes = [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')];
		const data = makeData(nodes, 'list');
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes).toHaveLength(3);
		// Shapes should be ordered top-to-bottom or left-to-right
		for (const s of shapes) {
			expect(s.x).toBeGreaterThanOrEqual(0);
			expect(s.y).toBeGreaterThanOrEqual(0);
			expect(s.width).toBeGreaterThan(0);
			expect(s.height).toBeGreaterThan(0);
		}
	});

	// 2. Hierarchy layout produces tree structure
	it('hierarchy layout produces tree structure with parent and children', () => {
		const nodes = [
			makeNode('root', 'CEO'),
			makeNode('c1', 'VP Eng', 'root'),
			makeNode('c2', 'VP Sales', 'root'),
		];
		const data = makeData(nodes, 'hierarchy');
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes.length).toBeGreaterThanOrEqual(3);
		// Root should be positioned above children (lower y value)
		const rootShape = shapes.find((s) => s.text === 'CEO');
		const child1 = shapes.find((s) => s.text === 'VP Eng');
		const child2 = shapes.find((s) => s.text === 'VP Sales');
		expect(rootShape).toBeDefined();
		expect(child1).toBeDefined();
		expect(child2).toBeDefined();
		expect(rootShape!.y).toBeLessThan(child1!.y);
		expect(rootShape!.y).toBeLessThan(child2!.y);
	});

	// 3. Process layout produces left-to-right arrangement
	it('process layout produces left-to-right arrangement', () => {
		const nodes = [makeNode('1', 'Step 1'), makeNode('2', 'Step 2'), makeNode('3', 'Step 3')];
		const data = makeData(nodes, 'process');
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes).toHaveLength(3);
		// Each successive shape should have a greater x value
		for (let i = 1; i < shapes.length; i++) {
			expect(shapes[i].x).toBeGreaterThan(shapes[i - 1].x);
		}
	});

	// 4. Adding a node triggers relayout with correct count
	it('adding a node produces shapes with increased count', () => {
		const nodesBeforeAdd = [makeNode('1', 'A'), makeNode('2', 'B')];
		const dataBefore = makeData(nodesBeforeAdd, 'list');
		const shapesBefore = relayoutSmartArt(dataBefore, W, H);

		const nodesAfterAdd = [...nodesBeforeAdd, makeNode('3', 'C')];
		const dataAfter = makeData(nodesAfterAdd, 'list');
		const shapesAfter = relayoutSmartArt(dataAfter, W, H);

		expect(shapesAfter).toHaveLength(shapesBefore.length + 1);
	});

	// 5. Removing a node reduces shape count
	it('removing a node reduces shape count', () => {
		const nodesFull = [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')];
		const dataFull = makeData(nodesFull, 'list');
		const shapesFull = relayoutSmartArt(dataFull, W, H);

		const nodesReduced = [makeNode('1', 'A'), makeNode('3', 'C')];
		const dataReduced = makeData(nodesReduced, 'list');
		const shapesReduced = relayoutSmartArt(dataReduced, W, H);

		expect(shapesReduced).toHaveLength(shapesFull.length - 1);
	});

	// 6. Unknown layout type returns existing shapes
	it('returns existing drawingShapes for unknown layout type when nodes have no text', () => {
		const existingShapes: PptxSmartArtDrawingShape[] = [
			{ id: 'existing-1', shapeType: 'rect', x: 10, y: 20, width: 100, height: 50, text: 'X' },
		];
		// Nodes with empty text trigger the fallback (layout engine returns undefined
		// when there are no content nodes)
		const nodes: PptxSmartArtNode[] = [{ id: '1', text: '' }];
		const data = makeData(nodes, 'unknown' as SmartArtLayoutType, {
			drawingShapes: existingShapes,
		});
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes).toStrictEqual(existingShapes);
	});

	// 7. Empty nodes returns empty shapes
	it('returns empty array when nodes array is empty', () => {
		const data = makeData([], 'list');
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes).toStrictEqual([]);
	});

	// 8. Single node returns one shape
	it('returns exactly one shape for a single node', () => {
		const nodes = [makeNode('solo', 'Only Node')];
		const data = makeData(nodes, 'process');
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes).toHaveLength(1);
		expect(shapes[0].text).toBe('Only Node');
	});

	// 9. Relayout preserves text content
	it('preserves text content from nodes in output shapes', () => {
		const nodes = [makeNode('a', 'Alpha'), makeNode('b', 'Beta'), makeNode('c', 'Gamma')];
		const data = makeData(nodes, 'list');
		const shapes = relayoutSmartArt(data, W, H);

		const texts = shapes.map((s) => s.text);
		expect(texts).toContain('Alpha');
		expect(texts).toContain('Beta');
		expect(texts).toContain('Gamma');
	});

	// 10. Container dimensions affect shape sizing
	it('wider container produces wider shapes', () => {
		const nodes = [makeNode('1', 'A'), makeNode('2', 'B')];
		const data = makeData(nodes, 'process');
		const shapesNarrow = relayoutSmartArt(data, 400, 300);
		const shapesWide = relayoutSmartArt(data, 1200, 300);

		// Shapes in the wider container should be wider
		expect(shapesWide[0].width).toBeGreaterThan(shapesNarrow[0].width);
	});

	// 11. Cycle layout produces shapes
	it('cycle layout produces shapes arranged in a cycle', () => {
		const nodes = [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')];
		const data = makeData(nodes, 'cycle');
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes).toHaveLength(3);
		// All shapes should fit within the container bounds
		for (const s of shapes) {
			expect(s.x).toBeGreaterThanOrEqual(0);
			expect(s.y).toBeGreaterThanOrEqual(0);
			expect(s.x + s.width).toBeLessThanOrEqual(W + 1); // +1 for rounding
			expect(s.y + s.height).toBeLessThanOrEqual(H + 1);
		}
	});

	// 12. Pyramid layout produces shapes
	it('pyramid layout produces shapes', () => {
		const nodes = [makeNode('1', 'Top'), makeNode('2', 'Mid'), makeNode('3', 'Base')];
		const data = makeData(nodes, 'pyramid');
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes).toHaveLength(3);
		for (const s of shapes) {
			expect(s.width).toBeGreaterThan(0);
			expect(s.height).toBeGreaterThan(0);
		}
	});

	// 13. Fallback returns empty array when no drawingShapes and engine fails
	it('returns empty array when no existing drawingShapes and engine produces nothing', () => {
		const nodes: PptxSmartArtNode[] = [{ id: '1', text: '' }];
		const data = makeData(nodes, 'list');
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes).toStrictEqual([]);
	});

	// 14. Matrix layout
	it('matrix layout produces shapes for all nodes', () => {
		const nodes = [
			makeNode('1', 'TL'),
			makeNode('2', 'TR'),
			makeNode('3', 'BL'),
			makeNode('4', 'BR'),
		];
		const data = makeData(nodes, 'matrix');
		const shapes = relayoutSmartArt(data, W, H);

		expect(shapes).toHaveLength(4);
	});

	// 15. Shapes have unique IDs
	it('all shapes have unique IDs', () => {
		const nodes = [makeNode('1', 'A'), makeNode('2', 'B'), makeNode('3', 'C')];
		const data = makeData(nodes, 'list');
		const shapes = relayoutSmartArt(data, W, H);

		const ids = shapes.map((s) => s.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});
});
