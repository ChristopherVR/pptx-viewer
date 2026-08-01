import type { PptxSlide } from 'pptx-viewer-core';
import { createInitialPresentationSnapshot, PRESENTER_CONSOLE_ORDER } from 'pptx-viewer-shared';
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { mountPresenterView } from './presenter-view';
import type { PresenterViewOptions } from './presenter-view';

/** Resolve a label the way the console does, rather than hard-coding English. */
const t = createTranslator();

function slide(id: string, overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id,
		rId: `rId-${id}`,
		slideNumber: 1,
		elements: [],
		...overrides,
	} as PptxSlide;
}

interface Harness {
	container: HTMLElement;
	options: PresenterViewOptions;
	handle: ReturnType<typeof mountPresenterView>;
	setCurrent: (index: number) => void;
	dispose: () => void;
}

function mount(slides: PptxSlide[], overrides: Partial<PresenterViewOptions> = {}): Harness {
	const container = document.createElement('div');
	document.body.append(container);
	let current = 0;
	const snapshot: PresentationSnapshot = createInitialPresentationSnapshot();
	const options: PresenterViewOptions = {
		doc: document,
		t,
		container,
		getSlides: () => slides,
		getCurrent: () => current,
		getSnapshot: () => snapshot,
		getElapsedMs: () => 0,
		canvasSize: () => ({ width: 1280, height: 720 }),
		renderSlide: (target) => {
			const node = document.createElement('div');
			node.dataset.previewSlideId = target.id;
			return node;
		},
		navigate: vi.fn(),
		move: vi.fn(),
		isAudienceOpen: () => false,
		toggleTimer: vi.fn(),
		resetTimer: vi.fn(),
		stepZoom: vi.fn(),
		resetZoom: vi.fn(),
		setPointerTool: vi.fn(),
		setBlackout: vi.fn(),
		toggleCaptions: vi.fn(),
		toggleAudience: vi.fn(),
		swapDisplays: vi.fn(),
		end: vi.fn(),
		...overrides,
	};
	const handle = mountPresenterView(options);
	return {
		container,
		options,
		handle,
		setCurrent: (index) => {
			current = index;
			handle.syncSlide();
		},
		dispose: () => {
			handle.dispose();
			container.remove();
		},
	};
}

function control(container: HTMLElement, id: string): HTMLElement | null {
	return container.querySelector<HTMLElement>(`[data-pptx-presenter-control="${id}"]`);
}

describe('vanilla presenter view', () => {
	let harness: Harness | undefined;

	beforeEach(() => {
		harness?.dispose();
		harness = undefined;
	});

	it('mounts a named console region', () => {
		harness = mount([slide('s1'), slide('s2')]);
		const root = harness.container.querySelector('.pptxv-presenter');
		expect(root?.getAttribute('role')).toBe('region');
		expect(root?.getAttribute('aria-label')).toBe(t('pptx.presenter.presenterView'));
	});

	it('renders the shared strip inventory, in order', () => {
		harness = mount([slide('s1')]);
		const rendered = Array.from(
			harness.container.querySelectorAll<HTMLElement>(
				'.pptxv-presenter-strip [data-pptx-presenter-control]',
			),
		).map((node) => node.dataset.pptxPresenterControl ?? '');
		const expected = PRESENTER_CONSOLE_ORDER.filter(
			(id) => !id.startsWith('divider') && id !== 'spacer',
		);
		expect(rendered).toStrictEqual(expected);
	});

	it('names every strip control from the dictionary, never a raw key', () => {
		harness = mount([slide('s1')]);
		const buttons = harness.container.querySelectorAll<HTMLElement>(
			'.pptxv-presenter-strip [data-pptx-presenter-control]',
		);
		for (const button of buttons) {
			const name = button.getAttribute('aria-label') ?? '';
			expect(name.length).toBeGreaterThan(0);
			expect(name.startsWith('pptx.')).toBeFalsy();
			expect(button.title).toBe(name);
		}
	});

	it('names the blackout switches beyond their B / W glyph', () => {
		harness = mount([slide('s1')]);
		const black = control(harness.container, 'blackout-black');
		expect(black?.textContent).toContain('B');
		expect(black?.getAttribute('aria-label')).toBe(t('pptx.presenter.blackScreen'));
	});

	it('renders the current slide, the badge and the speaker notes', () => {
		harness = mount([slide('s1', { notes: 'Say hello' }), slide('s2')]);
		const main = harness.container.querySelector('.pptxv-presenter-main-frame');
		expect(main?.querySelector('[data-preview-slide-id="s1"]')).toBeTruthy();
		expect(harness.container.querySelector('.pptxv-presenter-badge')?.textContent).toBe(
			'Slide 1 of 2',
		);
		expect(harness.container.querySelector('.pptxv-presenter-notes-body')?.textContent).toBe(
			'Say hello',
		);
	});

	it('falls back to a placeholder when the slide has no notes', () => {
		harness = mount([slide('s1')]);
		expect(harness.container.querySelector('.pptxv-presenter-notes-body')?.textContent).toBe(
			t('pptx.presenter.noNotes'),
		);
	});

	it('renders rich notes segments rather than dropping their styling', () => {
		harness = mount([
			slide('s1', {
				notesSegments: [{ text: 'Bold bit', style: { bold: true } }],
			} as Partial<PptxSlide>),
		]);
		const span = harness.container.querySelector<HTMLElement>('.pptxv-presenter-notes-body span');
		expect(span?.textContent).toBe('Bold bit');
		expect(span?.style.fontWeight).toBe('bold');
	});

	// The whole point of the preview is to show what Next will actually reach.
	it('skips a hidden slide in the next-slide preview', () => {
		harness = mount([slide('s1'), slide('s2', { hidden: true }), slide('s3')]);
		const preview = harness.container.querySelector('.pptxv-presenter-next-body');
		expect(preview?.querySelector('[data-preview-slide-id="s3"]')).toBeTruthy();
		expect(preview?.querySelector('[data-preview-slide-id="s2"]')).toBeNull();
	});

	it('says so when there is nothing after the current slide', () => {
		harness = mount([slide('s1'), slide('s2', { hidden: true })]);
		expect(harness.container.querySelector('.pptxv-presenter-next-body')?.textContent).toBe(
			t('pptx.presenter.endOfPresentation'),
		);
	});

	it('disables Prev only on the first slide and never disables Next', () => {
		harness = mount([slide('s1'), slide('s2')]);
		expect((control(harness.container, 'prev') as HTMLButtonElement).disabled).toBeTruthy();
		// Never disabled: the presenter has to be able to reach the end-of-show
		// screen, or the audience display never closes.
		expect((control(harness.container, 'next') as HTMLButtonElement).disabled).toBeFalsy();

		harness.setCurrent(1);
		expect((control(harness.container, 'prev') as HTMLButtonElement).disabled).toBeFalsy();
		expect((control(harness.container, 'next') as HTMLButtonElement).disabled).toBeFalsy();
	});

	it('exposes an accessible timer progress bar', () => {
		harness = mount([slide('s1')]);
		const bar = harness.container.querySelector('.pptxv-presenter-progress');
		expect(bar?.getAttribute('role')).toBe('progressbar');
		expect(bar?.getAttribute('aria-valuemin')).toBe('0');
		expect(bar?.getAttribute('aria-valuemax')).toBe('100');
		expect(bar?.getAttribute('aria-label')).toBe(t('pptx.presenter.timerProgress'));
	});

	it('opens the all-slides navigator with real slide previews', () => {
		harness = mount([slide('s1'), slide('s2')]);
		control(harness.container, 'all-slides')?.click();
		const navigator = harness.container.querySelector('.pptxv-presenter-navigator');
		expect(navigator).toBeTruthy();
		expect(navigator?.querySelectorAll('.pptxv-presenter-navigator-tile')).toHaveLength(2);
		expect(navigator?.querySelector('[data-preview-slide-id="s2"]')).toBeTruthy();
	});

	it('advances the show when the big pane is clicked', () => {
		harness = mount([slide('s1'), slide('s2')]);
		harness.container.querySelector<HTMLElement>('.pptxv-presenter-main')?.click();
		expect(harness.options.move).toHaveBeenCalledWith(1);
	});

	it('tears the console out of the container on dispose', () => {
		harness = mount([slide('s1')]);
		harness.handle.dispose();
		expect(harness.container.querySelector('.pptxv-presenter')).toBeNull();
	});
});
