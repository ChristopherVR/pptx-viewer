import type { PptxElement } from 'pptx-viewer-core';
import { MERGE_SHAPES_MENU_ITEMS } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import { mountWithMergeCrop } from '../../composables/merge-crop-test-harness';
import type { MergeCropHarness } from '../../composables/merge-crop-test-harness';
import ArrangeSection from './ArrangeSection.vue';

function shape(id: string, x: number, shapeType: string): PptxElement {
	return { id, type: 'shape', x, y: 0, width: 100, height: 100, shapeType } as PptxElement;
}
const PICTURE = {
	id: 'pic',
	type: 'picture',
	x: 300,
	y: 0,
	width: 200,
	height: 100,
} as PptxElement;

const arrangeProps = {
	canEdit: true,
	selectedElement: null,
	selectedCount: 0,
	selectionGroupable: true,
	onAlignElements: vi.fn(),
	onDistributeElements: vi.fn(),
	canDistribute: false,
	onFlip: vi.fn(),
	onMoveLayer: vi.fn(),
	onMoveLayerToEdge: vi.fn(),
	onGroupElements: vi.fn(),
	onUngroupElement: vi.fn(),
	onUpdateElementStyle: vi.fn(),
	onDuplicate: vi.fn(),
	onDelete: vi.fn(),
};

let harness: MergeCropHarness | null = null;
function mountArrange(selected: string[], extra: Record<string, unknown> = {}): MergeCropHarness {
	harness = mountWithMergeCrop(
		[shape('a', 0, 'rect'), shape('b', 50, 'ellipse'), PICTURE],
		selected,
		ArrangeSection,
		{ ...arrangeProps, ...extra },
	);
	return harness;
}
afterEach(() => {
	harness?.wrapper.unmount();
	harness = null;
});

const mergeButton = (h: MergeCropHarness) =>
	h.wrapper.get('[data-pptx-ribbon-control="merge-shapes"]');

describe('merge Shapes ribbon dropdown (vue)', () => {
	it('is disabled with the hint until two mergeable shapes are selected', () => {
		const h = mountArrange(['a']);
		expect(mergeButton(h).attributes('disabled')).toBeDefined();
		expect(mergeButton(h).attributes('title')).toBe('Select two or more shapes to merge them');
	});

	it('lists the five operations and replaces two shapes with one custom shape', async () => {
		const h = mountArrange(['a', 'b']);
		expect(mergeButton(h).attributes('disabled')).toBeUndefined();
		expect(mergeButton(h).attributes('aria-label')).toBe('Merge Shapes');
		await mergeButton(h).trigger('click');
		const items = h.wrapper.findAll('[role="menu"] [role="menuitem"]');
		expect(items.map((i) => i.attributes('data-pptx-merge-op'))).toStrictEqual(
			MERGE_SHAPES_MENU_ITEMS.map((i) => i.operation),
		);
		await h.wrapper.get('[data-pptx-merge-op="union"]').trigger('click');
		const ids = h.elements().map((el) => el.id);
		expect(ids).not.toContain('a');
		expect(ids).not.toContain('b');
		expect(h.elements()).toHaveLength(2);
		const merged = h.elements()[0];
		expect(merged).toMatchObject({ type: 'shape', shapeType: 'custom' });
		expect(h.selectedElementIds.value).toStrictEqual([merged.id]);
		// One undo step restores both sources.
		h.history.undo();
		expect(h.elements().map((el) => el.id)).toStrictEqual(['a', 'b', 'pic']);
	});

	it('hides both controls when the host hides them', async () => {
		const h = mountArrange(['a', 'b'], { hiddenActions: ['mergeShapes', 'crop'] });
		await nextTick();
		expect(h.wrapper.find('[data-pptx-ribbon-control="merge-shapes"]').exists()).toBeFalsy();
		expect(h.wrapper.find('[data-pptx-ribbon-control="crop"]').exists()).toBeFalsy();
	});
});

describe('crop ribbon controls (vue)', () => {
	it('enables Crop for a single picture and toggles crop mode', async () => {
		const h = mountArrange(['a']);
		const crop = () => h.wrapper.get('[data-pptx-ribbon-control="crop"]');
		expect(crop().attributes('disabled')).toBeDefined();
		h.selectedElementIds.value = ['pic'];
		await nextTick();
		expect(crop().attributes('disabled')).toBeUndefined();
		expect(crop().attributes('aria-pressed')).toBe('false');
		await crop().trigger('click');
		expect(h.controller.cropActive.value).toBeTruthy();
		expect(crop().attributes('aria-pressed')).toBe('true');
		await crop().trigger('click');
		expect(h.controller.cropActive.value).toBeFalsy();
	});

	it('applies an aspect preset as one undoable update', async () => {
		const h = mountArrange(['pic']);
		await h.wrapper.get('[data-pptx-ribbon-control="crop-menu"]').trigger('click');
		expect(h.wrapper.findAll('[data-pptx-crop-aspect]')).toHaveLength(11);
		expect(h.wrapper.find('[data-pptx-crop-action="fill"]').exists()).toBeTruthy();
		await h.wrapper.get('[data-pptx-crop-aspect="1:1"]').trigger('click');
		const pic = h.elements().find((el) => el.id === 'pic');
		expect(pic?.width).toBeCloseTo(100);
		expect(h.history.canUndo.value).toBeTruthy();
		h.history.undo();
		expect(h.elements().find((el) => el.id === 'pic')?.width).toBe(200);
		expect(h.history.canUndo.value).toBeFalsy();
	});
});
