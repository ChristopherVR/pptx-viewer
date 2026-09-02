import type { SnapLine } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OverlayBox } from '../editor/types';
import SelectionOverlay from './SelectionOverlay.svelte';

/**
 * SelectionOverlay tests: renders the box, its 8 resize handles + rotate knob
 * (positioned by the stage scale), hides the chrome while inline editing, and
 * forwards handle/rotate pointerdown events. Named `.svelte.test.ts` so the
 * module body can wrap props in `$state` for reactive updates after mount.
 */

let cleanup: (() => void) | undefined;

interface Props {
	box: OverlayBox | null;
	scale: number;
	snapLines: readonly SnapLine[];
	editing: boolean;
	onhandlepointerdown: (handle: string, event: PointerEvent) => void;
	onrotatepointerdown: (event: PointerEvent) => void;
}

function mountOverlay(over: Partial<Props> = {}): { target: HTMLElement; props: Props } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state<Props>({
		box: { x: 10, y: 20, width: 100, height: 50, rotation: 0 },
		scale: 2,
		snapLines: [],
		editing: false,
		onhandlepointerdown: vi.fn(),
		onrotatepointerdown: vi.fn(),
		...over,
	});
	const instance = mount(SelectionOverlay, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, props };
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

describe('selectionOverlay', () => {
	it('renders 8 resize handles and a rotate knob positioned by scale', () => {
		const { target } = mountOverlay();
		expect(target.querySelectorAll('.pptx-svelte-sel-handle')).toHaveLength(8);
		expect(target.querySelector('.pptx-svelte-rotate-knob')).toBeTruthy();
		const box = target.querySelector<HTMLElement>('.pptx-svelte-sel-box');
		// box geometry multiplied by the stage scale (2).
		expect(box?.style.left).toBe('20px');
		expect(box?.style.width).toBe('200px');
	});

	it('still draws the box + handles while inline editing', () => {
		// PowerPoint keeps a text box's resize/rotate handles visible and
		// draggable while you are actively typing inside it. See the more
		// thorough coverage in `SelectionOverlay.svelte.test.ts`.
		const { target } = mountOverlay({ editing: true });
		expect(target.querySelector('.pptx-svelte-sel-box')).not.toBeNull();
	});

	it('renders nothing selectable when box is null', () => {
		const { target } = mountOverlay({ box: null });
		expect(target.querySelector('.pptx-svelte-sel-box')).toBeNull();
	});

	it('forwards handle and rotate pointerdown events', () => {
		const { target, props } = mountOverlay();
		target
			.querySelector<HTMLElement>('.pptx-svelte-sel-handle[data-handle="se"]')
			?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		target
			.querySelector<HTMLElement>('.pptx-svelte-rotate-knob')
			?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		expect(props.onhandlepointerdown).toHaveBeenCalledWith('se', expect.any(PointerEvent));
		expect(props.onrotatepointerdown).toHaveBeenCalledWith(expect.any(PointerEvent));
	});

	it('renders vertical/horizontal snap lines scaled to screen px', () => {
		const { target } = mountOverlay({
			snapLines: [
				{ axis: 'v', position: 30 },
				{ axis: 'h', position: 40 },
			] as SnapLine[],
		});
		const vertical = target.querySelector<HTMLElement>('.pptx-svelte-snap-v');
		const horizontal = target.querySelector<HTMLElement>('.pptx-svelte-snap-h');
		expect(vertical?.style.left).toBe('60px'); // 30 * scale(2)
		expect(horizontal?.style.top).toBe('80px'); // 40 * scale(2)
	});

	it('uses one collective box without a rotate handle for multi-selection', () => {
		const { target } = mountOverlay({ selectionCount: 3 } as Partial<Props>);
		expect(target.querySelectorAll('.pptx-svelte-sel-handle')).toHaveLength(8);
		expect(target.querySelector('.pptx-svelte-rotate-knob')).toBeNull();
	});

	it('renders an in-progress marquee in screen coordinates', () => {
		const { target } = mountOverlay({
			marquee: { startX: 40, startY: 30, currentX: 10, currentY: 5, additive: false },
		} as Partial<Props>);
		const marquee = target.querySelector<HTMLElement>('.pptx-svelte-marquee');
		expect(marquee?.style.left).toBe('20px');
		expect(marquee?.style.width).toBe('60px');
	});
});
