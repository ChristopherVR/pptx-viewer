// @vitest-environment happy-dom
/**
 * B1 (wave-4): entering the show must land on a slide the SHOW includes.
 * `presentationEntrySlideIndex` (shared) is already exhaustively tested; this
 * pins the WIRING - that `usePresentationMode`'s mode-entry effect actually
 * calls it instead of trusting the raw active slide, the regression that
 * broke a deck authored with `p:showPr/p:sldRg st="2" end="3"`.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import type { ViewerMode } from '../types-core';
import { usePresentationMode } from './usePresentationMode';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function deck(count: number): PptxSlide[] {
	return Array.from(
		{ length: count },
		(_, i) => ({ id: `s${i + 1}`, rId: `rId${i + 1}`, elements: [] }) as PptxSlide,
	);
}

const activeSlideMoves: number[] = [];

function Harness({ mode }: { mode: ViewerMode }): React.ReactElement {
	const containerRef = useRef<HTMLDivElement | null>(null);
	// A deck authored to open into slides 2-3 (0-based indexes 1, 2); the
	// active slide (0) is the title slide, which the show does not include.
	const presentation = usePresentationMode({
		mode,
		slides: deck(3),
		visibleSlideIndexes: [1, 2],
		activeSlideIndex: 0,
		containerRef,
		onSetMode: () => {},
		onSetActiveSlideIndex: (index) => {
			activeSlideMoves.push(index);
		},
	});
	return (
		<div ref={containerRef} data-testid='presentation-slide-index'>
			{presentation.presentationSlideIndex}
		</div>
	);
}

describe('usePresentationMode entry slide (wave-4 B1)', () => {
	it("opens on the range's first slide when the active slide is outside the show", () => {
		act(() => {
			root.render(<Harness mode='edit' />);
		});
		act(() => {
			root.render(<Harness mode='present' />);
		});
		expect(container.querySelector('[data-testid="presentation-slide-index"]')?.textContent).toBe(
			'1',
		);
		// The stage paints the active slide, so entering has to move it too.
		expect(activeSlideMoves).toStrictEqual([1]);
	});

	it('stays on the active slide when the show already includes it', () => {
		function InRangeHarness({ mode }: { mode: ViewerMode }): React.ReactElement {
			const containerRef = useRef<HTMLDivElement | null>(null);
			const presentation = usePresentationMode({
				mode,
				slides: deck(3),
				visibleSlideIndexes: [1, 2],
				activeSlideIndex: 1,
				containerRef,
				onSetMode: () => {},
				onSetActiveSlideIndex: () => {},
			});
			return (
				<div ref={containerRef} data-testid='presentation-slide-index'>
					{presentation.presentationSlideIndex}
				</div>
			);
		}
		act(() => {
			root.render(<InRangeHarness mode='edit' />);
		});
		act(() => {
			root.render(<InRangeHarness mode='present' />);
		});
		expect(container.querySelector('[data-testid="presentation-slide-index"]')?.textContent).toBe(
			'1',
		);
	});
});
