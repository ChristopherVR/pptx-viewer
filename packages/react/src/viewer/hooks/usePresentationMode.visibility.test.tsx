// @vitest-environment happy-dom
/**
 * Issue #132: a hidden tab must pause the running show. The auto-advance timer
 * is cancelled while `document.hidden` (a deck must not run on unseen) and is
 * re-armed for the CURRENT slide when the tab becomes visible again.
 */
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { usePresentationMode } from './usePresentationMode';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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
	setDocumentVisibility('visible');
	vi.useRealTimers();
});

function setDocumentVisibility(state: 'visible' | 'hidden'): void {
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => state,
	});
	document.dispatchEvent(new Event('visibilitychange'));
}

/** Two-slide deck; slide 0 auto-advances after 1 s (`p:transition/@advTm`). */
function autoAdvancingDeck(): PptxSlide[] {
	return [
		{
			id: 's1',
			rId: 'rId1',
			elements: [],
			transition: { advanceAfterMs: 1000 } as PptxSlideTransition,
		} as PptxSlide,
		{ id: 's2', rId: 'rId2', elements: [] } as PptxSlide,
	];
}

function Harness({
	onSetActiveSlideIndex,
}: {
	onSetActiveSlideIndex: (index: number) => void;
}): React.ReactElement {
	const containerRef = useRef<HTMLDivElement | null>(null);
	usePresentationMode({
		mode: 'present',
		slides: autoAdvancingDeck(),
		visibleSlideIndexes: [0, 1],
		activeSlideIndex: 0,
		containerRef,
		onSetMode: () => {},
		onSetActiveSlideIndex,
	});
	return <div ref={containerRef} />;
}

describe('usePresentationMode visibility pause', () => {
	it('auto-advances normally while the tab stays visible (baseline)', () => {
		const onSetActiveSlideIndex = vi.fn();
		act(() => {
			root.render(<Harness onSetActiveSlideIndex={onSetActiveSlideIndex} />);
		});

		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(onSetActiveSlideIndex).toHaveBeenCalledWith(1);
	});

	it('cancels the auto-advance timer while hidden and re-arms it on visible', () => {
		const onSetActiveSlideIndex = vi.fn();
		act(() => {
			root.render(<Harness onSetActiveSlideIndex={onSetActiveSlideIndex} />);
		});

		// Hide before the 1 s advance fires: the pending timer must be cancelled.
		act(() => {
			setDocumentVisibility('hidden');
		});
		act(() => {
			vi.advanceTimersByTime(5000);
		});
		expect(onSetActiveSlideIndex).not.toHaveBeenCalled();

		// Back to visible: auto-advance re-arms for the current slide (index 0),
		// so the show moves on after that slide's full 1 s delay.
		act(() => {
			setDocumentVisibility('visible');
		});
		act(() => {
			vi.advanceTimersByTime(999);
		});
		expect(onSetActiveSlideIndex).not.toHaveBeenCalled();
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(onSetActiveSlideIndex).toHaveBeenCalledWith(1);
	});
});
