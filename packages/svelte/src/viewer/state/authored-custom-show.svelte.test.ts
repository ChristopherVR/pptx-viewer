/**
 * authored-custom-show.svelte.test.ts: a deck saved with "Set Up Slide Show >
 * Custom show" has to actually open into that show.
 *
 * `p:showPr/p:custShow/@id` was parsed into `showSlidesCustomShowId` and then
 * ignored: playback ran off a viewer-only `activeCustomShowId` that nothing
 * seeded, so the radio was decorative and an authored deck played in full.
 * The seeding now rides the load commit in `useEditorUiCluster`, which is why
 * this mounts the real `createViewerState` harness rather than calling the
 * shared resolver: the resolver was always right, the WIRING was missing.
 */
import { PptxHandler } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ViewerStateBag } from './create-viewer-state-types';
import CreateViewerStateHarness from './CreateViewerStateHarness.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** A three-slide deck, optionally opening into a named custom show. */
async function buildDeck(authorCustomShow: boolean): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 3 });
	try {
		return await handler.save(
			data.slides,
			authorCustomShow
				? {
						customShows: [
							{ id: '0', name: 'Short Show', slideRIds: [data.slides[2].rId] },
							{ id: '1', name: 'Reverse', slideRIds: [data.slides[1].rId] },
						],
						presentationProperties: {
							showSlidesMode: 'customShow',
							showSlidesCustomShowId: '0',
						},
					}
				: undefined,
		);
	} finally {
		handler.dispose();
	}
}

/** Mount the real factory over `source` and wait for the load to commit. */
async function loadHarness(source: Uint8Array): Promise<ViewerStateBag> {
	let captured: ViewerStateBag | undefined;
	const target = document.createElement('div');
	const instance = mount(CreateViewerStateHarness, {
		target,
		props: {
			source,
			onready: (state: ViewerStateBag) => {
				captured = state;
			},
		},
	});
	cleanup = () => unmount(instance);
	if (!captured) {
		throw new Error('createViewerState harness did not report its state synchronously');
	}
	const state = captured;
	await vi.waitFor(
		() => {
			flushSync();
			expect(state.loader.loadCount).toBeGreaterThan(0);
		},
		{ timeout: 30_000 },
	);
	flushSync();
	return state;
}

describe('svelte authored custom show', () => {
	it('seeds activeCustomShowId from p:showPr/p:custShow on load', async () => {
		const state = await loadHarness(await buildDeck(true));

		// Guard the fixture: without these the seeding would agree for the wrong
		// reason.
		expect(state.loader.customShows.map((show) => show.id)).toStrictEqual(['0', '1']);
		expect(state.loader.presentationProperties.showSlidesCustomShowId).toBe('0');

		expect(state.parityUi.activeCustomShowId).toBe('0');
	}, 60_000);

	it('leaves activeCustomShowId null for a deck that names no show', async () => {
		const state = await loadHarness(await buildDeck(false));

		expect(state.parityUi.activeCustomShowId).toBeNull();
	}, 60_000);

	it('seeds the EMU slide size from p:sldSz so a save can persist it', async () => {
		const state = await loadHarness(await buildDeck(false));

		expect(state.loader.slideSize?.widthEmu).toBeGreaterThan(0);
		expect(state.loader.slideSize?.heightEmu).toBeGreaterThan(0);
	}, 60_000);
});
