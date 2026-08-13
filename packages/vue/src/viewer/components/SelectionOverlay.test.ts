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

	// A press that never leaves the dead zone is a tap, not a drag, and the
	// overlay is what turns "click an already-selected element again" into an
	// inline edit. Nothing else in the app can emit this.
	it('treats a tap that never moved as a request to edit, not a transform', async () => {
		const wrapper = mount(SelectionOverlay, {
			attachTo: document.body,
			props: { elements: [el()], selectedIds: ['s1'], zoom: 1 },
		});
		const body = wrapper.find('.pptx-vue-selection-body');
		body.element.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('requestEdit')?.[0]?.[0]).toStrictEqual({ id: 's1' });
		expect(wrapper.emitted('transformEnd')).toBeFalsy();
		wrapper.unmount();
	});

	// The inspector's Lock toggle wrote `locks` that the overlay never read, so a
	// shape the author pinned still offered all nine transform affordances.
	it('hides the resize handles for a noResize element', () => {
		const wrapper = mount(SelectionOverlay, {
			props: {
				elements: [el({ locks: { noResize: true } })],
				selectedIds: ['s1'],
				zoom: 1,
			},
		});
		expect(wrapper.findAll('.pptx-vue-resize-handle')).toHaveLength(0);
		// Each lock gates exactly one gesture: rotation is still on offer.
		expect(wrapper.find('.pptx-vue-rotate-knob').exists()).toBeTruthy();
	});

	it('hides the rotate knob for a noRotation element', () => {
		const wrapper = mount(SelectionOverlay, {
			props: {
				elements: [el({ locks: { noRotation: true } })],
				selectedIds: ['s1'],
				zoom: 1,
			},
		});
		expect(wrapper.find('.pptx-vue-rotate-knob').exists()).toBeFalsy();
		expect(wrapper.findAll('.pptx-vue-resize-handle')).toHaveLength(8);
	});

	it('hides every transform affordance for a noSelect element', () => {
		const wrapper = mount(SelectionOverlay, {
			props: {
				elements: [el({ locks: { noSelect: true } })],
				selectedIds: ['s1'],
				zoom: 1,
			},
		});
		expect(wrapper.findAll('.pptx-vue-resize-handle')).toHaveLength(0);
		expect(wrapper.find('.pptx-vue-rotate-knob').exists()).toBeFalsy();
	});

	// The framework-neutral e2e contract: a selected roundRect must expose a
	// control named "Adjust shape" that drives the corner radius.
	it('exposes the adjust handle for a roundRect and drags its corner radius', async () => {
		const wrapper = mount(SelectionOverlay, {
			attachTo: document.body,
			props: {
				elements: [el({ shapeType: 'roundRect', shapeAdjustments: { adj: 16667 } })],
				selectedIds: ['s1'],
				zoom: 1,
			},
		});
		const adjust = wrapper.find('.pptx-vue-adjust-handle');
		expect(adjust.exists()).toBeTruthy();
		expect(adjust.attributes('aria-label')).toBe('Adjust shape');

		adjust.element.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
		window.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 0 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 0 }));
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('adjustStart')?.[0]?.[0]).toStrictEqual({ id: 's1' });
		const ends = wrapper.emitted('adjustEnd') ?? [];
		const adjustments = (ends[0]?.[0] as { adjustments: Record<string, number> } | undefined)
			?.adjustments;
		// 200x100 box, so ss = 100 px per 100000 guide units: +20 px is +20000.
		expect(adjustments?.adj).toBe(36667);
		wrapper.unmount();
	});

	// A preset with several `a:avLst` guides must offer one diamond per guide.
	it('exposes one adjust handle per adjustable parameter', () => {
		const wrapper = mount(SelectionOverlay, {
			props: {
				elements: [el({ shapeType: 'rightArrow' })],
				selectedIds: ['s1'],
				zoom: 1,
			},
		});
		const keys = wrapper
			.findAll('.pptx-vue-adjust-handle')
			.map((h) => h.attributes('data-pptx-adjust-key'));
		expect(keys).toStrictEqual(['adj1', 'adj2']);
	});

	it('offers no adjust handle for a plain rect', () => {
		const wrapper = mount(SelectionOverlay, {
			props: { elements: [el({ shapeType: 'rect' })], selectedIds: ['s1'], zoom: 1 },
		});
		expect(wrapper.find('.pptx-vue-adjust-handle').exists()).toBeFalsy();
	});

	it('hides the adjust handle for a shape locked with noAdjustHandles', () => {
		const wrapper = mount(SelectionOverlay, {
			props: {
				elements: [el({ shapeType: 'roundRect', locks: { noAdjustHandles: true } })],
				selectedIds: ['s1'],
				zoom: 1,
			},
		});
		expect(wrapper.find('.pptx-vue-adjust-handle').exists()).toBeFalsy();
	});

	it('rotates about the box centre, and snaps to 15 degrees with shift held', async () => {
		const wrapper = mount(SelectionOverlay, {
			attachTo: document.body,
			props: { elements: [el()], selectedIds: ['s1'], zoom: 1 },
		});
		// Rotation is the one gesture that maps client coords through the overlay
		// root, so the root's rect has to be believable; happy-dom reports zeroes.
		const root = wrapper.find('[data-testid="selection-overlay"]').element;
		vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			right: 800,
			bottom: 600,
			width: 800,
			height: 600,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);

		const knob = wrapper.find('.pptx-vue-rotate-knob');
		knob.element.dispatchEvent(pointer('pointerdown', { clientX: 200, clientY: 100 }));
		// The box spans (100,100)-(300,200), so its centre is (200,150). A pointer
		// straight to the right of the centre is 90 degrees from straight up.
		window.dispatchEvent(pointer('pointermove', { clientX: 400, clientY: 150 }));
		await wrapper.vm.$nextTick();

		const moves = wrapper.emitted('transform');
		const rotated = moves?.[moves.length - 1]?.[0] as { rotation: number };
		expect(rotated.rotation).toBeCloseTo(90, 5);

		// Shift snaps to the nearest 15-degree step.
		window.dispatchEvent(pointer('pointermove', { clientX: 400, clientY: 130, shiftKey: true }));
		await wrapper.vm.$nextTick();
		const all = wrapper.emitted('transform');
		const snapped = all?.[all.length - 1]?.[0] as { rotation: number };
		expect(snapped.rotation % 15).toBeCloseTo(0, 5);

		window.dispatchEvent(pointer('pointerup', { clientX: 400, clientY: 130 }));
		wrapper.unmount();
	});
});
