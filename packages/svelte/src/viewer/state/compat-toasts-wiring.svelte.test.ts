/**
 * compat-toasts-wiring.svelte.test.ts: wave 4 #3 plumbing.
 *
 * `loader.compatibilityWarnings` (fed from `handler.getCompatibilityWarnings()`)
 * and the resulting `compatToasts` state are new wiring on the load pipeline;
 * this pins that a real load populates both without throwing, mirroring the
 * pattern in `authored-custom-show.svelte.test.ts`. The toast decision logic
 * itself (dedupe, cap, dismiss) is unit-tested in `compat-toasts.svelte.test.ts`.
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

async function buildDeck(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
}

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

describe('svelte compat toasts wiring', () => {
	it('populates loader.compatibilityWarnings from the handler after load', async () => {
		const state = await loadHarness(await buildDeck());

		expect(Array.isArray(state.loader.compatibilityWarnings)).toBeTruthy();
		expect(state.compatToasts.visibleToasts).toStrictEqual([]);
		expect(state.compatToasts.overflowCount).toBe(0);
	}, 60_000);
});
