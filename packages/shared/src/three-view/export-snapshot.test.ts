// @vitest-environment jsdom
/**
 * Unit tests for export-snapshot.ts: waiting for `<pptx-three-view>` elements
 * to settle before capture, and swapping a cloned view for an `<img>` of its
 * live pixels. Views are faked as plain `<div>`s carrying the marker
 * attribute and the same `state`/`canvas`/`flush` surface the real element
 * exposes, since the real custom element is not registered in this test.
 */
import { describe, expect, it, vi } from 'vitest';

import { THREE_VIEW_MARKER_ATTR } from './element';
import type { PptxThreeViewElement } from './element';
import {
	settleThreeViews,
	snapshotThreeViewsIntoClone,
	THREE_VIEW_SNAPSHOT_ATTR,
} from './export-snapshot';
import type { ThreeViewSpec, ThreeViewState } from './types';

interface MutableFakeView {
	state: ThreeViewState;
	spec: ThreeViewSpec | null;
	canvas: HTMLCanvasElement | null;
	flush: () => void;
}

function fakeView(state: ThreeViewState, withCanvas = state === 'ready'): PptxThreeViewElement {
	const el = document.createElement('div');
	el.setAttribute(THREE_VIEW_MARKER_ATTR, '');
	const mutable = el as unknown as MutableFakeView;
	mutable.state = state;
	mutable.spec =
		state === 'idle' ? null : ({ kind: 'chart', spec: {} } as unknown as ThreeViewSpec);
	mutable.flush = () => {};
	vi.spyOn(mutable, 'flush');
	mutable.canvas = null;
	if (withCanvas) {
		const canvas = document.createElement('canvas');
		canvas.width = 10;
		canvas.height = 10;
		(canvas as unknown as { toDataURL: () => string }).toDataURL = () =>
			'data:image/png;base64,fake';
		mutable.canvas = canvas;
	}
	return el as unknown as PptxThreeViewElement;
}

describe('settleThreeViews', () => {
	it('resolves immediately when there are no views under root', async () => {
		const container = document.createElement('div');
		await expect(settleThreeViews(container, 50)).resolves.toBeUndefined();
	});

	it('resolves immediately when every view is already settled, and flushes ready ones', async () => {
		const container = document.createElement('div');
		const ready = fakeView('ready');
		const unavailable = fakeView('unavailable', false);
		container.append(ready, unavailable);
		await settleThreeViews(container, 50);
		expect((ready as unknown as MutableFakeView).flush).toHaveBeenCalledWith();
		expect((unavailable as unknown as MutableFakeView).flush).not.toHaveBeenCalled();
	});

	it('waits for a loading view to raise pptx-three-state before resolving', async () => {
		const container = document.createElement('div');
		const view = fakeView('loading', false);
		container.append(view);
		const settled = settleThreeViews(container, 5000);
		let resolved = false;
		void settled.then(() => (resolved = true));
		await Promise.resolve();
		expect(resolved).toBeFalsy();
		(view as unknown as MutableFakeView).state = 'ready';
		view.dispatchEvent(new CustomEvent('pptx-three-state', { detail: { state: 'ready' } }));
		await settled;
		expect(resolved).toBeTruthy();
	});

	it('resolves after the timeout even when a view never settles', async () => {
		vi.useFakeTimers();
		try {
			const container = document.createElement('div');
			container.append(fakeView('loading', false));
			const settled = settleThreeViews(container, 100);
			let resolved = false;
			void settled.then(() => (resolved = true));
			await vi.advanceTimersByTimeAsync(100);
			expect(resolved).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('snapshotThreeViewsIntoClone', () => {
	it('replaces a ready view in the clone with an <img> of its live pixels', () => {
		const original = document.createElement('div');
		original.append(fakeView('ready'));
		const clone = original.cloneNode(true) as HTMLElement;

		snapshotThreeViewsIntoClone(original, clone);

		const clonedView = clone.querySelector(`[${THREE_VIEW_MARKER_ATTR}]`);
		const img = clonedView?.querySelector<HTMLImageElement>(`img[${THREE_VIEW_SNAPSHOT_ATTR}]`);
		expect(img).not.toBeNull();
		expect(img?.getAttribute('src')).toBe('data:image/png;base64,fake');
	});

	it('leaves a non-ready view untouched (its 2D fallback stays)', () => {
		const original = document.createElement('div');
		const view = fakeView('unavailable', false);
		const fallback = document.createElement('span');
		fallback.className = 'fallback-content';
		view.append(fallback);
		original.append(view);
		const clone = original.cloneNode(true) as HTMLElement;

		snapshotThreeViewsIntoClone(original, clone);

		const clonedView = clone.querySelector(`[${THREE_VIEW_MARKER_ATTR}]`);
		expect(clonedView?.querySelector(`img[${THREE_VIEW_SNAPSHOT_ATTR}]`)).toBeNull();
		expect(clonedView?.querySelector('.fallback-content')).not.toBeNull();
	});

	it('does nothing when root has no three-view elements', () => {
		const original = document.createElement('div');
		original.innerHTML = '<p>no views here</p>';
		const clone = original.cloneNode(true) as HTMLElement;
		expect(() => snapshotThreeViewsIntoClone(original, clone)).not.toThrow();
		expect(clone.innerHTML).toBe(original.innerHTML);
	});
});
