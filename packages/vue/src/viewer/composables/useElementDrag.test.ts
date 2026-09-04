// oxlint-disable react-hooks/rules-of-hooks -- Vue composable, not a React hook
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import type { TemplateElementMap } from './template-editing';
import { useElementDrag } from './useElementDrag';

function shape(id: string, overrides: Partial<PptxElement> = {}): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 100, height: 100, ...overrides } as PptxElement;
}

/**
 * A connector glued to `a`'s right edge (site 3) and `b`'s left edge (site 1).
 * With both shapes 100x100 at y=0 and b at x=300, that resolves to a flat line
 * from (100,50) to (300,50).
 */
function connector(): PptxElement {
	return {
		type: 'connector',
		id: 'c',
		x: 100,
		y: 50,
		width: 200,
		height: 1,
		shapeStyle: {
			connectorStartConnection: { shapeId: 'a', connectionSiteIndex: 3 },
			connectorEndConnection: { shapeId: 'b', connectionSiteIndex: 1 },
		},
	} as unknown as PptxElement;
}

function pointer(type: string, init: PointerEventInit): Event {
	const Ctor =
		typeof PointerEvent === 'function' ? PointerEvent : (MouseEvent as typeof PointerEvent);
	return new Ctor(type, { bubbles: true, pointerId: 1, ...init });
}

function setup(elements: PptxElement[], gridSpacingPx?: number) {
	const slides = ref<PptxSlide[]>([{ id: 'slide-1', elements } as unknown as PptxSlide]);
	const activeSlideIndex = ref(0);
	const templateElementsBySlideId = ref<TemplateElementMap>({});
	const pushHistory = vi.fn();
	const enterInlineEdit = vi.fn();
	const drag = useElementDrag({
		findActiveElement: (id) => slides.value[0]?.elements.find((el) => el.id === id),
		pushHistory,
		effectiveZoom: computed(() => 1),
		activeTemplateElements: computed(() => []),
		activeSlide: computed(() => slides.value[0]),
		activeSlideIndex,
		slides,
		templateElementsBySlideId,
		canvasSize: ref({ width: 960, height: 540 }),
		enterInlineEdit,
		...(gridSpacingPx === undefined ? {} : { gridSpacingPx: computed(() => gridSpacingPx) }),
	});
	const find = (id: string): PptxElement | undefined =>
		slides.value[0]?.elements.find((el) => el.id === id);
	return { drag, slides, find, pushHistory, enterInlineEdit };
}

describe('useElementDrag: connector rerouting', () => {
	// Vue never called the shared reroute, so a connector stayed exactly where it
	// was drawn while the shape it is attached to walked off.
	it('reroutes a connector when the shape it starts at is dragged away', () => {
		const { drag, find } = setup([shape('a'), shape('b', { x: 300 }), connector()]);

		drag.startElementDrag(
			'a',
			pointer('pointerdown', { clientX: 0, clientY: 0 }) as PointerEvent,
			false,
		);
		window.dispatchEvent(pointer('pointermove', { clientX: 0, clientY: 200 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 200 }));

		expect(find('a')?.y).toBe(200);
		const c = find('c');
		// Start site is now (100,250), end site is still (300,50).
		expect(c?.x).toBe(100);
		expect(c?.y).toBe(50);
		expect(c?.width).toBe(200);
		expect(c?.height).toBe(200);
	});

	it('reroutes a connector when the shape it ends at is resized', () => {
		const { drag, find } = setup([shape('a'), shape('b', { x: 300 }), connector()]);

		drag.onTransformStart({ id: 'b' });
		drag.onTransformEnd({ id: 'b', x: 300, y: 0, width: 200, height: 100, rotation: 0 });

		// b's left-edge site is unchanged at (300,50), so the box is unchanged, but
		// widening it must not have been ignored: assert through a move of `a`.
		expect(find('b')?.width).toBe(200);
		drag.onTransformStart({ id: 'a' });
		drag.onTransformEnd({ id: 'a', x: 0, y: 100, width: 100, height: 100, rotation: 0 });
		expect(find('c')?.height).toBe(100);
	});

	it('leaves connectors alone when nothing they reference moved', () => {
		const { drag, slides, find } = setup([shape('a'), shape('b', { x: 300 }), connector()]);
		const before = slides.value;

		drag.onTransformStart({ id: 'c' });
		drag.onTransformEnd({ id: 'c', x: 100, y: 50, width: 200, height: 1, rotation: 0 });

		expect(find('c')?.height).toBe(1);
		expect(slides.value).not.toBe(before); // the connector's own patch still landed
	});
});

describe('useElementDrag: a:spLocks enforcement', () => {
	// The Vue inspector shipped a Lock toggle writing `locks` that nothing on the
	// canvas read, so a "locked" shape dragged exactly like an unlocked one.
	it('does not move an element locked with noMove, and takes no history entry', () => {
		const { drag, find, pushHistory } = setup([shape('a', { locks: { noMove: true } })]);

		drag.startElementDrag(
			'a',
			pointer('pointerdown', { clientX: 0, clientY: 0 }) as PointerEvent,
			false,
		);
		window.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 40 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 40 }));

		expect(find('a')?.x).toBe(0);
		expect(find('a')?.y).toBe(0);
		expect(pushHistory).not.toHaveBeenCalled();
	});

	it('still moves an unlocked element (the guard is not a blanket refusal)', () => {
		const { drag, find, pushHistory } = setup([shape('a')]);

		drag.startElementDrag(
			'a',
			pointer('pointerdown', { clientX: 0, clientY: 0 }) as PointerEvent,
			false,
		);
		window.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 40 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 40 }));

		expect(find('a')?.x).toBe(60);
		expect(pushHistory).toHaveBeenCalledOnce();
	});

	it('does not enter inline edit after a refused drag on a pinned element', () => {
		const { drag, enterInlineEdit } = setup([shape('a', { locks: { noMove: true } })]);

		drag.startElementDrag(
			'a',
			pointer('pointerdown', { clientX: 0, clientY: 0 }) as PointerEvent,
			true,
		);
		window.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 40 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 40 }));

		expect(enterInlineEdit).not.toHaveBeenCalled();
	});

	it('taps through to inline edit on a pinned element that never moved', () => {
		const { drag, enterInlineEdit } = setup([shape('a', { locks: { noMove: true } })]);

		drag.startElementDrag(
			'a',
			pointer('pointerdown', { clientX: 0, clientY: 0 }) as PointerEvent,
			true,
		);
		window.dispatchEvent(pointer('pointerup', { clientX: 0, clientY: 0 }));

		expect(enterInlineEdit).toHaveBeenCalledWith('a');
	});

	it('folds a resize back to the start size for a noResize element', () => {
		const { drag, find } = setup([shape('a', { locks: { noResize: true } })]);

		drag.onTransformStart({ id: 'a' });
		drag.onTransformEnd({ id: 'a', x: 0, y: 0, width: 400, height: 400, rotation: 0 });

		expect(find('a')?.width).toBe(100);
		expect(find('a')?.height).toBe(100);
	});

	it('folds a rotation back to the start angle for a noRotation element', () => {
		const { drag, find } = setup([shape('a', { locks: { noRotation: true } })]);

		drag.onTransformStart({ id: 'a' });
		drag.onTransformEnd({ id: 'a', x: 0, y: 0, width: 100, height: 100, rotation: 45 });

		expect(find('a')?.rotation).toBe(0);
	});

	it('still resizes a noMove element (each lock gates exactly one gesture)', () => {
		const { drag, find } = setup([shape('a', { locks: { noMove: true } })]);

		drag.onTransformStart({ id: 'a' });
		drag.onTransformEnd({ id: 'a', x: 0, y: 0, width: 250, height: 100, rotation: 0 });

		expect(find('a')?.width).toBe(250);
	});
});

describe('useElementDrag: grid spacing', () => {
	// Regression: the grid step used to be hardcoded to 8px with no path from
	// the deck's authored `viewProperties.gridSpacing` at all. The caller now
	// derives it via the shared `computeGridSpacingPx` and passes it in as
	// `gridSpacingPx`; this covers that the composable actually uses it instead
	// of its own default.
	it('snaps a drag to the deck-authored grid spacing, not the 8px default', () => {
		const { drag, find } = setup([shape('a')], 40);
		drag.snapToGrid.value = true;

		drag.startElementDrag(
			'a',
			pointer('pointerdown', { clientX: 0, clientY: 0 }) as PointerEvent,
			false,
		);
		// A move of (55, 55) rounds to the nearest 8px multiple (56) under the
		// default, but to the nearest 40px multiple (40) under the authored spacing.
		window.dispatchEvent(pointer('pointermove', { clientX: 55, clientY: 55 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 55, clientY: 55 }));

		expect(find('a')?.x).toBe(40);
		expect(find('a')?.y).toBe(40);
	});

	it('falls back to the 8px default when the deck has no gridSpacingPx input', () => {
		const { drag, find } = setup([shape('a')]);
		drag.snapToGrid.value = true;

		drag.startElementDrag(
			'a',
			pointer('pointerdown', { clientX: 0, clientY: 0 }) as PointerEvent,
			false,
		);
		window.dispatchEvent(pointer('pointermove', { clientX: 55, clientY: 55 }));
		window.dispatchEvent(pointer('pointerup', { clientX: 55, clientY: 55 }));

		expect(find('a')?.x).toBe(56);
		expect(find('a')?.y).toBe(56);
	});
});
