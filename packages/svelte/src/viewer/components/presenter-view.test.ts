/**
 * Presenter console regressions, all four of them shared-rule violations this
 * binding shipped before the console was rebuilt on `presenter-chrome`:
 *
 * - Next was disabled on the last slide (`current >= slides.length - 1`), which
 *   strands the presenter: PowerPoint's console advances from there to the
 *   end-of-show screen and then out of the show, so with Next dead the show
 *   could not be finished and the audience display never closed.
 * - Speaker notes rendered as `slide.notes` plain text, dropping every run style
 *   (`bold`, `italic`, colour, size) the deck authored in `notesSegments`.
 * - The notes font stepper used its own 12..36 bounds instead of the shared
 *   10..32, and labelled itself "A-" / "A+" with no accessible name at all.
 * - There was no timer progress bar.
 *
 * The next-slide preview is covered here too: it already used the shared
 * `nextPresentedSlide`, and this pins that down so a future "simplify" back to
 * `slides[current + 1]` fails rather than quietly previewing a hidden slide.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { AuthoredSlideRange } from 'pptx-viewer-shared';
import {
	createInitialPresentationSnapshot,
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
	PRESENTER_CONSOLE_ORDER,
	PRESENTER_TIMER_SEGMENT_MS,
} from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { translate } from '../../i18n/translator';
import PresenterView from './PresenterView.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function textSlide(index: number, text: string, overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: `slide-${index}`,
		rId: `rId${index}`,
		slideNumber: index,
		elements: [{ type: 'text', id: `t${index}`, x: 0, y: 0, width: 400, height: 80, text }],
		...overrides,
	} as PptxSlide;
}

interface MountOptions {
	current?: number;
	startedAt?: number;
	authoredRange?: AuthoredSlideRange | null;
}

function mountConsole(slides: PptxSlide[], options: MountOptions = {}) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const callbacks = {
		onmove: vi.fn(),
		onaudience: vi.fn(),
		onswap: vi.fn(),
		onexit: vi.fn(),
		onupdate: vi.fn(),
		onnavigate: vi.fn(),
	};
	const instance = mount(PresenterView, {
		target,
		props: {
			slides,
			current: options.current ?? 0,
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map<string, string>(),
			startedAt: options.startedAt ?? Date.now(),
			audienceOpen: false,
			authoredRange: options.authoredRange ?? null,
			snapshot: createInitialPresentationSnapshot(options.current ?? 0),
			...callbacks,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, ...callbacks };
}

function rail(target: HTMLElement, id: string): HTMLButtonElement {
	const el = target.querySelector<HTMLButtonElement>(`[data-pptx-presenter-control="${id}"]`);
	if (!el) {
		throw new Error(`missing rail control ${id}`);
	}
	return el;
}

describe('presenterView control attribute', () => {
	/**
	 * The strip and the rail share ONE attribute across all five bindings, so a
	 * framework-neutral spec can query a single selector. That only works while
	 * the strip stays queryable in isolation: without `[data-pptx-presenter-strip]`
	 * a document-wide sweep folds the rail's four controls into the strip's
	 * inventory and breaks its order.
	 */
	it('keeps the strip inventory intact when scoped, and exposes the rail ids too', () => {
		const { target } = mountConsole([textSlide(1, 'one'), textSlide(2, 'two')]);
		const stripRoot = target.querySelector<HTMLElement>('[data-pptx-presenter-strip]');
		const stripIds = [...(stripRoot?.querySelectorAll('[data-pptx-presenter-control]') ?? [])].map(
			(el) => el.getAttribute('data-pptx-presenter-control'),
		);

		expect(stripIds).toStrictEqual([...PRESENTER_CONSOLE_ORDER]);
		for (const id of ['prev', 'next', 'notes-font-decrease', 'notes-font-increase']) {
			expect(rail(target, id)).not.toBeNull();
			expect(stripIds).not.toContain(id);
		}
	});
});

describe('presenterView navigation', () => {
	it('never disables Next, not even on the last slide', () => {
		const slides = [textSlide(1, 'one'), textSlide(2, 'two')];
		const { target, onmove } = mountConsole(slides, { current: slides.length - 1 });

		expect(rail(target, 'next').disabled).toBeFalsy();
		rail(target, 'next').click();
		expect(onmove).toHaveBeenCalledExactlyOnceWith(1);
	});

	it('disables Previous only on the first slide', () => {
		const slides = [textSlide(1, 'one'), textSlide(2, 'two')];
		expect(rail(mountConsole(slides, { current: 0 }).target, 'prev').disabled).toBeTruthy();
		cleanup?.();
		cleanup = undefined;
		expect(rail(mountConsole(slides, { current: 1 }).target, 'prev').disabled).toBeFalsy();
	});

	it('labels navigation from the dictionary, using the shared short "Prev"', () => {
		const { target } = mountConsole([textSlide(1, 'one'), textSlide(2, 'two')]);
		expect(rail(target, 'prev').getAttribute('aria-label')).toBe(
			translate('en', 'pptx.presenter.prev'),
		);
		expect(rail(target, 'next').getAttribute('aria-label')).toBe(
			translate('en', 'pptx.presenter.next'),
		);
	});
});

describe('presenterView next-slide preview', () => {
	it('previews the slide the show will actually reach, skipping a hidden one', () => {
		const slides = [
			textSlide(1, 'first slide'),
			textSlide(2, 'hidden slide', { hidden: true }),
			textSlide(3, 'third slide'),
		];
		const { target } = mountConsole(slides, { current: 0 });
		const preview = target.querySelector<HTMLElement>('[data-pptx-presenter-next-preview]');

		expect(preview?.textContent).toContain('third slide');
		expect(preview?.textContent).not.toContain('hidden slide');
	});

	it('says the presentation ends when nothing follows', () => {
		const { target } = mountConsole([textSlide(1, 'only')], { current: 0 });
		expect(target.querySelector('[data-pptx-presenter-next-preview]')).toBeNull();
		expect(target.textContent).toContain(translate('en', 'pptx.presenter.endOfPresentation'));
	});

	/**
	 * Wave-4 B1: a deck authored to open into a `p:showPr/p:sldRg` range must
	 * preview only within that range, matching the running show. Before
	 * `authoredRange` reached `nextPresentedSlide`, the console previewed the
	 * next DECK slide even when the range excluded it.
	 */
	it('previews within the authored slide range, ending at its bound', () => {
		const slides = [
			textSlide(1, 'first slide'),
			textSlide(2, 'ranged slide'),
			textSlide(3, 'excluded slide'),
		];
		const range: AuthoredSlideRange = { fromIndex: 0, toIndex: 1 };
		const { target } = mountConsole(slides, { current: 0, authoredRange: range });
		const preview = target.querySelector<HTMLElement>('[data-pptx-presenter-next-preview]');
		expect(preview?.textContent).toContain('ranged slide');

		cleanup?.();
		cleanup = undefined;
		const atEnd = mountConsole(slides, { current: 1, authoredRange: range });
		expect(atEnd.target.querySelector('[data-pptx-presenter-next-preview]')).toBeNull();
	});
});

describe('presenterView speaker notes', () => {
	it('renders rich notes segments as styled runs, not flattened text', () => {
		const slide = textSlide(1, 'one', {
			notes: 'Bold bit plain bit',
			notesSegments: [
				{ text: 'Bold bit', style: { bold: true, color: '#ff0000', fontSize: 18 } },
				{ isParagraphBreak: true, text: '', style: {} },
				{ text: 'plain bit', style: { italic: true } },
			],
		} as Partial<PptxSlide>);
		const { target } = mountConsole([slide]);
		const notes = target.querySelector<HTMLElement>('[data-pptx-presenter-notes]');

		const bold = [...(notes?.querySelectorAll('span') ?? [])].find(
			(el) => el.textContent === 'Bold bit',
		);
		expect(bold?.getAttribute('style')).toContain('font-weight: bold');
		expect(bold?.getAttribute('style')).toContain('color: #ff0000');
		expect(bold?.getAttribute('style')).toContain('font-size: 18pt');

		const italic = [...(notes?.querySelectorAll('span') ?? [])].find(
			(el) => el.textContent === 'plain bit',
		);
		expect(italic?.getAttribute('style')).toContain('font-style: italic');
		expect(notes?.querySelector('br')).not.toBeNull();
	});

	it('falls back to plain notes, then to the placeholder', () => {
		const withNotes = mountConsole([
			textSlide(1, 'one', { notes: 'just text' } as Partial<PptxSlide>),
		]);
		expect(withNotes.target.querySelector('[data-pptx-presenter-notes]')?.textContent?.trim()).toBe(
			'just text',
		);
		cleanup?.();
		cleanup = undefined;

		const bare = mountConsole([textSlide(1, 'one')]);
		expect(bare.target.querySelector('[data-pptx-presenter-notes]')?.textContent?.trim()).toBe(
			translate('en', 'pptx.presenter.noNotes'),
		);
	});

	it('steps the notes font size within the shared bounds', () => {
		const { target } = mountConsole([textSlide(1, 'one')]);
		const notes = target.querySelector<HTMLElement>('[data-pptx-presenter-notes]');
		expect(notes?.getAttribute('style')).toContain(`font-size: ${NOTES_FONT_SIZE_DEFAULT}px`);

		rail(target, 'notes-font-decrease').click();
		flushSync();
		expect(notes?.getAttribute('style')).toContain(
			`font-size: ${NOTES_FONT_SIZE_DEFAULT - NOTES_FONT_SIZE_STEP}px`,
		);

		// Walk to the shared floor (10, not the 12 this binding used to clamp at).
		for (let step = 0; step < 10; step++) {
			rail(target, 'notes-font-decrease').click();
			flushSync();
		}
		expect(notes?.getAttribute('style')).toContain(`font-size: ${NOTES_FONT_SIZE_MIN}px`);
		expect(rail(target, 'notes-font-decrease').disabled).toBeTruthy();
		expect(target.textContent).toContain(`${NOTES_FONT_SIZE_MIN}px`);
	});

	it('gives the font stepper real accessible names', () => {
		const { target } = mountConsole([textSlide(1, 'one')]);
		expect(rail(target, 'notes-font-decrease').getAttribute('aria-label')).toBe(
			translate('en', 'pptx.presenter.decreaseFontSize'),
		);
		expect(rail(target, 'notes-font-increase').getAttribute('aria-label')).toBe(
			translate('en', 'pptx.presenter.increaseFontSize'),
		);
	});
});

describe('presenterView timer progress bar', () => {
	it('reports the elapsed segment as a labelled progressbar', () => {
		const startedAt = Date.now() - PRESENTER_TIMER_SEGMENT_MS / 2;
		const { target } = mountConsole([textSlide(1, 'one')], { startedAt });
		const bar = target.querySelector<HTMLElement>('[role="progressbar"]');

		expect(bar).not.toBeNull();
		expect(bar?.getAttribute('aria-valuemin')).toBe('0');
		expect(bar?.getAttribute('aria-valuemax')).toBe('100');
		expect(Number(bar?.getAttribute('aria-valuenow'))).toBeCloseTo(50, 0);
		expect(bar?.getAttribute('aria-label')).toBe(translate('en', 'pptx.presenter.timerProgress'));
		expect(bar?.getAttribute('title')).toContain('segment 1');
	});
});
