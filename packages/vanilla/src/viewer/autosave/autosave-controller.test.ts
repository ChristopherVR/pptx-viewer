import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import type { AutosaveActivation, AutosaveRecoveryOffer } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';

const saveAutosaveSnapshot = vi.fn<(path: string, data: Uint8Array) => Promise<boolean>>();
const probeAutosaveRecovery = vi.fn<(path: string) => Promise<AutosaveRecoveryOffer | null>>();

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	saveAutosaveSnapshot: (path: string, data: Uint8Array) => saveAutosaveSnapshot(path, data),
	probeAutosaveRecovery: (path: string) => probeAutosaveRecovery(path),
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

const ACTIVE: AutosaveActivation = { active: true, toggleAvailable: true };
const INACTIVE: AutosaveActivation = {
	active: false,
	toggleAvailable: true,
	reason: 'autosave_toggle_off',
};

describe('createAutosaveController', () => {
	let store: Store<ViewerState>;

	beforeEach(() => {
		vi.useFakeTimers();
		saveAutosaveSnapshot.mockReset().mockResolvedValue(true);
		probeAutosaveRecovery.mockReset().mockResolvedValue(null);
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
			getIntervalMs: () => 2000,
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

	/**
	 * The recovery blob is a crash-safety net, not the user's Save: it must never
	 * make the editor look saved, or the next real close would discard the work.
	 */
	it('never clears the editor dirty flag', async () => {
		const { handler } = makeHandler();
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			getIntervalMs: () => 1000,
		});

		store.set({ slides: [makeSlide('a')], dirty: true });
		await vi.advanceTimersByTimeAsync(1000);

		expect(saveAutosaveSnapshot).toHaveBeenCalledOnce();
		expect(store.get().dirty).toBeTruthy();
		controller.destroy();
	});

	it('does not persist a load (slides change without dirty)', async () => {
		const { handler } = makeHandler();
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			getIntervalMs: () => 2000,
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
			getIntervalMs: () => 1000,
			onStatus: (s) => statuses.push(s),
		});

		store.set({ slides: [makeSlide('a')], dirty: true });
		await vi.advanceTimersByTimeAsync(1000);

		expect(statuses).toStrictEqual(['saving', 'error']);
		controller.destroy();
	});

	it('re-reads the interval every time the timer is armed', async () => {
		const { handler, save } = makeHandler();
		let intervalMs = 10_000;
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			getIntervalMs: () => intervalMs,
		});

		// An Options change between the first and second edit must apply without
		// rebuilding the controller.
		intervalMs = 1000;
		store.set({ slides: [makeSlide('a')], dirty: true });
		await vi.advanceTimersByTimeAsync(1000);

		expect(save).toHaveBeenCalledOnce();
		controller.destroy();
	});

	it('follows the activation verdict rather than a raw enabled flag', async () => {
		const { handler, save } = makeHandler();
		let activation = INACTIVE;
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			getIntervalMs: () => 1000,
			getActivation: () => activation,
		});

		store.set({ slides: [makeSlide('a')], dirty: true });
		await vi.advanceTimersByTimeAsync(1000);
		expect(save).not.toHaveBeenCalled();
		expect(controller.isEnabled()).toBeFalsy();

		activation = ACTIVE;
		controller.refresh();
		expect(controller.isEnabled()).toBeTruthy();
		await vi.advanceTimersByTimeAsync(1000);
		expect(save).toHaveBeenCalledOnce();
		controller.destroy();
	});
});

/**
 * The debounce ceiling. A plain re-armed debounce defers a snapshot for as long
 * as the user keeps typing, which at the two-minute AutoRecover cadence is a
 * whole session of lost work. The shared `nextAutosaveDelayMs` caps the wait at
 * one interval measured from the FIRST unsaved edit; these tests fail against an
 * unbounded debounce.
 */
describe('the debounce never defers a snapshot past one interval', () => {
	let store: Store<ViewerState>;

	beforeEach(() => {
		vi.useFakeTimers();
		saveAutosaveSnapshot.mockReset().mockResolvedValue(true);
		probeAutosaveRecovery.mockReset().mockResolvedValue(null);
		store = createStore(createInitialViewerState());
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('snapshots continuous editing once per interval', async () => {
		const { handler } = makeHandler();
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			getIntervalMs: () => 1000,
		});

		// An edit every 200ms for 2.4s: an unbounded debounce would re-arm on
		// every one of them and write nothing at all.
		store.set({ slides: [makeSlide('edit-0')], dirty: true });
		for (let i = 1; i <= 12; i++) {
			await vi.advanceTimersByTimeAsync(200);
			store.set({ slides: [makeSlide(`edit-${i}`)], dirty: true });
		}

		expect(saveAutosaveSnapshot.mock.calls.length).toBeGreaterThanOrEqual(2);
		// ...and not once per edit either.
		expect(saveAutosaveSnapshot.mock.calls.length).toBeLessThanOrEqual(3);
		controller.destroy();
	});

	it('still debounces a burst of edits into a single snapshot', async () => {
		const { handler } = makeHandler();
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			getIntervalMs: () => 1000,
		});

		for (let i = 0; i < 5; i++) {
			store.set({ slides: [makeSlide(`burst-${i}`)], dirty: true });
			await vi.advanceTimersByTimeAsync(50);
		}
		await vi.advanceTimersByTimeAsync(1000);

		expect(saveAutosaveSnapshot).toHaveBeenCalledOnce();
		controller.destroy();
	});
});

describe('recovery probing', () => {
	let store: Store<ViewerState>;

	beforeEach(() => {
		vi.useFakeTimers();
		saveAutosaveSnapshot.mockReset().mockResolvedValue(true);
		probeAutosaveRecovery.mockReset().mockResolvedValue(null);
		store = createStore(createInitialViewerState());
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	function makeOffer(): AutosaveRecoveryOffer {
		return {
			prompt: {
				filePath: 'deck.pptx',
				timestamp: 10,
				size: 2048,
				ageMinutes: 3,
				titleKey: 'pptx.autosave.recovery.title',
				messageKey: 'pptx.autosave.recovery.message',
				messageParams: { file: 'deck.pptx', size: '2 KB' },
				ageKey: 'pptx.autosave.minutesAgo',
				ageParams: { count: 3 },
				restoreKey: 'pptx.autosave.recovery.restore',
				discardKey: 'pptx.autosave.recovery.discard',
			},
			record: { key: 'deck.pptx', data: new Uint8Array([9]), timestamp: 10, size: 2048 },
		};
	}

	it('offers the snapshot to the host hook AND the viewer prompt once a deck is open', async () => {
		const offer = makeOffer();
		probeAutosaveRecovery.mockResolvedValue(offer);
		const onRecovery = vi.fn();
		const onRecoveryOffer = vi.fn();
		const { handler } = makeHandler();
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			getIntervalMs: () => 2000,
			onRecovery,
			onRecoveryOffer,
		});

		// Nothing is loaded yet, so there is nothing to compare a snapshot with.
		expect(probeAutosaveRecovery).not.toHaveBeenCalled();

		store.set({ slides: [makeSlide('a')], loading: false });
		await vi.advanceTimersByTimeAsync(0);

		expect(probeAutosaveRecovery).toHaveBeenCalledExactlyOnceWith('deck.pptx');
		expect(onRecovery).toHaveBeenCalledWith(offer.record);
		expect(onRecoveryOffer).toHaveBeenCalledWith(offer);
		controller.destroy();
	});

	it('does not probe when the host switched autosave off entirely', async () => {
		probeAutosaveRecovery.mockResolvedValue(makeOffer());
		const { handler } = makeHandler();
		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			getIntervalMs: () => 2000,
			isRecoveryAllowed: () => false,
			onRecoveryOffer: vi.fn(),
		});

		store.set({ slides: [makeSlide('a')], loading: false });
		await vi.advanceTimersByTimeAsync(0);

		expect(probeAutosaveRecovery).not.toHaveBeenCalled();
		controller.destroy();
	});
});
