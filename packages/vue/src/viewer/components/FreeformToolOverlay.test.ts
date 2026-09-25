import { mount } from '@vue/test-utils';
import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import {
	createOutlineAuthoringStore,
	OutlineAuthoringKey,
} from '../composables/useOutlineAuthoring';
import FreeformToolOverlay from './FreeformToolOverlay.vue';
import OutlineAuthoringLayer from './OutlineAuthoringLayer.vue';
import FreeformToolButtons from './ribbon/FreeformToolButtons.vue';

async function click(svg: ReturnType<ReturnType<typeof mount>['get']>, x: number, y: number) {
	await svg.trigger('pointerdown', { clientX: x, clientY: y, button: 0, pointerId: 1 });
	await svg.trigger('pointerup', { clientX: x, clientY: y, pointerId: 1 });
}

describe('freeformToolOverlay', () => {
	it('inserts a custom shape after clicks and a double-click', async () => {
		const onCommit = vi.fn<(element: ShapePptxElement) => void>();
		const wrapper = mount(FreeformToolOverlay, {
			attachTo: document.body,
			props: {
				tool: 'freeformShape',
				canvasSize: { width: 960, height: 540 },
				scale: 1,
				onCommit,
				onCancel: vi.fn(),
			},
		});
		const svg = wrapper.get('[data-pptx-freeform-tool-overlay="freeformShape"]');
		await click(svg, 10, 10);
		await click(svg, 110, 10);
		await click(svg, 110, 90);
		await click(svg, 110, 90);
		await svg.trigger('dblclick');
		expect(onCommit).toHaveBeenCalledOnce();
		expect(onCommit.mock.calls[0][0]).toMatchObject({ type: 'shape', shapeType: 'custom' });
		wrapper.unmount();
	});

	it('shows the start marker once a point is placed', async () => {
		const wrapper = mount(FreeformToolOverlay, {
			attachTo: document.body,
			props: {
				tool: 'curve',
				canvasSize: { width: 960, height: 540 },
				scale: 1,
				onCommit: vi.fn(),
				onCancel: vi.fn(),
			},
		});
		const svg = wrapper.get('svg');
		await click(svg, 20, 20);
		expect(wrapper.get('[data-pptx-freeform-start]').attributes('data-pptx-freeform-start')).toBe(
			'idle',
		);
		wrapper.unmount();
	});
});

describe('freeform tool buttons and the outline-authoring layer', () => {
	it('arm the drawing overlay and insert the drawn shape through the store', async () => {
		const addElement = vi.fn<(element: PptxElement) => void>();
		const store = createOutlineAuthoringStore({ updateElement: vi.fn(), addElement });
		const Host = defineComponent({
			setup: () => () =>
				h('div', [
					h(FreeformToolButtons, { canEdit: true }),
					h(OutlineAuthoringLayer, {
						activeSlide: undefined,
						canvasSize: { width: 960, height: 540 },
						scale: 1,
					}),
				]),
		});
		const wrapper = mount(Host, {
			attachTo: document.body,
			global: { provide: { [OutlineAuthoringKey as symbol]: store } },
		});
		const button = wrapper.get('[data-pptx-drawing-tool="curve"]');
		expect(wrapper.find('[data-pptx-drawing-tool="freeformShape"]').exists()).toBeTruthy();
		await button.trigger('click');
		expect(store.activeFreeformTool.value).toBe('curve');
		expect(button.attributes('aria-pressed')).toBe('true');
		const svg = wrapper.get('[data-pptx-freeform-tool-overlay="curve"]');
		await click(svg, 10, 10);
		await click(svg, 100, 60);
		await click(svg, 200, 10);
		await svg.trigger('dblclick');
		expect(addElement).toHaveBeenCalledOnce();
		expect(store.activeFreeformTool.value).toBeNull();
		expect(wrapper.find('[data-pptx-freeform-tool-overlay]').exists()).toBeFalsy();
		wrapper.unmount();
	});
});
