// @vitest-environment happy-dom
/**
 * G19 regression: `trimEndMs` is `p14:trim/@end`'s distance from the clip's
 * tail (COM-verified), not an absolute stop time. The scrubber used to print
 * and re-emit it as an absolute position, so a 20s clip trimmed 5s off its
 * tail labelled the end "0:05.0" and, on drag, wrote the absolute end back as
 * if it were the tail distance.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TrimTimeline } from './TrimTimeline';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function render(trimEndMs: number, onTrimChange = vi.fn()): ReturnType<typeof vi.fn> {
	act(() => {
		root.render(
			<TrimTimeline
				duration={20}
				trimStartMs={0}
				trimEndMs={trimEndMs}
				currentTime={0}
				bookmarks={[]}
				canEdit
				onTrimChange={onTrimChange}
				onSeek={vi.fn()}
			/>,
		);
	});
	return onTrimChange;
}

describe('trimTimeline', () => {
	it('labels the end as duration minus the tail trim', () => {
		render(5000);
		const labels = container.querySelectorAll('span');
		expect(labels[1]?.textContent).toBe('0:15.0');
	});

	it('labels an untrimmed end with the full duration', () => {
		render(0);
		expect(container.querySelectorAll('span')[1]?.textContent).toBe('0:20.0');
	});

	it('emits a dragged end handle as a distance from the tail', () => {
		const onTrimChange = render(0);
		const bar = container.querySelector<HTMLElement>('.relative.h-5')!;
		bar.getBoundingClientRect = () =>
			({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20 }) as DOMRect;
		const handles = container.querySelectorAll<HTMLElement>('.cursor-ew-resize');
		act(() => {
			handles[1]!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		});
		act(() => {
			// 75% along the bar = 15s into a 20s clip -> 5000ms off the tail.
			window.dispatchEvent(new PointerEvent('pointermove', { clientX: 150 }));
		});
		expect(onTrimChange).toHaveBeenCalledWith(0, 5000);
	});
});
