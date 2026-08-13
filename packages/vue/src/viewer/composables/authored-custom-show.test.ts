// oxlint-disable react-hooks/rules-of-hooks
/**
 * authored-custom-show.test.ts: "Set Up Slide Show > Custom show" must actually
 * select the show.
 *
 * `ShowSlidesFieldset` wrote `showSlidesMode: 'customShow'` plus
 * `showSlidesCustomShowId`, and core parsed and serialised both, but no
 * presentation controller ever read them back: playback ran off a separate
 * viewer-only `activeCustomShowId` that nothing seeded. The radio was
 * decorative and a deck authored to open into "Reverse" presented in full.
 *
 * `useCustomShowsWiring` now seeds from the shared
 * `resolveAuthoredCustomShowId`, which is also what pins the fallbacks below
 * (an id naming no surviving show means the whole deck, not an empty show).
 */
import { mount } from '@vue/test-utils';
import type { PptxCustomShow, PptxPresentationProperties, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { computed, defineComponent, h, nextTick, ref, shallowRef } from 'vue';

import { useCustomShowsWiring } from './useCustomShowsWiring';
import type { UseCustomShowsWiringResult } from './useCustomShowsWiring';

const SHOWS: PptxCustomShow[] = [
	{ id: '0', name: 'Short Show', slideRIds: ['rId2', 'rId4'] },
	{ id: '1', name: 'Reverse', slideRIds: ['rId4', 'rId3', 'rId2'] },
];

function slide(rId: string): PptxSlide {
	return { id: rId, rId, elements: [] } as unknown as PptxSlide;
}

/**
 * `useCustomShowsWiring` calls `useI18n()`, so it has to run inside a component
 * setup. The refs are returned so a test can mutate them afterwards.
 */
function setup(
	properties: PptxPresentationProperties,
	shows: PptxCustomShow[] = SHOWS,
): {
	wiring: UseCustomShowsWiringResult;
	presentationProperties: ReturnType<typeof shallowRef<PptxPresentationProperties>>;
	customShows: ReturnType<typeof shallowRef<PptxCustomShow[]>>;
} {
	const presentationProperties = shallowRef<PptxPresentationProperties>(properties);
	const customShows = shallowRef<PptxCustomShow[]>(shows);
	const slides = shallowRef<PptxSlide[]>([slide('rId2'), slide('rId3'), slide('rId4')]);
	const activeSlideIndex = ref(0);
	let captured: UseCustomShowsWiringResult | null = null;
	mount(
		defineComponent({
			setup() {
				captured = useCustomShowsWiring({
					customShows,
					slides,
					activeSlideIndex,
					activeSlide: computed(() => slides.value[activeSlideIndex.value]),
					presentationProperties,
					pushHistory: () => {},
				});
				return () => h('div');
			},
		}),
	);
	return {
		wiring: captured as unknown as UseCustomShowsWiringResult,
		presentationProperties,
		customShows,
	};
}

describe('authored custom show seeding', () => {
	it('opens into the show p:showPr names', () => {
		const { wiring } = setup({ showSlidesMode: 'customShow', showSlidesCustomShowId: '1' });
		expect(wiring.activeCustomShowId.value).toBe('1');
	});

	it('presents the whole deck when the deck asks for all slides', () => {
		const { wiring } = setup({ showSlidesMode: 'all' });
		expect(wiring.activeCustomShowId.value).toBeNull();
	});

	it('presents the whole deck when the named show no longer exists', () => {
		const { wiring } = setup({ showSlidesMode: 'customShow', showSlidesCustomShowId: 'gone' });
		expect(wiring.activeCustomShowId.value).toBeNull();
	});

	it('lets a later manual selection win over the authored one', async () => {
		const { wiring } = setup({ showSlidesMode: 'customShow', showSlidesCustomShowId: '1' });
		expect(wiring.activeCustomShowId.value).toBe('1');

		// The ribbon / Custom Shows panel assigns this ref directly.
		wiring.activeCustomShowId.value = '0';
		await nextTick();
		expect(wiring.activeCustomShowId.value).toBe('0');
	});

	it('does not re-seed when an unrelated custom-show edit lands', async () => {
		const { wiring, customShows } = setup({
			showSlidesMode: 'customShow',
			showSlidesCustomShowId: '1',
		});
		wiring.activeCustomShowId.value = '0';

		// Creating or renaming a show reassigns `customShows`; that must not drag
		// the selection back to the authored show under the user.
		customShows.value = [...customShows.value, { id: '2', name: 'Extra', slideRIds: [] }];
		await nextTick();
		expect(wiring.activeCustomShowId.value).toBe('0');
	});

	it('follows a fresh Set Up Slide Show commit', async () => {
		const { wiring, presentationProperties } = setup({ showSlidesMode: 'all' });
		expect(wiring.activeCustomShowId.value).toBeNull();

		presentationProperties.value = {
			showSlidesMode: 'customShow',
			showSlidesCustomShowId: '0',
		};
		await nextTick();
		expect(wiring.activeCustomShowId.value).toBe('0');
	});
});
