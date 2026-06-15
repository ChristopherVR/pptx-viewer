import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SelectionOverlay from './SelectionOverlay.vue';

function el(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 100,
		y: 100,
		width: 200,
		height: 100,
		...overrides,
	} as PptxElement;
}

function pointer(type: string, init: PointerEventInit & { pointerId?: number }): Event {
	// happy-dom may lack a PointerEvent ctor; fall back to a MouseEvent-like.
	const Ctor =
		typeof PointerEvent === 'function' ? PointerEvent : (MouseEvent as typeof PointerEvent);
	return new Ctor(type, { bubbles: true, cancelable: true, pointerId: 1, ...init });
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('selectionOverlay', () => {
	it('renders a selection box only for selected elements', () => {
		const wrapper = mount(SelectionOverlay, {
			props: {
				elements: [el({ id: 'a' }), el({ id: 'b' })],
				selectedIds: ['a'],
				zoom: 1,
			},
		});
		expect(wrapper.findAll('.pptx-vue-selection-box')).toHaveLength(1);
		expect(wrapper.find('[data-selection-for="a"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-selection-for="b"]').exists()).toBeFalsy();
	});

	it('renders 8 resize handles and a rotate knob per selection', () => {
		const wrapper = mount(SelectionOverlay, {
			props: { elements: [el()], selectedIds: ['s1'], zoom: 1 },
		});
		expect(wrapper.findAll('.pptx-vue-resize-handle')).toHaveLength(8);
		expect(wrapper.find('.pptx-vue-rotate-knob').exists()).toBeTruthy();
	});

	it('positions the box using element coordinates', () => {
		const wrapper = mount(SelectionOverlay, {
			props: {
				elements: [el({ x: 30, y: 40, width: 80, height: 60 })],
				selectedIds: ['s1'],
				zoom: 1,
			},
		});
		const style = wrapper.find('.pptx-vue-selection-box').attributes('style') ?? '';
		expect(style).toContain('left: 30px');
		expect(style).toContain('top: 40px');
		expect(style).toContain('width: 80px');
		expect(style).toContain('height: 60px');
	});

	it('emits transformStart then live transform then transformEnd for a move', async () => {
		const wrapper = mount(SelectionOverlay, {
			attachTo: document.body,
			props: { elements: [el()], selectedIds: ['s1'], zoom: 1 },
		});
		const body = wrapper.find('.pptx-vue-selection-body');

		body.element.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 20 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 50, clientY: 20 }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('transformStart')).toBeTruthy();
		const moves = wrapper.emitted('transform');
		expect(moves).toBeTruthy();
		const last = moves?.[moves.length - 1]?.[0] as { x: number; y: number; id: string };
		expect(last.id).toBe('s1');
		expect(last.x).toBe(150); // 100 + 50/zoom
		expect(last.y).toBe(120); // 100 + 20/zoom

		const ends = wrapper.emitted('transformEnd');
		expect(ends).toBeTruthy();
		const end = ends?.[0]?.[0] as { x: number; y: number };
		expect(end.x).toBe(150);
		expect(end.y).toBe(120);

		wrapper.unmount();
	});

	it('divides drag deltas by zoom', async () => {
		const wrapper = mount(SelectionOverlay, {
			attachTo: document.body,
			props: { elements: [el()], selectedIds: ['s1'], zoom: 2 },
		});
		const body = wrapper.find('.pptx-vue-selection-body');
		body.element.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointermove', { clientX: 100, clientY: 0 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 0 }));
		await wrapper.vm.$nextTick();
		const moves = wrapper.emitted('transform');
		const last = moves?.[moves.length - 1]?.[0] as { x: number };
		expect(last.x).toBe(150); // 100 + 100/2
		wrapper.unmount();
	});

	it('resizes from the SE handle', async () => {
		const wrapper = mount(SelectionOverlay, {
			attachTo: document.body,
			props: { elements: [el()], selectedIds: ['s1'], zoom: 1 },
		});
		const se = wrapper.find('[data-handle="se"]');
		se.element.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 10 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 30, clientY: 10 }));
		await wrapper.vm.$nextTick();
		const moves = wrapper.emitted('transform');
		const last = moves?.[moves.length - 1]?.[0] as { width: number; height: number };
		expect(last.width).toBe(230);
		expect(last.height).toBe(110);
		wrapper.unmount();
	});

	it('does not emit a live transform inside the 2px dead zone', async () => {
		const wrapper = mount(SelectionOverlay, {
			attachTo: document.body,
			props: { elements: [el()], selectedIds: ['s1'], zoom: 1 },
		});
		const body = wrapper.find('.pptx-vue-selection-body');
		body.element.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointermove', { clientX: 1, clientY: 1 }));
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('transform')).toBeFalsy();
		window.dispatchEvent(pointer('pointerup', { clientX: 1, clientY: 1 }));
		wrapper.unmount();
	});
});
