/**
 * read-only-recommendation-wiring.svelte.test.ts: wave 4 #2, the deck's own
 * `p:modifyVerifier` / "Mark as Final" read-only recommendation banner.
 *
 * Neither signal was ever surfaced by any binding: a password-protected or
 * "Marked as Final" deck opened silently editable. This mounts the real
 * `createViewerState` harness (same pattern as
 * `authored-custom-show.svelte.test.ts`) so it pins the WIRING (the lock
 * actually reaching `editor.editable`), not just the shared resolver (already
 * unit-tested in `pptx-viewer-shared/render/read-only-recommendation`).
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

async function buildDeck(kind: 'modifyVerifier' | 'markedFinal' | 'none'): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		if (kind === 'modifyVerifier') {
			return await handler.save(data.slides, {
				modifyVerifier: { algorithmName: 'SHA-512', hashData: 'ZmFrZQ==', saltData: 'c2FsdA==' },
			});
		}
		if (kind === 'markedFinal') {
			return await handler.save(data.slides, {
				customProperties: [{ name: '_MarkAsFinal', value: 'true', type: 'bool' }],
			});
		}
		return await handler.save(data.slides);
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

describe('svelte read-only recommendation', () => {
	it('shows no banner and no lock for a deck with neither signal', async () => {
		const state = await loadHarness(await buildDeck('none'));

		expect(state.readOnlyRec.showBanner).toBeFalsy();
		expect(state.readOnlyRec.locked).toBeFalsy();
		expect(state.editor.editable).toBeTruthy();
	}, 60_000);

	it('locks editing and shows the modifyVerifier banner', async () => {
		const state = await loadHarness(await buildDeck('modifyVerifier'));

		// Guard the fixture.
		expect(state.loader.modifyVerifier?.hashData).toBe('ZmFrZQ==');

		expect(state.readOnlyRec.showBanner).toBeTruthy();
		expect(state.readOnlyRec.recommendation.kind).toBe('modifyVerifier');
		expect(state.readOnlyRec.locked).toBeTruthy();
		flushSync();
		expect(state.editor.editable).toBeFalsy();
	}, 60_000);

	it('locks editing and shows the markedFinal banner', async () => {
		const state = await loadHarness(await buildDeck('markedFinal'));

		expect(state.loader.customProperties).toContainEqual({
			name: '_MarkAsFinal',
			value: 'true',
			type: 'bool',
		});
		expect(state.readOnlyRec.recommendation.kind).toBe('markedFinal');
		expect(state.readOnlyRec.locked).toBeTruthy();
		flushSync();
		expect(state.editor.editable).toBeFalsy();
	}, 60_000);

	it('"Edit anyway" lifts the lock and hides the banner', async () => {
		const state = await loadHarness(await buildDeck('modifyVerifier'));
		flushSync();
		expect(state.editor.editable).toBeFalsy();

		state.readOnlyRec.editAnyway();
		flushSync();

		expect(state.readOnlyRec.showBanner).toBeFalsy();
		expect(state.readOnlyRec.locked).toBeFalsy();
		expect(state.editor.editable).toBeTruthy();
	}, 60_000);

	it('"Dismiss" hides the banner but keeps the lock', async () => {
		const state = await loadHarness(await buildDeck('modifyVerifier'));

		state.readOnlyRec.dismiss();
		flushSync();

		expect(state.readOnlyRec.showBanner).toBeFalsy();
		expect(state.readOnlyRec.locked).toBeTruthy();
		expect(state.editor.editable).toBeFalsy();
	}, 60_000);
});
