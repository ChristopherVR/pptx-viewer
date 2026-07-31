// @vitest-environment happy-dom
/**
 * The hidden-slide cue in the React rail and slide sorter.
 *
 * Both keep LISTING a hidden slide on purpose (hiding only removes it from the
 * show), and both already dimmed it and drew an eye-off glyph. What was missing
 * is a signal that is not colour (dimming reads the same as a dark thumbnail)
 * and one assistive tech can hear. These pin both, and pin that the accessible
 * NAME is untouched: `e2e/support/deck.ts` matches `^Go to slide N$` exactly, so
 * folding the state into the label would break the whole suite.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { HIDDEN_SLIDE_SLASH_GRADIENT } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlideCard } from './slide-sorter/SlideCard';
import { SlideItem } from './slides-pane/SlideItem';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => translationsEn[key] ?? key }),
}));

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

const canvasSize = { width: 960, height: 540 };

function slide(hidden: boolean): PptxSlide {
	return { id: 's2', rId: 'rId2', slideNumber: 2, elements: [], hidden } as PptxSlide;
}

function renderRailItem(hidden: boolean): void {
	act(() => {
		root.render(
			<SlideItem
				slide={slide(hidden)}
				templateElements={[]}
				slideIndex={1}
				isActive={false}
				canvasSize={canvasSize}
				canEdit={false}
				onSelectSlide={vi.fn()}
				onSlideContextMenu={vi.fn()}
				onOpenSlideCtxMenu={vi.fn()}
				onDragStart={vi.fn()}
				onDragOver={vi.fn()}
				onDrop={vi.fn()}
				slideRef={vi.fn()}
			/>,
		);
	});
}

function renderSorterCard(hidden: boolean): void {
	act(() => {
		root.render(
			<SlideCard
				slide={slide(hidden)}
				index={1}
				isActive={false}
				isDragTarget={false}
				isSelected={false}
				selectedCount={0}
				selectionOrder={0}
				canvasSize={canvasSize}
				canEdit={false}
				onSlideClick={vi.fn()}
				onDoubleClick={vi.fn()}
				onContextMenu={vi.fn()}
				onDragStart={vi.fn()}
				onDragOver={vi.fn()}
				onDragLeave={vi.fn()}
				onDrop={vi.fn()}
			/>,
		);
	});
}

describe('slideItem hidden-slide cue', () => {
	it('marks the hidden slide with the neutral attribute', () => {
		renderRailItem(true);
		expect(container.querySelector('[data-pptx-slide-hidden="true"]')).not.toBeNull();
	});

	it('slashes the slide number, so the cue is not carried by dimming alone', () => {
		renderRailItem(true);
		const number = container.querySelector<HTMLElement>('span.tabular-nums');
		expect(number?.style.backgroundImage).toBe(HIDDEN_SLIDE_SLASH_GRADIENT);
	});

	it('describes the state without changing the accessible name', () => {
		renderRailItem(true);
		const button = container.querySelector<HTMLButtonElement>('button')!;
		expect(button.getAttribute('aria-label')).toBe('Go to slide 2');
		const describedBy = button.getAttribute('aria-describedby');
		expect(describedBy).toBe('pptx-hidden-slide-rail-1');
		expect(container.querySelector(`#${describedBy}`)?.textContent).toContain('Hidden');
	});

	it('leaves a visible slide unmarked and undescribed', () => {
		renderRailItem(false);
		const button = container.querySelector<HTMLButtonElement>('button')!;
		expect(button.getAttribute('data-pptx-slide-hidden')).toBeNull();
		expect(button.getAttribute('aria-describedby')).toBeNull();
	});
});

describe('slideCard hidden-slide cue', () => {
	it('marks, slashes and spells out the hidden state', () => {
		renderSorterCard(true);
		const card = container.querySelector<HTMLElement>('[data-pptx-slide-hidden="true"]');
		expect(card).not.toBeNull();
		expect(card?.getAttribute('aria-describedby')).toBe('pptx-hidden-slide-sorter-1');
		expect(container.querySelector('#pptx-hidden-slide-sorter-1')?.textContent).toContain('Hidden');
	});

	it('uses a different description id from the rail, so both can be mounted', () => {
		renderSorterCard(true);
		expect(container.querySelector('#pptx-hidden-slide-rail-1')).toBeNull();
	});

	it('leaves a visible card unmarked', () => {
		renderSorterCard(false);
		expect(container.querySelector('[data-pptx-slide-hidden]')).toBeNull();
	});
});
