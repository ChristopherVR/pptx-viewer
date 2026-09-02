import type { PptxElement } from 'pptx-viewer-core';
import { getShapeAdjustmentHandleDescriptor } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { selectionInteractivity } from '../editor/editor-selection-interactivity';
import SelectionOverlay from './SelectionOverlay.svelte';

/**
 * SelectionOverlay chrome tests.
 *
 * Two gaps this covers, both of which shipped: the overlay drew its eight
 * resize handles and rotate knob unconditionally (so `a:spLocks` was invisible
 * on the canvas), and it had NO shape-adjustment handle at all, even though
 * `playwright.config.ts` records `aria-label="Adjust shape"` as a contract all
 * five bindings emit.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const BOX = { x: 100, y: 50, width: 200, height: 120, rotation: 0 };

function roundRect(adjustment?: number): PptxElement {
	return {
		type: 'shape',
		id: 'rr',
		x: BOX.x,
		y: BOX.y,
		width: BOX.width,
		height: BOX.height,
		rotation: 0,
		shapeType: 'roundRect',
		...(adjustment === undefined ? {} : { shapeAdjustments: { adj: adjustment } }),
	} as PptxElement;
}

function plainRect(): PptxElement {
	return { ...roundRect(), id: 'r', shapeType: 'rect' } as PptxElement;
}

function mountOverlay(
	elements: PptxElement[],
	scale = 1,
	extra: { editing?: boolean } = {},
): HTMLElement {
	const target = document.createElement('div');
	document.body.append(target);
	const app = mount(SelectionOverlay, {
		target,
		props: {
			box: BOX,
			scale,
			snapLines: [],
			selectionCount: elements.length,
			interactivity: selectionInteractivity(elements),
			onhandlepointerdown: () => {},
			onrotatepointerdown: () => {},
			onadjustpointerdown: () => {},
			...extra,
		},
	});
	flushSync();
	cleanup = () => {
		void unmount(app);
		target.remove();
	};
	return target;
}

describe('selectionOverlay adjustment handle', () => {
	it('has no descriptor for a plain rect and one for a roundRect', () => {
		expect(getShapeAdjustmentHandleDescriptor(plainRect())).toBeNull();
		const descriptor = getShapeAdjustmentHandleDescriptor(roundRect());
		expect(descriptor).not.toBeNull();
		expect(descriptor?.key).toBe('adj');
	});

	it('renders the amber diamond for a roundRect selection', () => {
		const target = mountOverlay([roundRect()]);
		const handle = target.querySelector('[data-pptx-adjust-handle]');
		expect(handle).not.toBeNull();
		expect(handle?.getAttribute('aria-label')).toBe('Adjust shape');
	});

	it('renders no diamond for a plain rect', () => {
		const target = mountOverlay([plainRect()]);
		expect(target.querySelector('[data-pptx-adjust-handle]')).toBeNull();
	});

	it('renders no diamond for a multi-selection', () => {
		const target = mountOverlay([roundRect(), plainRect()]);
		expect(target.querySelector('[data-pptx-adjust-handle]')).toBeNull();
	});

	it('positions the diamond in screen px (element-local offset x scale)', () => {
		const descriptor = getShapeAdjustmentHandleDescriptor(roundRect());
		const target = mountOverlay([roundRect()], 2);
		const style = target.querySelector('[data-pptx-adjust-handle]')?.getAttribute('style') ?? '';
		expect(style).toContain(`left: ${(descriptor?.left ?? 0) * 2}px`);
	});
});

describe('selectionOverlay during inline text edit', () => {
	// PowerPoint keeps a text box's resize/rotate/adjustment handles visible
	// and draggable while you are actively typing inside it; the overlay
	// previously unmounted its entire selection box whenever `editing` was
	// true, hiding them for the very element being edited.
	it('still draws the resize handles and rotate knob while editing', () => {
		const target = mountOverlay([plainRect()], 1, { editing: true });
		expect(target.querySelectorAll('[data-handle]')).toHaveLength(8);
		expect(target.querySelector('.pptx-svelte-rotate-knob')).not.toBeNull();
	});

	it('still draws the shape-adjustment diamond while editing', () => {
		const target = mountOverlay([roundRect()], 1, { editing: true });
		expect(target.querySelector('[data-pptx-adjust-handle]')).not.toBeNull();
	});
});

describe('selectionOverlay lock-driven chrome', () => {
	it('draws all eight resize handles and the rotate knob when unlocked', () => {
		const target = mountOverlay([plainRect()]);
		expect(target.querySelectorAll('[data-handle]')).toHaveLength(8);
		expect(target.querySelector('.pptx-svelte-rotate-knob')).not.toBeNull();
	});

	it('hides the resize handles for a noResize selection', () => {
		const target = mountOverlay([{ ...plainRect(), locks: { noResize: true } } as PptxElement]);
		expect(target.querySelectorAll('[data-handle]')).toHaveLength(0);
		// noResize gates one gesture only: the rotate knob stays.
		expect(target.querySelector('.pptx-svelte-rotate-knob')).not.toBeNull();
	});

	it('hides the rotate stem and knob for a noRotation selection', () => {
		const target = mountOverlay([{ ...plainRect(), locks: { noRotation: true } } as PptxElement]);
		expect(target.querySelector('.pptx-svelte-rotate-knob')).toBeNull();
		expect(target.querySelector('.pptx-svelte-rotate-stem')).toBeNull();
		expect(target.querySelectorAll('[data-handle]')).toHaveLength(8);
	});
});
