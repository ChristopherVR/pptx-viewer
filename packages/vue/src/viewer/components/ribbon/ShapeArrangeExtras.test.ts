import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import ShapeArrangeExtras from './ShapeArrangeExtras.vue';

/**
 * ShapeArrangeExtras: Group/Ungroup/outline-width gating is repointed onto
 * shared `render/arrange-extras.ts` (`canGroupSelection`, `canUngroupSelection`,
 * `canSetStrokeWidth`, `strokeWidthOf`). These pin the gating THROUGH the Vue
 * component, not just against the shared functions directly.
 */
function shapeEl(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		...overrides,
	} as PptxElement;
}

function groupEl(): PptxElement {
	return { type: 'group', id: 'g1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
}

function mountExtras(props: {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	selectedCount: number;
	selectionGroupable?: boolean;
}) {
	return mount(ShapeArrangeExtras, {
		props: {
			selectionGroupable: true,
			...props,
			onGroupElements: vi.fn(),
			onUngroupElement: vi.fn(),
			onUpdateElementStyle: vi.fn(),
		},
	});
}

describe('shapeArrangeExtras - group/ungroup gating', () => {
	it('disables Group with fewer than two selected elements', () => {
		const wrapper = mountExtras({ canEdit: true, selectedElement: shapeEl(), selectedCount: 1 });
		expect(wrapper.get('button[title="Group"]').attributes('disabled')).toBeDefined();
	});

	it('enables Group with two or more selected elements while editable', () => {
		const wrapper = mountExtras({ canEdit: true, selectedElement: null, selectedCount: 2 });
		expect(wrapper.get('button[title="Group"]').attributes('disabled')).toBeUndefined();
	});

	it('disables Group and Ungroup when the deck is not editable', () => {
		const wrapper = mountExtras({ canEdit: false, selectedElement: groupEl(), selectedCount: 2 });
		expect(wrapper.get('button[title="Group"]').attributes('disabled')).toBeDefined();
		expect(wrapper.get('button[title="Ungroup"]').attributes('disabled')).toBeDefined();
	});

	it('disables Group when a:spLocks/@noGrp locks a selected element even with two selected', () => {
		const wrapper = mountExtras({
			canEdit: true,
			selectedElement: null,
			selectedCount: 2,
			selectionGroupable: false,
		});
		expect(wrapper.get('button[title="Group"]').attributes('disabled')).toBeDefined();
	});

	it('enables Ungroup only when the selection is a group', () => {
		const notGroup = mountExtras({ canEdit: true, selectedElement: shapeEl(), selectedCount: 1 });
		expect(notGroup.get('button[title="Ungroup"]').attributes('disabled')).toBeDefined();

		const isGroup = mountExtras({ canEdit: true, selectedElement: groupEl(), selectedCount: 1 });
		expect(isGroup.get('button[title="Ungroup"]').attributes('disabled')).toBeUndefined();
	});

	it('disables Ungroup when a:grpSpLocks/@noGrp is set on the group itself', () => {
		const lockedGroup = { ...groupEl(), locks: { noGrouping: true } } as PptxElement;
		const wrapper = mountExtras({ canEdit: true, selectedElement: lockedGroup, selectedCount: 1 });
		expect(wrapper.get('button[title="Ungroup"]').attributes('disabled')).toBeDefined();
	});
});

describe('shapeArrangeExtras - outline-width spinner', () => {
	it('defaults to the shared default stroke width when the shape declares none', () => {
		const wrapper = mountExtras({ canEdit: true, selectedElement: shapeEl(), selectedCount: 1 });
		expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe('1');
	});

	it('reads the shape stroke width when set', () => {
		const wrapper = mountExtras({
			canEdit: true,
			selectedElement: shapeEl({ shapeStyle: { strokeWidth: 4 } }),
			selectedCount: 1,
		});
		expect((wrapper.get('input[type="number"]').element as HTMLInputElement).value).toBe('4');
	});

	it('disables the spinner for a non-shape selection', () => {
		const wrapper = mountExtras({
			canEdit: true,
			selectedElement: { type: 'chart', id: 'c1' } as PptxElement,
			selectedCount: 1,
		});
		expect(wrapper.get('input[type="number"]').attributes('disabled')).toBeDefined();
	});
});
