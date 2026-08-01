// @vitest-environment happy-dom
/**
 * Two rules the rail keeps getting wrong when it is ported.
 *
 * Next must stay live on the last slide: PowerPoint's console advances from
 * there to the end-of-show screen and then out of the show, and three bindings
 * independently added `disabled={current >= slides.length - 1}`, stranding the
 * presenter on the final slide with the audience display still open. The rule
 * now lives in shared (`presenterNextDisabled`) and is asserted here.
 *
 * The next-slide preview must skip HIDDEN slides, because the show itself
 * skips them: a preview of a slide the deck will never present is worse than no
 * preview at all. That is `nextPresentedSlide`, and this pins that the rail
 * still routes through it.
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

// The preview renders a whole slide through ResizeObserver-driven scaling; the
// rail's contract is only WHICH slide it hands over, so stand in for it.
vi.mock(import('./ScaledSlidePreview'), () => ({
	ScaledSlidePreview: (props: { slide: PptxSlide }) => <div data-preview-slide={props.slide.id} />,
}));

const { PresenterNotesRail } = await import('./PresenterNotesRail');

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

function slide(id: string, hidden = false): PptxSlide {
	return { id, slideNumber: 1, elements: [], hidden } as unknown as PptxSlide;
}

function renderRail(slides: PptxSlide[], current: number): void {
	act(() => {
		root.render(
			<PresenterNotesRail
				slides={slides}
				current={current}
				canvasSize={{ width: 960, height: 540 }}
				templateElements={[]}
				now={0}
				elapsed={0}
				onMove={() => undefined}
			/>,
		);
	});
}

function navButton(id: string): HTMLButtonElement | null {
	return container.querySelector<HTMLButtonElement>(`[data-pptx-presenter-control="${id}"]`);
}

function previewedSlideId(): string | null {
	return (
		container.querySelector('[data-preview-slide]')?.getAttribute('data-preview-slide') ?? null
	);
}

describe('the presenter notes rail', () => {
	it('disables Previous only on the first slide', () => {
		renderRail([slide('a'), slide('b')], 0);
		expect(navButton('prev')?.disabled).toBeTruthy();

		renderRail([slide('a'), slide('b')], 1);
		const prev = navButton('prev');
		expect(prev).not.toBeNull();
		expect(prev?.disabled).toBeFalsy();
	});

	it('never disables Next, including on the last slide', () => {
		renderRail([slide('a'), slide('b')], 1);
		const next = navButton('next');
		expect(next).not.toBeNull();
		expect(next?.disabled).toBeFalsy();
	});

	it('previews the next slide the show will actually present', () => {
		renderRail([slide('a'), slide('b'), slide('c')], 0);
		expect(previewedSlideId()).toBe('b');
	});

	it('skips a hidden slide in the next-slide preview', () => {
		renderRail([slide('a'), slide('b', true), slide('c')], 0);
		expect(previewedSlideId()).toBe('c');
	});

	it('says the presentation ends when every later slide is hidden', () => {
		renderRail([slide('a'), slide('b', true)], 0);
		expect(previewedSlideId()).toBeNull();
		expect(container.textContent).toContain(translationsEn['pptx.presenter.endOfPresentation']);
	});
});
