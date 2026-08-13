/**
 * custom-shows-deck.test.ts: the deck <-> dialog key-space round-trip, the
 * seeding of the Custom Shows dialog from a loaded deck, the authored
 * "Set Up Slide Show > Custom show" selection, and the slide-size save option.
 *
 * Every one of these fails against the previous Angular build:
 *  - the dialog's list started empty and nothing ever seeded it;
 *  - what it did emit went into `slideRIds` as ARCHIVE PATHS, which PowerPoint
 *    rejects (`p:sld/@r:id` is a relationship id);
 *  - `customShows` was absent from the save options entirely;
 *  - `p:showPr/p:custShow/@id` was parsed and then ignored;
 *  - `slideSize` was absent from the save options, so the SLIDE SIZE card was
 *    decorative.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveAuthoredCustomShowId, SLIDE_SIZE_PRESETS } from '../internal/shared';
import type { DeckSaveOptions, DeckSaveSerializer } from '../internal/shared';
import {
	activeCustomShowMembership,
	customShowsFromDeck,
	customShowsToDeck,
} from './custom-shows-deck';
import { LoadContentService } from './load-content.service';
import { ViewerCustomShowsService } from './viewer-custom-shows.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function slide(n: number): PptxSlide {
	return {
		id: `ppt/slides/slide${n}.xml`,
		rId: `rId${n + 1}`,
		slideNumber: n,
		elements: [],
	} as PptxSlide;
}

const DECK: PptxSlide[] = [slide(1), slide(2), slide(3)];

const PARSED_SHOWS: PptxCustomShow[] = [
	{ id: '0', name: 'Short Show', slideRIds: ['rId2', 'rId4'] },
	{ id: '1', name: 'Reverse', slideRIds: ['rId4', 'rId3', 'rId2'] },
];

/** The private field the load pipeline assigns; set directly so save can run. */
interface LoaderInternals {
	handler: DeckSaveSerializer | null;
}

function loaderWithSaveSpy(): {
	loader: LoadContentService;
	lastOptions: () => DeckSaveOptions | undefined;
} {
	let captured: DeckSaveOptions | undefined;
	const injector = Injector.create({
		providers: [{ provide: LoadContentService, useClass: LoadContentService }],
	});
	const loader = runInInjectionContext(injector, () => injector.get(LoadContentService));
	const serializer: DeckSaveSerializer = {
		save: async (_slides, options) => {
			captured = options;
			return new Uint8Array([1]);
		},
		saveEncrypted: async () => new Uint8Array([2]),
	};
	(loader as unknown as LoaderInternals).handler = serializer;
	return { loader, lastOptions: () => captured };
}

function showsService(loader: LoadContentService): ViewerCustomShowsService {
	const injector = Injector.create({
		providers: [
			{ provide: LoadContentService, useValue: loader },
			{ provide: ViewerCustomShowsService, useClass: ViewerCustomShowsService },
		],
	});
	const svc = runInInjectionContext(injector, () => injector.get(ViewerCustomShowsService));
	svc.bind({ activeSlideIndex: () => 0, liveSlides: () => DECK });
	return svc;
}

// ---------------------------------------------------------------------------
// Key-space translation
// ---------------------------------------------------------------------------

describe('customShowsFromDeck / customShowsToDeck', () => {
	it('reads a parsed show into the dialog slide-id key space', () => {
		expect(customShowsFromDeck(PARSED_SHOWS, DECK)).toStrictEqual([
			{ id: '0', name: 'Short Show', slideIds: ['ppt/slides/slide1.xml', 'ppt/slides/slide3.xml'] },
			{
				id: '1',
				name: 'Reverse',
				slideIds: ['ppt/slides/slide3.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide1.xml'],
			},
		]);
	});

	it('writes the dialog list back as relationship ids, never archive paths', () => {
		const written = customShowsToDeck(
			[{ id: '0', name: 'Short Show', slideIds: ['ppt/slides/slide1.xml'] }],
			DECK,
		);
		expect(written[0].slideRIds).toStrictEqual(['rId2']);
		for (const rId of written[0].slideRIds) {
			expect(rId).not.toContain('ppt/slides/');
		}
	});

	it('round-trips a parsed show unchanged', () => {
		expect(customShowsToDeck(customShowsFromDeck(PARSED_SHOWS, DECK), DECK)).toStrictEqual(
			PARSED_SHOWS,
		);
	});

	it('drops membership entries naming a slide the deck does not have', () => {
		const orphan: PptxCustomShow[] = [{ id: '9', name: 'Gone', slideRIds: ['rId2', 'rId99'] }];
		expect(customShowsFromDeck(orphan, DECK)[0].slideIds).toStrictEqual(['ppt/slides/slide1.xml']);
	});

	it('treats an empty or unknown active id as "present the whole deck"', () => {
		expect(activeCustomShowMembership(PARSED_SHOWS, null)).toBeNull();
		expect(activeCustomShowMembership(PARSED_SHOWS, 'nope')).toBeNull();
		expect(activeCustomShowMembership([{ id: '0', name: 'x', slideRIds: [] }], '0')).toBeNull();
		expect(activeCustomShowMembership(PARSED_SHOWS, '1')).toStrictEqual({
			slideRIds: ['rId4', 'rId3', 'rId2'],
		});
	});
});

// ---------------------------------------------------------------------------
// Seeding + save payload
// ---------------------------------------------------------------------------

describe('viewerCustomShowsService', () => {
	it('lists the shows the deck was loaded with', () => {
		const { loader } = loaderWithSaveSpy();
		loader.customShows.set(PARSED_SHOWS);
		const svc = showsService(loader);
		expect(svc.shows().map((show) => show.name)).toStrictEqual(['Short Show', 'Reverse']);
		expect(svc.shows()[0].slideIds).toStrictEqual([
			'ppt/slides/slide1.xml',
			'ppt/slides/slide3.xml',
		]);
	});

	it('adopts the authored p:showPr custom show, and lets a manual pick win', () => {
		const { loader } = loaderWithSaveSpy();
		loader.customShows.set(PARSED_SHOWS);
		loader.presentationProperties.set({
			showSlidesMode: 'customShow',
			showSlidesCustomShowId: '1',
		});
		const svc = showsService(loader);

		svc.seedFromDeck();
		expect(svc.activeId()).toBe('1');
		expect(svc.activeCustomShow()).toStrictEqual({ slideRIds: ['rId4', 'rId3', 'rId2'] });

		svc.activeId.set('0');
		expect(svc.activeCustomShow()).toStrictEqual({ slideRIds: ['rId2', 'rId4'] });
	});

	it('ignores an authored id that names no surviving show', () => {
		const { loader } = loaderWithSaveSpy();
		loader.customShows.set(PARSED_SHOWS);
		loader.presentationProperties.set({
			showSlidesMode: 'customShow',
			showSlidesCustomShowId: '7',
		});
		const svc = showsService(loader);
		svc.seedFromDeck();
		expect(svc.activeId()).toBeNull();
		// The shared rule is the one being relied on; assert it directly too.
		expect(resolveAuthoredCustomShowId({ showSlidesMode: 'all' }, PARSED_SHOWS)).toBeUndefined();
	});

	it('presents the whole deck and starts at the show, never a pre-filtered array', () => {
		const { loader } = loaderWithSaveSpy();
		loader.customShows.set(PARSED_SHOWS);
		const svc = showsService(loader);
		svc.activeId.set('1');
		// Reverse = slides 3, 2, 1 -> the overlay still gets all three slides and
		// OPENS on deck index 2.
		expect(svc.presentationSlides()).toHaveLength(3);
		expect(svc.showEntryIndex()).toBe(2);
		// The entry slide is a one-shot SEED, not the live `startIndex` input:
		// pinning that input to the show's first slide made the overlay re-adopt
		// it over every advance, so the show never left its first slide. See
		// `presentation-custom-show-advance.test.ts`.
		expect(svc.presentationStartIndex()).toBe(0);
	});

	it('saves a created show with relationship ids', async () => {
		const { loader, lastOptions } = loaderWithSaveSpy();
		const svc = showsService(loader);
		svc.onCreate({ name: 'Openers', slideIds: ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml'] });

		await loader.saveSlides(DECK);
		const saved = lastOptions()?.customShows;
		expect(saved).toHaveLength(1);
		expect(saved?.[0].name).toBe('Openers');
		expect(saved?.[0].slideRIds).toStrictEqual(['rId2', 'rId3']);
	});

	it('carries the shows the deck arrived with through save', async () => {
		const { loader, lastOptions } = loaderWithSaveSpy();
		loader.customShows.set(PARSED_SHOWS);
		await loader.saveSlides(DECK);
		expect(lastOptions()?.customShows).toStrictEqual(PARSED_SHOWS);
	});
});

// ---------------------------------------------------------------------------
// Slide size
// ---------------------------------------------------------------------------

describe('slide size save option', () => {
	it('persists the loaded EMU size rather than a pixel round-trip', async () => {
		const { loader, lastOptions } = loaderWithSaveSpy();
		const ledger = SLIDE_SIZE_PRESETS.find((preset) => preset.labelKey === 'ledger');
		expect(ledger).toBeDefined();
		loader.slideSizeEmu.set({
			widthEmu: ledger!.widthEmu,
			heightEmu: ledger!.heightEmu,
			type: ledger!.type,
		});
		// 12179300 EMU is 1278.5px; the canvas rounds, the saved size must not.
		loader.canvasSize.set({ width: 1279, height: 959 });

		await loader.saveSlides(DECK);
		expect(lastOptions()?.slideSize).toStrictEqual({
			widthEmu: 12179300,
			heightEmu: 9134475,
			type: 'ledger',
		});
	});

	it('falls back to the hand-typed pixel canvas when the two disagree', async () => {
		const { loader, lastOptions } = loaderWithSaveSpy();
		loader.slideSizeEmu.set({ widthEmu: 12192000, heightEmu: 6858000, type: '' });
		loader.canvasSize.set({ width: 960, height: 720 });

		await loader.saveSlides(DECK);
		expect(lastOptions()?.slideSize).toStrictEqual({
			widthEmu: 9144000,
			heightEmu: 6858000,
			type: 'screen4x3',
		});
	});

	/**
	 * Source-level, because the defect it guards is template WIRING and the
	 * per-binding unit suites cannot render a component here.
	 *
	 * Caught live in the demo: the preset `<select>` originally carried
	 * `[value]="selectedPresetValue()"`. Angular applies an element's own
	 * property bindings before the `@for` inside it has produced any options, so
	 * the assignment ran against an empty option list and the browser fell back
	 * to option 0. A 1280x720 (Widescreen) deck opened reading "On-screen Show
	 * (4:3)", which is exactly the kind of wrong-but-plausible control state
	 * nobody re-reads.
	 */
	it('marks the selected preset per option, not with a value binding on the select', () => {
		const source = readFileSync(join(__dirname, 'slide-size-card.component.ts'), 'utf8');
		const select = source.slice(source.indexOf('<select'), source.indexOf('</select>'));
		expect(select).toContain('data-pptx-slide-size-preset');
		expect(select).not.toContain('[value]="selectedPresetValue()"');
		expect(select).toContain('[selected]="preset.labelKey === selectedPresetValue()"');
	});
});
