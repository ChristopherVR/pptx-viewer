// @vitest-environment happy-dom
/**
 * The phone console obeys the DESKTOP console's navigation rules.
 *
 * `PresenterNotesRail.test.tsx` pins those rules for the split-screen console:
 * Previous is dead only on the first slide, and Next is never dead, because
 * PowerPoint advances from the last slide to the end-of-show screen and then
 * out of the show. This layout was written against a near-duplicate helper
 * (`isLastSlide`) and disabled Next on the last slide, so the same deck
 * stranded a presenter on a phone and let them finish on a laptop.
 *
 * Both controls also carry `data-pptx-presenter-control`, the neutral contract
 * `e2e/presenter-view-parity.spec.ts` measures every binding through: without
 * it the phone console is invisible to the parity suite, which is how the
 * divergence survived a whole parity pass.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

// The panes render whole slides through ResizeObserver-driven scaling; this
// layout's contract is the controls, so stand the preview in.
vi.mock(import('./ScaledSlidePreview'), () => ({
	ScaledSlidePreview: (props: { slide: PptxSlide }) => <div data-preview-slide={props.slide.id} />,
}));

const { MobilePresenterView } = await import('./MobilePresenterView');

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

function slide(id: string): PptxSlide {
	return { id, slideNumber: 1, elements: [] } as unknown as PptxSlide;
}

function renderConsole(slides: PptxSlide[], current: number): void {
	act(() => {
		root.render(
			<MobilePresenterView
				slides={slides}
				currentSlideIndex={current}
				canvasSize={{ width: 960, height: 540 }}
				templateElements={[]}
				presentationStartTime={null}
				onMovePresentationSlide={() => undefined}
				onExit={() => undefined}
			/>,
		);
	});
}

function navButton(id: string): HTMLButtonElement | null {
	return container.querySelector<HTMLButtonElement>(`[data-pptx-presenter-control="${id}"]`);
}

describe('the phone presenter console', () => {
	it('disables Previous only on the first slide', () => {
		renderConsole([slide('a'), slide('b')], 0);
		expect(navButton('prev')?.disabled).toBeTruthy();

		renderConsole([slide('a'), slide('b')], 1);
		expect(navButton('prev')?.disabled).toBeFalsy();
	});

	it('never disables Next, including on the last slide', () => {
		renderConsole([slide('a'), slide('b')], 1);
		const next = navButton('next');
		expect(next).not.toBeNull();
		expect(next?.disabled).toBeFalsy();
	});

	it('never disables Next on a one-slide deck either', () => {
		// The predicate that was wrong, `isLastSlide(0, 1)`, is true here.
		renderConsole([slide('a')], 0);
		expect(navButton('next')?.disabled).toBeFalsy();
	});
});
