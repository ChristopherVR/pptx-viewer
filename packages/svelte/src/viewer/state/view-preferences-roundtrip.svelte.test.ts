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
async function loadHarness(
	source: Uint8Array,
	callbacks: {
		oncontentchange?: (bytes: Uint8Array) => void;
		onerror?: (message: string) => void;
	} = {},
): Promise<ViewerStateBag> {
	let captured: ViewerStateBag | undefined;
	const target = document.createElement('div');
	const instance = mount(CreateViewerStateHarness, {
		target,
		props: {
			...callbacks,
			source,
			autosave: false,
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
	it('keeps dirty and reports a failed content serialization without emitting bytes', async () => {
		const oncontentchange = vi.fn();
		const onerror = vi.fn();
		const state = await loadHarness(await buildDeck(), { oncontentchange, onerror });
		vi.spyOn(state.loader.handler!, 'save').mockRejectedValueOnce(
			new Error('serialization failed'),
		);
		state.editor.insertElement({ type: 'shape', id: '', x: 10, y: 20, width: 100, height: 50 });
		await vi.waitFor(() => expect(onerror).toHaveBeenCalledWith('serialization failed'));
		expect(oncontentchange).not.toHaveBeenCalled();
		expect(state.editor.dirty).toBeTruthy();
		expect(state.editor.canUndo).toBeTruthy();
	}, 60_000);

	it('does not clear a newer edit when a notification finishes', async () => {
		const oncontentchange = vi.fn();
		const state = await loadHarness(await buildDeck(), { oncontentchange });
		const bytes = await state.editor.save();
		let finish!: (bytes: Uint8Array) => void;
		const pending = new Promise<Uint8Array>((resolve) => {
			finish = resolve;
		});
		vi.spyOn(state.loader.handler!, 'save').mockReturnValue(pending);
		state.editor.insertElement({ type: 'shape', id: '', x: 10, y: 20, width: 100, height: 50 });
		state.editor.commitInlineText(state.editor.slides[0].elements[0].id, 'Newer body');
		finish(bytes);
		await vi.waitFor(() => expect(oncontentchange).toHaveBeenCalledTimes(2));
		expect(state.editor.dirty).toBeTruthy();
		expect(state.editor.slides[0].elements[0].text).toBe('Newer body');
	}, 60_000);

	it('keeps committed edits dirty without serializing an absent content callback', async () => {
		const state = await loadHarness(await buildDeck());
		const serialize = vi.spyOn(state.loader.handler!, 'save');
		state.editor.insertElement({ type: 'shape', id: '', x: 10, y: 20, width: 100, height: 50 });
		flushSync();
		expect(state.autosaveEnabled).toBeFalsy();
		await Promise.all(serialize.mock.results.map((result) => result.value));
		expect(serialize).not.toHaveBeenCalled();
		expect(state.editor.dirty).toBeTruthy();
	}, 60_000);

	it('notifies committed inline content without acknowledging a save', async () => {
		const oncontentchange = vi.fn<(bytes: Uint8Array) => void>();
		const state = await loadHarness(await buildDeck(), { oncontentchange });
		state.editor.insertElement({
			type: 'shape',
			id: '',
			x: 10,
			y: 20,
			width: 100,
			height: 50,
			text: 'Before',
		});
		await vi.waitFor(() => expect(oncontentchange).toHaveBeenCalledOnce());
		const id = state.editor.slides[0].elements[0].id;
		state.editor.commitInlineText(id, 'Committed body');
		await vi.waitFor(() => expect(oncontentchange).toHaveBeenCalledTimes(2));
		expect(state.editor.dirty).toBeTruthy();
		expect(state.editor.canUndo).toBeTruthy();
		const handler = new PptxHandler();
		try {
			const bytes = oncontentchange.mock.calls[1][0];
			const saved = await handler.load(bytes.buffer as ArrayBuffer);
			expect(saved.slides[0].elements[0].text).toBe('Committed body');
			expect(saved.viewProperties?.slideViewPr).toMatchObject({
				snapToGrid: false,
				showGuides: true,
			});
		} finally {
			handler.dispose();
		}
		await state.editingApi.save();
		expect(state.editor.dirty).toBeFalsy();
	}, 60_000);

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
