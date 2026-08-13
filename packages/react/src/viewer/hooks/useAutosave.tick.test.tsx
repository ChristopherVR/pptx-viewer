// @vitest-environment happy-dom
/**
 * The autosave TIMER contract (the polling half of the five-binding split).
 *
 * `isDirty` stays true from the first edit until the user performs a real save,
 * so a timer keyed on it alone re-serialized the whole deck and rewrote an
 * identical IndexedDB record every N seconds for as long as the tab stayed
 * open. Vue, Svelte and Vanilla never had that problem: they debounce on the
 * slides array being reassigned. These tests pin React onto the same trigger,
 * and - just as importantly - pin the cases where it must still write.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useAutosave } from './useAutosave';

vi.mock(import('pptx-viewer-shared'), async () => {
	const actual = await vi.importActual<typeof import('pptx-viewer-shared')>('pptx-viewer-shared');
	return { ...actual, saveAutosaveSnapshot: vi.fn(async () => true) };
});

const { saveAutosaveSnapshot } = await import('pptx-viewer-shared');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	vi.useFakeTimers();
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	vi.mocked(saveAutosaveSnapshot).mockClear();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	vi.useRealTimers();
});

const INTERVAL_SECONDS = 10;

interface Harness {
	serialize: ReturnType<typeof vi.fn>;
	render: (sources: readonly unknown[]) => void;
	tick: () => Promise<void>;
}

function mount(): Harness {
	const serialize = vi.fn(async () => new Uint8Array([1, 2, 3]));
	let current: readonly unknown[] = [];
	function Host(): null {
		useAutosave({
			isDirty: true,
			filePath: 'deck.pptx',
			serializeSlides: serialize,
			intervalSeconds: INTERVAL_SECONDS,
			getChangeSources: () => current,
		});
		return null;
	}
	return {
		serialize,
		render(sources) {
			current = sources;
			act(() => {
				root.render(<Host />);
			});
		},
		async tick() {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(INTERVAL_SECONDS * 1000);
			});
		},
	};
}

describe('autosave timer redundancy', () => {
	it('writes the first snapshot, then skips ticks that change nothing', async () => {
		const slides = [{ id: 'slide1' }];
		const harness = mount();
		harness.render([slides]);

		await harness.tick();
		expect(harness.serialize).toHaveBeenCalledOnce();
		expect(saveAutosaveSnapshot).toHaveBeenCalledOnce();

		await harness.tick();
		await harness.tick();
		expect(harness.serialize).toHaveBeenCalledOnce();
		expect(saveAutosaveSnapshot).toHaveBeenCalledOnce();
	});

	it('writes again as soon as an edit reassigns the slides', async () => {
		const slides = [{ id: 'slide1' }];
		const harness = mount();
		harness.render([slides]);
		await harness.tick();
		expect(harness.serialize).toHaveBeenCalledOnce();

		// An immutable edit: same content, new array.
		harness.render([[...slides]]);
		await harness.tick();
		expect(harness.serialize).toHaveBeenCalledTimes(2);
		expect(saveAutosaveSnapshot).toHaveBeenCalledTimes(2);
	});

	it('writes on every tick when the host supplies no change sources', async () => {
		// The opt-out must keep the old always-write behaviour: a binding that
		// cannot describe its state is never a reason to drop a snapshot.
		const serialize = vi.fn(async () => new Uint8Array([1]));
		function Host(): null {
			useAutosave({
				isDirty: true,
				filePath: 'deck.pptx',
				serializeSlides: serialize,
				intervalSeconds: INTERVAL_SECONDS,
			});
			return null;
		}
		act(() => {
			root.render(<Host />);
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(INTERVAL_SECONDS * 1000);
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(INTERVAL_SECONDS * 1000);
		});
		expect(serialize).toHaveBeenCalledTimes(2);
	});
});
