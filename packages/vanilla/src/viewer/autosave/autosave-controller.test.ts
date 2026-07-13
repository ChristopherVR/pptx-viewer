import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';

const saveAutosaveSnapshot = vi.fn<(path: string, data: Uint8Array) => Promise<boolean>>();
const getAutosaveSnapshot = vi.fn();

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	saveAutosaveSnapshot: (path: string, data: Uint8Array) => saveAutosaveSnapshot(path, data),
	getAutosaveSnapshot: (path: string) => getAutosaveSnapshot(path),
}));

// Imported after the mock is registered.
const { createAutosaveController } = await import('./autosave-controller');

function makeSlide(id: string): PptxSlide {
	return { id, elements: [] } as unknown as PptxSlide;
}

function makeHandler(bytes = new Uint8Array([1, 2, 3])): {
	handler: PptxHandler;
	save: ReturnType<typeof vi.fn>;
} {
	const save = vi.fn().mockResolvedValue(bytes);
	return { handler: { save } as unknown as PptxHandler, save };
}

describe('createAutosaveController', () => {
	let store: Store<ViewerState>;

	beforeEach(() => {
		vi.useFakeTimers();
		saveAutosaveSnapshot.mockReset().mockResolvedValue(true);
		getAutosaveSnapshot.mockReset().mockResolvedValue(undefined);
		store = createStore(createInitialViewerState());
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('persists a debounced snapshot after a dirty edit', async () => {
		const { handler, save } = makeHandler();
		const statuses: string[] = [];
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			intervalMs: 2000,
			onStatus: (s) => statuses.push(s),
		});

		store.set({ slides: [makeSlide('a')], dirty: true });
		expect(saveAutosaveSnapshot).not.toHaveBeenCalled(); // still debouncing

		await vi.advanceTimersByTimeAsync(2000);

		expect(save).toHaveBeenCalledOnce();
		expect(saveAutosaveSnapshot).toHaveBeenCalledWith('deck.pptx', new Uint8Array([1, 2, 3]));
		expect(statuses).toStrictEqual(['saving', 'saved']);
		controller.destroy();
	});

	it('does not persist a load (slides change without dirty)', async () => {
		const { handler } = makeHandler();
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			intervalMs: 2000,
		});

		// A load sets slides but never sets dirty.
		store.set({ slides: [makeSlide('a')], loading: false });
		await vi.advanceTimersByTimeAsync(2000);

		expect(saveAutosaveSnapshot).not.toHaveBeenCalled();
		controller.destroy();
	});

	it('reports an error status when the snapshot write throws', async () => {
		const { handler } = makeHandler();
		saveAutosaveSnapshot.mockRejectedValueOnce(new Error('quota'));
		const statuses: string[] = [];
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			intervalMs: 1000,
			onStatus: (s) => statuses.push(s),
		});

		store.set({ slides: [makeSlide('a')], dirty: true });
		await vi.advanceTimersByTimeAsync(1000);

		expect(statuses).toStrictEqual(['saving', 'error']);
		controller.destroy();
	});

	it('offers a recovery snapshot found on construction', async () => {
		const record = { key: 'deck.pptx', data: new Uint8Array([9]), timestamp: 1, size: 1 };
		getAutosaveSnapshot.mockResolvedValue(record);
		const onRecovery = vi.fn();
		const { handler } = makeHandler();
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			intervalMs: 2000,
			onRecovery,
		});

		await vi.advanceTimersByTimeAsync(0); // flush the getAutosaveSnapshot promise
		expect(onRecovery).toHaveBeenCalledWith(record);
		controller.destroy();
	});

	it('defers snapshots until autosave is enabled at runtime', async () => {
		const { handler, save } = makeHandler();
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			intervalMs: 1000,
			enabled: false,
		});

		store.set({ slides: [makeSlide('a')], dirty: true });
		await vi.advanceTimersByTimeAsync(1000);
		expect(save).not.toHaveBeenCalled();

		controller.setEnabled(true);
		await vi.advanceTimersByTimeAsync(1000);
		expect(save).toHaveBeenCalledOnce();
		controller.destroy();
	});
});
