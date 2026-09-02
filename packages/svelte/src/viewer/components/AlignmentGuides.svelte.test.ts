/**
 * Draggable/deletable alignment guides (wave 4 #11).
 *
 * Svelte's guide overlay identified guides by array INDEX and had no delete
 * at all: a drag retargeted the wrong guide the moment the array was
 * reordered or a guide removed, and there was no way to remove one short of
 * clearing all of them. This pins the id-addressed move/delete wiring against
 * shared's `Guide` shape, mirroring Vue's `CanvasGuides.vue` interaction
 * (pointer-drag + double-click delete) plus a keyboard Delete/Backspace path.
 */
import type { Guide } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AlignmentGuides from './AlignmentGuides.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountGuides(
	guides: readonly Guide[],
	onchange: (id: string, position: number) => void,
	ondelete?: (id: string) => void,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(AlignmentGuides, {
		target,
		props: { guides, scale: 1, onchange, ondelete },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('alignmentGuides', () => {
	it('renders one button per guide, addressed by id', () => {
		const guides: Guide[] = [
			{ id: 'g1', axis: 'h', position: 100 },
			{ id: 'g2', axis: 'v', position: 200 },
		];
		const target = mountGuides(guides, vi.fn());

		const buttons = target.querySelectorAll('[data-testid="pptx-alignment-guide"]');
		expect(buttons).toHaveLength(2);
		expect(buttons[0]?.getAttribute('data-guide-id')).toBe('g1');
		expect(buttons[1]?.getAttribute('data-guide-id')).toBe('g2');
	});

	it('double-click removes the guide by its id, not its index', () => {
		const guides: Guide[] = [
			{ id: 'g1', axis: 'h', position: 100 },
			{ id: 'g2', axis: 'v', position: 200 },
		];
		const ondelete = vi.fn();
		const target = mountGuides(guides, vi.fn(), ondelete);

		const second = target.querySelectorAll(
			'[data-testid="pptx-alignment-guide"]',
		)[1] as HTMLElement;
		second.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		expect(ondelete).toHaveBeenCalledWith('g2');
	});

	it('delete key on a focused guide removes it', () => {
		const guides: Guide[] = [{ id: 'g1', axis: 'v', position: 50 }];
		const ondelete = vi.fn();
		const target = mountGuides(guides, vi.fn(), ondelete);

		const button = target.querySelector('[data-testid="pptx-alignment-guide"]') as HTMLElement;
		button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

		expect(ondelete).toHaveBeenCalledWith('g1');
	});

	it('dragging (pointerdown then pointermove) reports the moved id and axis-projected position', () => {
		const guides: Guide[] = [{ id: 'g1', axis: 'v', position: 50 }];
		const onchange = vi.fn();
		const target = mountGuides(guides, onchange);

		// `move()` reads the guides holder's PARENT rect (the scaled stage), which
		// in this mounted-standalone test is the mount target itself.
		vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			right: 500,
			bottom: 500,
			width: 500,
			height: 500,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		});
		const button = target.querySelector('[data-testid="pptx-alignment-guide"]') as HTMLElement;
		// happy-dom does not implement pointer capture; stub both methods so the
		// component's calls (unrelated to what this test asserts) do not throw.
		(button as unknown as { setPointerCapture: () => void }).setPointerCapture = () => undefined;
		(button as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () =>
			undefined;

		button.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, clientX: 120, clientY: 0, pointerId: 1 }),
		);
		button.dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, clientX: 120, clientY: 0, pointerId: 1 }),
		);

		expect(onchange).toHaveBeenCalledWith('g1', 120);
	});
});
