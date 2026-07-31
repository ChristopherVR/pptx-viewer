import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from './i18n';
import type { RenderController } from './render-controller';
import { createInitialViewerState, createStore } from './state';
import type { ViewerState } from './state';
import { openCustomShowsDialog } from './ui/custom-shows-dialog';
import { createViewerControls } from './viewer-controls';

/**
 * Custom-show playback: selecting a custom show restricts the running show to
 * its members, in its order, and a hidden member is still skipped.
 *
 * Custom shows were definable and persisted here long before this, but nothing
 * held an ACTIVE one, so choosing a show changed nothing about what presented:
 * every show ran the whole deck. These pin the state and the wiring rather than
 * the rule itself, which is unit-tested once in `pptx-viewer-shared`.
 */

function deck(size: number, hidden: readonly number[] = []): PptxSlide[] {
	return Array.from(
		{ length: size },
		(_unused, index) =>
			({
				id: `s${index + 1}`,
				rId: `rId${index + 1}`,
				slideNumber: index + 1,
				elements: [],
				hidden: hidden.includes(index),
			}) as PptxSlide,
	);
}

function harness(options: {
	slides: PptxSlide[];
	customShows?: PptxCustomShow[];
	activeCustomShowId?: string | null;
	startIndex?: number;
}) {
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		slides: options.slides,
		customShows: options.customShows ?? [],
		activeCustomShowId: options.activeCustomShowId ?? null,
		presenting: true,
		currentSlide: options.startIndex ?? 0,
	});
	const renderer = {
		presentationPlayback: {
			advance: () => false,
			isSeededCompleted: () => false,
			replayCurrentSlide: () => undefined,
		},
		effectiveScale: () => 1,
		fitScale: () => 1,
		zoomPercent: () => 100,
	} as unknown as RenderController;
	return { store, controls: createViewerControls(store, renderer) };
}

const SHOW: PptxCustomShow = { id: 'show-1', name: 'Short', slideRIds: ['rId1', 'rId3', 'rId5'] };

describe('vanilla custom-show playback', () => {
	it('defaults to the whole deck when no show is selected', () => {
		const { store, controls } = harness({ slides: deck(5), customShows: [SHOW] });
		controls.next();
		expect(store.get().currentSlide).toBe(1);
	});

	it('advances only through the active show members', () => {
		const { store, controls } = harness({
			slides: deck(5),
			customShows: [SHOW],
			activeCustomShowId: 'show-1',
		});
		controls.next();
		expect(store.get().currentSlide).toBe(2);
		controls.next();
		expect(store.get().currentSlide).toBe(4);
	});

	it('goes back only through the active show members', () => {
		const { store, controls } = harness({
			slides: deck(5),
			customShows: [SHOW],
			activeCustomShowId: 'show-1',
			startIndex: 4,
		});
		controls.prev();
		expect(store.get().currentSlide).toBe(2);
	});

	it('ends the show after the last member, not the last slide of the deck', () => {
		const { store, controls } = harness({
			slides: deck(5),
			customShows: [{ id: 'show-1', name: 'Short', slideRIds: ['rId1', 'rId2'] }],
			activeCustomShowId: 'show-1',
			startIndex: 1,
		});
		controls.next();
		expect(store.get().endOfShow).toBeTruthy();
		expect(store.get().currentSlide).toBe(1);
	});

	it('home and End land on the show first / last member', () => {
		const { store, controls } = harness({
			slides: deck(5),
			customShows: [SHOW],
			activeCustomShowId: 'show-1',
			startIndex: 2,
		});
		controls.lastSlide();
		expect(store.get().currentSlide).toBe(4);
		controls.firstSlide();
		expect(store.get().currentSlide).toBe(0);
	});

	it('still skips a HIDDEN member of the active show: hiding wins over membership', () => {
		const { store, controls } = harness({
			slides: deck(5, [2]),
			customShows: [SHOW],
			activeCustomShowId: 'show-1',
		});
		controls.next();
		expect(store.get().currentSlide).toBe(4);
	});

	it('falls back to the whole deck when the active id resolves to nothing', () => {
		const { store, controls } = harness({
			slides: deck(5),
			customShows: [SHOW],
			activeCustomShowId: 'deleted-show',
		});
		controls.next();
		expect(store.get().currentSlide).toBe(1);
	});

	it('leaves a typed jump alone: a non-member is still directly reachable', () => {
		const { store, controls } = harness({
			slides: deck(5),
			customShows: [SHOW],
			activeCustomShowId: 'show-1',
		});
		controls.goToSlide(3);
		expect(store.get().currentSlide).toBe(3);
	});
});

describe('vanilla custom-shows dialog picker', () => {
	function open(activeShowId: string | null) {
		document.body.replaceChildren();
		const onSetActive = vi.fn();
		const onRun = vi.fn();
		openCustomShowsDialog(document, createTranslator(), {
			shows: [SHOW],
			slides: deck(5),
			activeShowId,
			onSave: vi.fn(),
			onSetActive,
			onRun,
		});
		const select = document.querySelector<HTMLSelectElement>('.pptxv-custom-shows-active select')!;
		return { select, onSetActive, onRun };
	}

	it('offers All Slides plus every defined show, at React parity labels', () => {
		const { select } = open(null);
		expect(select.getAttribute('aria-label')).toBe('Select custom show');
		expect(Array.from(select.options).map((option) => option.textContent)).toStrictEqual([
			'All Slides',
			'Short',
		]);
	});

	it('reflects the show already selected', () => {
		expect(open('show-1').select.value).toBe('show-1');
	});

	it('selecting a show restricts playback; All Slides lifts the restriction', () => {
		const { select, onSetActive } = open(null);
		select.value = 'show-1';
		select.dispatchEvent(new Event('change'));
		expect(onSetActive).toHaveBeenLastCalledWith('show-1');
		select.value = '';
		select.dispatchEvent(new Event('change'));
		expect(onSetActive).toHaveBeenLastCalledWith(null);
	});

	it('starting a show from the dialog selects it too, so playback matches', () => {
		document.body.replaceChildren();
		const onSetActive = vi.fn();
		const onRun = vi.fn();
		openCustomShowsDialog(document, createTranslator(), {
			shows: [SHOW],
			slides: deck(5),
			activeShowId: null,
			onSave: vi.fn(),
			onSetActive,
			onRun,
		});
		Array.from(document.querySelectorAll('button'))
			.find((button) => button.textContent === 'From Beginning')!
			.click();
		expect(onSetActive).toHaveBeenCalledWith('show-1');
		expect(onRun).toHaveBeenCalledWith(SHOW);
	});
});
