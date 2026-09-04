import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MediaTrimTimeline from './MediaTrimTimeline.svelte';

/**
 * G19 regression: `endMs` is `p14:trim/@end`'s distance from the clip's tail
 * (COM-verified), not an absolute stop time. The scrubber used to read it as
 * an absolute position, so a 20s clip trimmed 5s off its tail drew the end
 * handle at 5s and re-emitted 5000 as the absolute end on drag.
 */
describe('mediaTrimTimeline (svelte)', () => {
	let host: HTMLDivElement | undefined;
	let instance: ReturnType<typeof mount> | undefined;

	afterEach(() => {
		if (instance) {
			unmount(instance);
			instance = undefined;
		}
		host?.remove();
		host = undefined;
	});

	function mountTimeline(props: { endMs?: number; startMs?: number }) {
		host = document.createElement('div');
		document.body.appendChild(host);
		const onchange = vi.fn();
		instance = mount(MediaTrimTimeline, {
			target: host,
			props: {
				duration: 20,
				startMs: props.startMs ?? 0,
				endMs: props.endMs,
				currentTime: 0,
				bookmarks: [],
				onchange,
				onseek: vi.fn(),
			},
		});
		flushSync();
		return { onchange };
	}

	it('labels and places the end handle at duration minus the tail trim', () => {
		mountTimeline({ endMs: 5000 });
		const labels = host!.querySelectorAll('.times span');
		expect(labels[1]?.textContent).toBe('15.0s');
		const endHandle = host!.querySelector<HTMLElement>('.handle.end');
		expect(endHandle?.style.left).toBe('75%');
	});

	it('treats a missing endMs as "play to the end"', () => {
		mountTimeline({});
		expect(host!.querySelectorAll('.times span')[1]?.textContent).toBe('20.0s');
		expect(host!.querySelector<HTMLElement>('.handle.end')?.style.left).toBe('100%');
	});

	it('emits the dragged end as a distance from the tail', () => {
		const { onchange } = mountTimeline({ startMs: 0, endMs: 0 });
		const bar = host!.querySelector<HTMLElement>('.timeline')!;
		bar.getBoundingClientRect = () =>
			({ left: 0, width: 200, top: 0, height: 22, right: 200, bottom: 22 }) as DOMRect;
		const endHandle = host!.querySelector<HTMLElement>('.handle.end')!;
		endHandle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		flushSync();
		// Pointer at 75% of the bar = 15s into a 20s clip -> 5000ms off the tail.
		window.dispatchEvent(new PointerEvent('pointermove', { clientX: 150 }));
		flushSync();
		expect(onchange).toHaveBeenCalledWith(0, 5000);
	});
});
