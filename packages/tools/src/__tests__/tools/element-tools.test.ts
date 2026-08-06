import type { PptxData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	addElement,
	updateElement,
	renameElement,
	deleteElements,
	arrangeElements,
	cloneElement,
	setElementAnimation,
	groupElements,
	ungroupElements,
	batchUpdateElements,
} from '../../tools/element-tools.js';
import type { ToolContext } from '../../types.js';

function makeTestPresentation(): PptxData {
	return {
		width: 960,
		height: 540,
		slides: [
			{
				id: 'slide-0',
				rId: 'rId2',
				slideNumber: 1,
				elements: [
					{
						id: 'el-0',
						type: 'text' as const,
						x: 100,
						y: 100,
						width: 300,
						height: 60,
						text: 'Hello world',
					},
					{
						id: 'el-1',
						type: 'shape' as const,
						x: 200,
						y: 200,
						width: 200,
						height: 100,
						shapeType: 'rect',
						shapeStyle: { fillColor: '#ff0000' },
					},
				],
				notes: '',
				comments: [],
			},
		],
	} as unknown as PptxData;
}

function ctx(pptxData?: PptxData): ToolContext {
	return { pptxData: pptxData ?? makeTestPresentation() };
}

// ── addElement ────────────────────────────────────────────────────────────────

describe('addElement', () => {
	it('adds a text element to the slide', () => {
		const c = ctx();
		const result = addElement(c, {
			slideIndex: 0,
			type: 'text',
			text: 'New text',
			fontSize: 24,
			bold: true,
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.slideIndex).toBe(0);
		const added = c.pptxData.slides[0].elements.find((e) => e.id === result.result.elementId);
		expect(added).toBeDefined();
		expect(added?.type).toBe('text');
	});

	it('adds a shape element', () => {
		const c = ctx();
		const result = addElement(c, {
			slideIndex: 0,
			type: 'shape',
			shapeType: 'ellipse',
			fillColor: '#0055aa',
			x: 50,
			y: 50,
			width: 150,
			height: 150,
		});
		expect(result.dirty).toBeTruthy();
		const added = c.pptxData.slides[0].elements.find((e) => e.id === result.result.elementId);
		expect(added?.type).toBe('shape');
	});

	it('adds a table element', () => {
		const c = ctx();
		const result = addElement(c, {
			slideIndex: 0,
			type: 'table',
			rows: 3,
			columns: 2,
		});
		expect(result.dirty).toBeTruthy();
		const added = c.pptxData.slides[0].elements.find((e) => e.id === result.result.elementId);
		expect(added?.type).toBe('table');
	});

	it('adds a connector element', () => {
		const c = ctx();
		const result = addElement(c, {
			slideIndex: 0,
			type: 'connector',
			endArrow: 'triangle',
		});
		expect(result.dirty).toBeTruthy();
		const added = c.pptxData.slides[0].elements.find((e) => e.id === result.result.elementId);
		expect(added?.type).toBe('connector');
	});

	it('throws on invalid slideIndex', () => {
		expect(() => addElement(ctx(), { slideIndex: 99, type: 'text' })).toThrow('out of range');
	});

	it('throws on unknown type', () => {
		expect(() =>
			addElement(ctx(), {
				slideIndex: 0,
				type: 'unknown' as 'text',
			}),
		).toThrow();
	});
});

// ── updateElement ─────────────────────────────────────────────────────────────

describe('updateElement', () => {
	it('updates position', () => {
		const c = ctx();
		const result = updateElement(c, {
			slideIndex: 0,
			elementId: 'el-0',
			x: 50,
			y: 75,
		});
		expect(result.dirty).toBeTruthy();
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'el-0');
		expect(el?.x).toBe(50);
		expect(el?.y).toBe(75);
	});

	it('updates text content', () => {
		const c = ctx();
		updateElement(c, {
			slideIndex: 0,
			elementId: 'el-0',
			text: 'Updated text',
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'el-0');
		expect((el as { text?: string }).text).toBe('Updated text');
	});

	it('updates shape style fill color', () => {
		const c = ctx();
		updateElement(c, {
			slideIndex: 0,
			elementId: 'el-1',
			fillColor: '#00ff00',
		});
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'el-1');
		expect((el as { shapeStyle?: { fillColor?: string } }).shapeStyle?.fillColor).toBe('#00ff00');
	});

	it('throws on missing element', () => {
		expect(() => updateElement(ctx(), { slideIndex: 0, elementId: 'nonexistent' })).toThrow(
			'not found',
		);
	});
});

// ── renameElement ─────────────────────────────────────────────────────────────

describe('renameElement', () => {
	it('sets the element name and reports dirty', () => {
		const c = ctx();
		const result = renameElement(c, { slideIndex: 0, elementId: 'el-0', name: 'Intro Title' });
		expect(result.dirty).toBeTruthy();
		expect(result.result).toStrictEqual({ elementId: 'el-0', name: 'Intro Title' });
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'el-0');
		expect(el?.name).toBe('Intro Title');
	});

	it('trims surrounding whitespace', () => {
		const c = ctx();
		renameElement(c, { slideIndex: 0, elementId: 'el-1', name: '  Hero Shape  ' });
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'el-1');
		expect(el?.name).toBe('Hero Shape');
	});

	it('clears the name when given an empty string', () => {
		const c = ctx();
		renameElement(c, { slideIndex: 0, elementId: 'el-0', name: 'Named' });
		renameElement(c, { slideIndex: 0, elementId: 'el-0', name: '   ' });
		const el = c.pptxData.slides[0].elements.find((e) => e.id === 'el-0');
		expect(el?.name).toBeUndefined();
		expect(el !== undefined && 'name' in el).toBeFalsy();
	});

	it('throws on missing element', () => {
		expect(() => renameElement(ctx(), { slideIndex: 0, elementId: 'nope', name: 'X' })).toThrow(
			'not found',
		);
	});

	it('throws on an out-of-range slide index', () => {
		expect(() => renameElement(ctx(), { slideIndex: 5, elementId: 'el-0', name: 'X' })).toThrow();
	});
});

// ── deleteElements ────────────────────────────────────────────────────────────

describe('deleteElements', () => {
	it('deletes the specified element', () => {
		const c = ctx();
		const result = deleteElements(c, {
			slideIndex: 0,
			elementIds: ['el-0'],
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.deletedCount).toBe(1);
		expect(c.pptxData.slides[0].elements.find((e) => e.id === 'el-0')).toBeUndefined();
	});

	it('deletes multiple elements', () => {
		const c = ctx();
		const result = deleteElements(c, {
			slideIndex: 0,
			elementIds: ['el-0', 'el-1'],
		});
		expect(result.result.deletedCount).toBe(2);
		expect(c.pptxData.slides[0].elements).toHaveLength(0);
	});

	it('throws when element not found', () => {
		expect(() =>
			deleteElements(ctx(), {
				slideIndex: 0,
				elementIds: ['nonexistent'],
			}),
		).toThrow('not found');
	});
});

// ── arrangeElements ───────────────────────────────────────────────────────────

describe('arrangeElements', () => {
	it('aligns elements left', () => {
		const c = ctx();
		const before0 = c.pptxData.slides[0].elements[0].x;
		const before1 = c.pptxData.slides[0].elements[1].x;
		const minX = Math.min(before0, before1);
		arrangeElements(c, {
			slideIndex: 0,
			action: 'align',
			elementIds: ['el-0', 'el-1'],
			alignment: 'left',
		});
		expect(c.pptxData.slides[0].elements[0].x).toBe(minX);
		expect(c.pptxData.slides[0].elements[1].x).toBe(minX);
	});

	it('brings element to front', () => {
		const c = ctx();
		arrangeElements(c, {
			slideIndex: 0,
			action: 'reorderLayer',
			elementId: 'el-0',
			layerAction: 'bringToFront',
		});
		const last = c.pptxData.slides[0].elements[c.pptxData.slides[0].elements.length - 1];
		expect(last.id).toBe('el-0');
	});

	it('throws when no elementIds for align', () => {
		expect(() =>
			arrangeElements(ctx(), {
				slideIndex: 0,
				action: 'align',
				alignment: 'left',
			}),
		).toThrow('elementIds is required');
	});

	it('throws on unknown action', () => {
		expect(() =>
			arrangeElements(ctx(), {
				slideIndex: 0,
				action: 'unknown' as 'align',
			}),
		).toThrow();
	});
});

// ── cloneElement ──────────────────────────────────────────────────────────────

describe('cloneElement', () => {
	it('clones to same slide with offset', () => {
		const c = ctx();
		const orig = c.pptxData.slides[0].elements[0];
		const result = cloneElement(c, {
			slideIndex: 0,
			elementId: 'el-0',
			offsetX: 30,
			offsetY: 30,
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.clonedIds).toHaveLength(1);
		const cloned = c.pptxData.slides[0].elements.find((e) => e.id === result.result.clonedIds[0]);
		expect(cloned).toBeDefined();
		expect(cloned?.id).not.toBe(orig.id);
		expect(cloned?.x).toBe(orig.x + 30);
		expect(cloned?.y).toBe(orig.y + 30);
	});

	it('throws when element not found', () => {
		expect(() => cloneElement(ctx(), { slideIndex: 0, elementId: 'nonexistent' })).toThrow(
			'not found',
		);
	});
});

// ── groupElements / ungroupElements ───────────────────────────────────────────

describe('groupElements', () => {
	it('groups elements and creates a group', () => {
		const c = ctx();
		const result = groupElements(c, {
			slideIndex: 0,
			elementIds: ['el-0', 'el-1'],
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.groupId).toBeTruthy();
		// original elements should be gone
		expect(c.pptxData.slides[0].elements.find((e) => e.id === 'el-0')).toBeUndefined();
		expect(c.pptxData.slides[0].elements.find((e) => e.id === 'el-1')).toBeUndefined();
		// group element should exist
		const grp = c.pptxData.slides[0].elements.find((e) => e.id === result.result.groupId);
		expect(grp?.type).toBe('group');
	});

	it('throws with fewer than 2 elements', () => {
		expect(() => groupElements(ctx(), { slideIndex: 0, elementIds: ['el-0'] })).toThrow(
			'At least 2',
		);
	});
});

describe('ungroupElements', () => {
	it('ungroups and restores elements to slide', () => {
		const c = ctx();
		const groupResult = groupElements(c, {
			slideIndex: 0,
			elementIds: ['el-0', 'el-1'],
		});
		const ungroupResult = ungroupElements(c, {
			slideIndex: 0,
			groupElementId: groupResult.result.groupId,
		});
		expect(ungroupResult.dirty).toBeTruthy();
		expect(ungroupResult.result.restoredIds).toHaveLength(2);
		// group should be gone
		expect(
			c.pptxData.slides[0].elements.find((e) => e.id === groupResult.result.groupId),
		).toBeUndefined();
	});

	it('throws when element is not a group', () => {
		expect(() => ungroupElements(ctx(), { slideIndex: 0, groupElementId: 'el-0' })).toThrow(
			'not a group',
		);
	});
});

// ── setElementAnimation ─────────────────────────────────────────────────────

describe('setElementAnimation', () => {
	it('sets an entrance animation on an element', () => {
		const c = ctx();
		const result = setElementAnimation(c, {
			slideIndex: 0,
			elementId: 'el-0',
			entrance: 'fadeIn',
			durationMs: 500,
		});
		expect(result.dirty).toBeTruthy();
		const slide = c.pptxData.slides[0];
		const anim = (
			slide as unknown as {
				animations: { elementId: string; entrance?: string }[];
			}
		).animations;
		expect(anim).toBeDefined();
		const match = anim.find((a) => a.elementId === 'el-0');
		expect(match?.entrance).toBe('fadeIn');
	});
});

// ── batchUpdateElements ─────────────────────────────────────────────────────

describe('batchUpdateElements', () => {
	it('updates multiple elements at once', () => {
		const c = ctx();
		const result = batchUpdateElements(c, {
			slideIndex: 0,
			elementIds: ['el-0', 'el-1'],
			opacity: 0.5,
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.updatedCount).toBe(2);
		expect(c.pptxData.slides[0].elements[0].opacity).toBe(0.5);
		expect(c.pptxData.slides[0].elements[1].opacity).toBe(0.5);
	});

	it('returns zero updated count when no elements match', () => {
		const result = batchUpdateElements(ctx(), {
			slideIndex: 0,
			elementIds: ['nonexistent'],
			opacity: 0.5,
		});
		expect(result.result.updatedCount).toBe(0);
	});
});
