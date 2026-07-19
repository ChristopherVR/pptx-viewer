import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import type { CollabProviderHandle } from './collaboration-provider';

// ── Shared Y.Doc helpers: stub the doc-touching ones, keep the pure logic ──
const reconcileSlidesInYDoc = vi.fn();
const readSlidesFromYDoc = vi.fn<() => PptxSlide[]>(() => []);
let capturedObserve: ((events: unknown, tx: { origin?: unknown }) => void) | null = null;

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	reconcileSlidesInYDoc: (...args: unknown[]) => reconcileSlidesInYDoc(...args),
	readSlidesFromYDoc: () => readSlidesFromYDoc(),
	observeYDocSlides: (_doc: unknown, handler: typeof capturedObserve) => {
		capturedObserve = handler;
		return () => {
			capturedObserve = null;
		};
	},
}));

// ── Yjs + the transport provider: no real network / CRDT in unit tests ──
let capturedSynced: (() => void) | null = null;
let capturedStatus: ((connected: boolean) => void) | null = null;
const providerDestroy = vi.fn();

vi.mock(
	import('yjs'),
	() =>
		// The real Y.Doc/Y.Map/... carry a large surface the controller never
		// touches under these mocks; cast past `Partial<typeof import('yjs')>`.
		({
			Doc: class {
				destroy(): void {}
			},
			Map: class {},
			Array: class {},
			Text: class {},
		}) as unknown as typeof import('yjs'),
);

vi.mock(import('./collaboration-provider'), () => ({
	createCollabProvider: vi.fn(
		(): Promise<CollabProviderHandle> =>
			Promise.resolve({
				awareness: {
					clientID: 1,
					setLocalStateField: () => {},
					getStates: () => new Map(),
					on: () => {},
				},
				onStatus: (cb: (connected: boolean) => void) => {
					capturedStatus = cb;
				},
				connectedNow: true,
				onSynced: (cb: () => void) => {
					capturedSynced = cb;
				},
				syncedNow: false,
				destroy: providerDestroy,
			}),
	),
}));

const { createCollaborationController } = await import('./collaboration-controller');
const { LOCAL_SYNC_ORIGIN } = await import('pptx-viewer-shared');

function slide(id: string): PptxSlide {
	return { id, elements: [] } as unknown as PptxSlide;
}

const webrtcConfig = {
	roomId: 'room-1',
	serverUrl: '',
	transport: 'webrtc' as const,
	userName: 'A',
};

describe('createCollaborationController', () => {
	let store: Store<ViewerState>;
	let setEditable: Mock<(editable: boolean) => void>;

	function build() {
		setEditable = vi.fn<(editable: boolean) => void>((editable) => store.set({ editable }));
		return createCollaborationController({
			store,
			getHandler: () => null,
			setEditable,
		});
	}

	beforeEach(() => {
		vi.useFakeTimers();
		reconcileSlidesInYDoc.mockReset();
		readSlidesFromYDoc.mockReset().mockReturnValue([]);
		capturedObserve = null;
		capturedSynced = null;
		capturedStatus = null;
		providerDestroy.mockReset();
		store = createStore(createInitialViewerState());
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('reports connecting then connected for a webrtc session', async () => {
		const statuses: string[] = [];
		const collab = createCollaborationController({
			store,
			getHandler: () => null,
			setEditable: vi.fn(),
			onStatusChange: (s) => statuses.push(s),
		});
		await collab.start(webrtcConfig);
		expect(statuses).toStrictEqual(['connecting', 'connected']);
		expect(collab.isActive()).toBeTruthy();
		collab.stop();
	});

	it('publishes local edits once the sync gate opens (collaborator)', async () => {
		const collab = build();
		await collab.start({ ...webrtcConfig, role: 'collaborator' });
		capturedSynced?.(); // provider confirmed sync -> gate opens -> seed flush
		reconcileSlidesInYDoc.mockClear();

		store.set({ slides: [slide('a')] });
		expect(reconcileSlidesInYDoc).toHaveBeenCalledOnce();
		expect(reconcileSlidesInYDoc.mock.calls[0][0]).toStrictEqual([slide('a')]);
		collab.stop();
	});

	it('re-arms the sync gate on reconnect instead of leaving it permanently open', async () => {
		const collab = build();
		await collab.start({ ...webrtcConfig, role: 'collaborator' });
		capturedSynced?.(); // initial sync -> gate opens
		reconcileSlidesInYDoc.mockClear();

		// Drop and reconnect: without a re-arm, the gate stays open and a local
		// edit issued right after reconnecting could clobber the room before a
		// fresh sync confirmation arrives.
		capturedStatus?.(false);
		capturedStatus?.(true);

		store.set({ slides: [slide('a')] });
		expect(reconcileSlidesInYDoc).not.toHaveBeenCalled();

		capturedSynced?.(); // fresh sync confirmation re-opens the gate
		expect(reconcileSlidesInYDoc).toHaveBeenCalledOnce();
		collab.stop();
	});

	it('enforces the viewer role: read-only + no publishing', async () => {
		store.set({ editable: true });
		const collab = build();
		await collab.start({ ...webrtcConfig, role: 'viewer' });
		expect(setEditable).toHaveBeenCalledWith(false);

		capturedSynced?.(); // gate opens
		reconcileSlidesInYDoc.mockClear();
		store.set({ slides: [slide('a')] });
		expect(reconcileSlidesInYDoc).not.toHaveBeenCalled();

		collab.stop();
		// Editing is restored to its pre-session value on teardown.
		expect(setEditable).toHaveBeenLastCalledWith(true);
	});

	it('applies remote slides into the store, skipping its own writes', async () => {
		const collab = build();
		await collab.start({ ...webrtcConfig, role: 'collaborator' });
		readSlidesFromYDoc.mockReturnValue([slide('remote-1')]);

		// Our own reconcile transaction must be ignored.
		capturedObserve?.(null, { origin: LOCAL_SYNC_ORIGIN });
		expect(store.get().slides).toStrictEqual([]);

		// A peer's transaction routes through readSlidesFromYDoc into the store.
		capturedObserve?.(null, { origin: 'peer' });
		expect(store.get().slides).toStrictEqual([slide('remote-1')]);
		collab.stop();
	});

	it('adopts the doc slides over a late-finishing content load (no placeholder write)', async () => {
		const collab = build();
		await collab.start({ ...webrtcConfig, role: 'collaborator' });
		capturedSynced?.(); // gate opens (seed flush of the empty deck)
		reconcileSlidesInYDoc.mockClear();

		// The room's real slides already live in the doc (synced on join).
		readSlidesFromYDoc.mockReturnValue([slide('room-1')]);

		// The bootstrap load finishes parsing afterwards and commits its deck.
		collab.beginContentLoad();
		store.set({ slides: [slide('placeholder')] });
		// Ordering guarantee: the placeholder must not reach the doc before the
		// adoption check runs.
		expect(reconcileSlidesInYDoc).not.toHaveBeenCalled();

		collab.notifyContentLoaded();
		// The room content wins over the placeholder deck...
		expect(store.get().slides).toStrictEqual([slide('room-1')]);
		// ...and the placeholder deck is never written into the doc.
		expect(reconcileSlidesInYDoc).not.toHaveBeenCalled();
		collab.stop();
	});

	it('publishes the loaded deck after a content load into an empty room (seeder)', async () => {
		const collab = build();
		await collab.start({ ...webrtcConfig, role: 'collaborator' });
		capturedSynced?.(); // gate opens
		reconcileSlidesInYDoc.mockClear();

		collab.beginContentLoad();
		store.set({ slides: [slide('loaded')] });
		expect(reconcileSlidesInYDoc).not.toHaveBeenCalled();

		// Empty doc: this client is the seeder; the suppressed publish runs now.
		collab.notifyContentLoaded();
		expect(reconcileSlidesInYDoc).toHaveBeenCalledOnce();
		expect(reconcileSlidesInYDoc.mock.calls[0][0]).toStrictEqual([slide('loaded')]);
		collab.stop();
	});

	it('defers the seeder publish to the sync gate when it has not opened yet', async () => {
		const collab = build();
		await collab.start({ ...webrtcConfig, role: 'collaborator' });

		collab.beginContentLoad();
		store.set({ slides: [slide('loaded')] });
		collab.notifyContentLoaded();
		// Gate still closed: nothing may be written yet.
		expect(reconcileSlidesInYDoc).not.toHaveBeenCalled();

		capturedSynced?.(); // gate opens -> deferred first write
		expect(reconcileSlidesInYDoc).toHaveBeenCalledOnce();
		expect(reconcileSlidesInYDoc.mock.calls[0][0]).toStrictEqual([slide('loaded')]);
		collab.stop();
	});

	it('fails fast on an invalid room id', async () => {
		const statuses: string[] = [];
		const collab = createCollaborationController({
			store,
			getHandler: () => null,
			setEditable: vi.fn(),
			onStatusChange: (s) => statuses.push(s),
		});
		await collab.start({ ...webrtcConfig, roomId: 'bad room!' });
		expect(statuses).toStrictEqual(['error']);
		expect(collab.isActive()).toBeFalsy();
	});
});
