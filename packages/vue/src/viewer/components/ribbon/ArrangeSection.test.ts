import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import ArrangeSection from './ArrangeSection.vue';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

function mountArrange(overrides: Record<string, unknown> = {}) {
	return mount(ArrangeSection, {
		props: {
			canEdit: true,
			selectedElement: shape(),
			selectedCount: 1,
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
			...overrides,
		},
	});
}

/**
 * ArrangeSection: the Arrange group of the Home (and Arrange) tab.
 *
 * Asserted by accessible name rather than by index, because the two defects
 * these guard are both name-level: the group used to repeat the Clipboard
 * group's Cut / Copy / Paste, so the Home tab offered two different buttons
 * called "Copy", and it used to omit Group / Ungroup / outline width entirely.
 */
describe('arrangeSection', () => {
	it('does not repeat the Clipboard group cut/copy/paste commands', () => {
		const wrapper = mountArrange();
		const titles = wrapper.findAll('button').map((b) => b.attributes('title'));
		for (const clipboard of ['Cut', 'Copy', 'Paste']) {
			expect(titles).not.toContain(clipboard);
		}
		// The rest of the group is untouched.
		expect(titles).toContain('Duplicate');
	});

	it('offers Group, Ungroup and the outline-width spinner', () => {
		const wrapper = mountArrange();
		const names = wrapper.findAll('button').map((b) => b.attributes('aria-label'));
		expect(names).toContain('Group');
		expect(names).toContain('Ungroup');
		expect(wrapper.find('input[aria-label="Stroke width"]').exists()).toBeTruthy();
	});

	it('enables Group only once two elements are selected', async () => {
		const onGroupElements = vi.fn();
		const single = mountArrange({ onGroupElements });
		const groupOf = (w: ReturnType<typeof mountArrange>) =>
			w.findAll('button').find((b) => b.attributes('aria-label') === 'Group');

		expect(groupOf(single)?.attributes('disabled')).toBeDefined();

		const multi = mountArrange({ selectedCount: 2, onGroupElements });
		expect(groupOf(multi)?.attributes('disabled')).toBeUndefined();
		await groupOf(multi)?.trigger('click');
		expect(onGroupElements).toHaveBeenCalledOnce();
	});

	it('enables Ungroup only for a group selection', async () => {
		const onUngroupElement = vi.fn();
		const ungroupOf = (w: ReturnType<typeof mountArrange>) =>
			w.findAll('button').find((b) => b.attributes('aria-label') === 'Ungroup');

		expect(ungroupOf(mountArrange())?.attributes('disabled')).toBeDefined();

		const grouped = mountArrange({
			selectedElement: shape({ id: 'g1', type: 'group' }),
			onUngroupElement,
		});
		expect(ungroupOf(grouped)?.attributes('disabled')).toBeUndefined();
		await ungroupOf(grouped)?.trigger('click');
		expect(onUngroupElement).toHaveBeenCalledOnce();
	});

	it('writes the outline width through the element-style patch path', async () => {
		const onUpdateElementStyle = vi.fn();
		const wrapper = mountArrange({ onUpdateElementStyle });
		const input = wrapper.get('input[aria-label="Stroke width"]');

		expect(input.attributes('disabled')).toBeUndefined();
		expect((input.element as HTMLInputElement).value).toBe('1');

		await input.setValue('4.5');
		expect(onUpdateElementStyle).toHaveBeenCalledWith({ strokeWidth: 4.5 });
	});

	it('disables the outline width when the selection has no shape properties', () => {
		const wrapper = mountArrange({ selectedElement: null });
		expect(wrapper.get('input[aria-label="Stroke width"]').attributes('disabled')).toBeDefined();
	});
});
