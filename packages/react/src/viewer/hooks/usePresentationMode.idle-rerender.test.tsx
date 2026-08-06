// @vitest-environment happy-dom
/**
 * Issue #145: the presenter console's 1 s clock must not tick while the viewer
 * is merely being EDITED.
 *
 * It used to run unconditionally from mount, and every tick pushed a brand-new
 * snapshot object (`mergePresentationSnapshot` always allocates and always bumps
 * `sequence`, so React can never bail out). Since `usePresentationMode` is
 * mounted by the root viewer for the whole session, and that root hands every
 * child a fresh un-memoised props object, one tick re-rendered the entire editor
 * tree - once a second, forever.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { usePresentationMode } from './usePresentationMode';
import type { UsePresentationModeResult } from './usePresentationMode';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	vi.spyOn(document, 'hasFocus').mockReturnValue(true);
	vi.useFakeTimers();
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	vi.useRealTimers();
});

function deck(): PptxSlide[] {
	return [{ id: 's1', rId: 'rId1', elements: [] } as PptxSlide];
}

function Harness({
	mode,
	onRender,
	onResult,
}: {
	mode: 'edit' | 'present';
	onRender?: () => void;
	onResult?: (result: UsePresentationModeResult) => void;
}): React.ReactElement {
	const containerRef = useRef<HTMLDivElement | null>(null);
	onRender?.();
	const result = usePresentationMode({
		mode,
		slides: deck(),
		visibleSlideIndexes: [0],
		activeSlideIndex: 0,
		containerRef,
		onSetMode: () => {},
		onSetActiveSlideIndex: () => {},
	});
	onResult?.(result);
	return <div ref={containerRef} />;
}

/**
 * Ticks a second at a time. Collapsing the whole span into one `act` would
 * batch every commit into a single render and understate the real cost.
 */
function tickSeconds(count: number): void {
	for (let second = 0; second < count; second += 1) {
		act(() => {
			vi.advanceTimersByTime(1000);
		});
	}
}

describe('presenter-console clock gating (issue #145)', () => {
	it('does not re-render on a timer while editing', () => {
		const onRender = vi.fn();
		act(() => {
			root.render(<Harness mode='edit' onRender={onRender} />);
		});
		const afterMount = onRender.mock.calls.length;

		tickSeconds(10);

		expect(onRender.mock.calls.length - afterMount).toBe(0);
	});

	it('still ticks the console clock during a show', () => {
		let latest: UsePresentationModeResult | null = null;
		act(() => {
			root.render(
				<Harness
					mode='present'
					onResult={(result) => {
						latest = result;
					}}
				/>,
			);
		});

		tickSeconds(3);

		expect(latest?.presenterSnapshot.elapsedMs).toBeGreaterThanOrEqual(3000);
	});

	it('re-bases the elapsed clock when the show starts, not at mount', () => {
		let latest: UsePresentationModeResult | null = null;
		const onResult = (result: UsePresentationModeResult) => {
			latest = result;
		};
		act(() => {
			root.render(<Harness mode='edit' onResult={onResult} />);
		});

		// Half an hour of ordinary editing before presenting.
		act(() => {
			vi.advanceTimersByTime(30 * 60 * 1000);
		});
		act(() => {
			root.render(<Harness mode='present' onResult={onResult} />);
		});

		// The console opens at 00:00 rather than inheriting the editing session.
		expect(latest?.presenterSnapshot.elapsedMs).toBe(0);

		tickSeconds(2);
		expect(latest?.presenterSnapshot.elapsedMs).toBeLessThan(30 * 60 * 1000);
	});
});
