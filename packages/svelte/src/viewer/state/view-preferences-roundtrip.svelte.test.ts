/**
 * view-preferences-roundtrip.svelte.test.ts: wave 4 #5, deck view preferences
 * seeding + write-back.
 *
 * `ppt/viewProps.xml`'s snap/guide toggles were parsed onto
 * `loader.viewProperties` and then never read again: `parityUi.preferences`
 * always started from hard-coded defaults, so a deck authored with
 * `snapToGrid="0"` or `showGuides="1"` silently lost that on load, and no
 * toggle flipped in the ribbon ever reached a save. This mounts the real
 * `createViewerState` harness (same pattern as
 * `authored-custom-show.svelte.test.ts`) so it pins the WIRING, not just the
 * shared resolver (already unit-tested in
 * `pptx-viewer-shared/render/viewer-preferences`).
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

/** A one-slide deck, authored with an explicit `p:viewPr/p:slideViewPr`. */
async function buildDeck(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides, {
			viewProperties: {
				slideViewPr: { snapToGrid: false, snapToObjects: false, showGuides: true },
			},
		});
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
			editable: true,
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

describe('svelte deck view preferences', () => {
	it('seeds snapToGrid/snapToShape/showGuides from ppt/viewProps.xml on load', async () => {
		const state = await loadHarness(await buildDeck());

		// Guard the fixture: without these the seeding would agree for the wrong
		// reason.
		expect(state.loader.viewProperties?.slideViewPr?.snapToGrid).toBeFalsy();
		expect(state.loader.viewProperties?.slideViewPr?.snapToObjects).toBeFalsy();
		expect(state.loader.viewProperties?.slideViewPr?.showGuides).toBeTruthy();

		expect(state.parityUi.preferences.snapToGrid).toBeFalsy();
		expect(state.parityUi.snapToShape).toBeFalsy();
		expect(state.parityUi.showGuides).toBeTruthy();
	}, 60_000);

	it('folds a toggle flip back into editor.viewProperties (write-back)', async () => {
		const state = await loadHarness(await buildDeck());

		state.parityUi.preferences = { ...state.parityUi.preferences, snapToGrid: true };
		state.parityUi.showGuides = false;
		flushSync();

		expect(state.editor.viewProperties?.slideViewPr?.snapToGrid).toBeTruthy();
		expect(state.editor.viewProperties?.slideViewPr?.showGuides).toBeFalsy();
		// Untouched authored field is preserved, not reset to a hard-coded default.
		expect(state.editor.viewProperties?.slideViewPr?.snapToObjects).toBeFalsy();
	}, 60_000);

	it('a saved file actually carries the flipped toggle (full round-trip)', async () => {
		const state = await loadHarness(await buildDeck());

		state.parityUi.preferences = { ...state.parityUi.preferences, snapToGrid: true };
		flushSync();

		const bytes = await state.editor.save();
		const reloadHandler = new PptxHandler();
		try {
			const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
			expect(reloaded.viewProperties?.slideViewPr?.snapToGrid).toBeTruthy();
			// The showGuides:true this deck was authored with must survive a save
			// that never touched it.
			expect(reloaded.viewProperties?.slideViewPr?.showGuides).toBeTruthy();
		} finally {
			reloadHandler.dispose();
		}
	}, 60_000);
});
