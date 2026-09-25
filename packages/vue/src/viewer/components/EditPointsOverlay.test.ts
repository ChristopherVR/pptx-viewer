import { mount } from '@vue/test-utils';
import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import type { EditPointsElementPatch } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import EditPointsOverlay from './EditPointsOverlay.vue';

const RECT: ShapePptxElement = {
	id: 'rect-1',
	type: 'shape',
	x: 100,
	y: 100,
	width: 200,
	height: 100,
	shapeType: 'rect',
};

function mountOverlay(element: PptxElement = RECT) {
	const onCommit = vi.fn<(id: string, patch: EditPointsElementPatch) => void>();
	const onExit = vi.fn();
	const wrapper = mount(EditPointsOverlay, {
		attachTo: document.body,
		props: { element, canvasSize: { width: 960, height: 540 }, scale: 1, onCommit, onExit },
	});
	return { wrapper, onCommit, onExit };
}

/**
 * EditPointsOverlay: the Vue paint of the shared EditPointsSession. The
 * overlay spans the stage in slide pixels; happy-dom reports a zero-size
 * bounding rect, which `clientToSlidePoint` treats as a 1:1 mapping, so
 * client coordinates ARE slide coordinates here.
 */
describe('editPointsOverlay', () => {
	it('renders a hit target per vertex and segment of the converted preset', () => {
		const { wrapper } = mountOverlay();
		const svg = wrapper.get('[data-pptx-edit-points-overlay="true"]');
		expect(svg.attributes('data-pptx-edit-points-element')).toBe('rect-1');
		expect(svg.attributes('role')).toBe('application');
		expect(wrapper.findAll('[data-pptx-edit-points-node-type]')).toHaveLength(4);
		expect(wrapper.find('[data-pptx-edit-points-target="segment:0:3"]').exists()).toBeTruthy();
		wrapper.unmount();
	});

	it('commits a custom-geometry patch when a vertex is dragged', async () => {
		const { wrapper, onCommit } = mountOverlay();
		const svg = wrapper.get('svg');
		await wrapper
			.get('[data-pptx-edit-points-target="node:0:2"]')
			.trigger('pointerdown', { clientX: 300, clientY: 200, button: 0, pointerId: 1 });
		await svg.trigger('pointermove', { clientX: 340, clientY: 240, pointerId: 1 });
		await svg.trigger('pointerup', { clientX: 340, clientY: 240, pointerId: 1 });
		expect(onCommit).toHaveBeenCalledOnce();
		const [id, patch] = onCommit.mock.calls[0];
		expect(id).toBe('rect-1');
		expect(patch).toMatchObject({ shapeType: 'custom', width: 240, height: 140 });
		expect(patch.customGeometryPaths?.[0].segments[0].type).toBe('moveTo');
		wrapper.unmount();
	});

	it('opens the vertex menu on right-click and runs a command from it', async () => {
		const { wrapper, onCommit } = mountOverlay();
		await wrapper
			.get('[data-pptx-edit-points-target="node:0:1"]')
			.trigger('contextmenu', { clientX: 300, clientY: 100, button: 2 });
		const menu = wrapper.get('[data-pptx-edit-points-menu="true"]');
		expect(menu.attributes('role')).toBe('menu');
		await menu.get('[data-pptx-edit-points-command="smooth-point"] button').trigger('click');
		expect(onCommit).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-pptx-edit-points-menu="true"]').exists()).toBeFalsy();
		wrapper.unmount();
	});

	it('leaves the mode on Escape', () => {
		const { wrapper, onExit } = mountOverlay();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(onExit).toHaveBeenCalledOnce();
		wrapper.unmount();
	});
});
