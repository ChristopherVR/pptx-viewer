import type { PptxSlide } from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';
import type {
	CollabLoadOrigin,
	CollaborationConfig,
	ExternalCollaborationSession,
	ExternalCollaborationSnapshot,
} from 'pptx-viewer-shared';
import { readSlidesFromYDoc, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';
import * as Y from 'yjs';

import { useCollaboration } from './useCollaboration';
import type { UseCollaborationOptions } from './useCollaboration';

const cleanup: (() => void)[] = [];
afterEach(() => {
	for (const dispose of cleanup.splice(0).reverse()) {
		dispose();
	}
	vi.useRealTimers();
	vi.restoreAllMocks();
});
const factories = {
	createMap: () => new Y.Map(),
	createArray: () => new Y.Array(),
	createText: () => new Y.Text(),
};
function slide(id = 'slide', x = 0): PptxSlide {
	return {
		id,
		rId: id,
		slideNumber: 1,
		elements: [{ id: 'shape', type: 'shape', x, y: 0, width: 40, height: 40, rotation: 0 }],
	};
}
function host(
	initial: PptxSlide[] = [],
	snapshot: ExternalCollaborationSnapshot = { status: 'connected', synced: true },
) {
	const doc = new Y.Doc();
	cleanup.push(() => doc.destroy());
	let local: Record<string, unknown> | null = { user: 'host', comments: { thread: 'one' } };
	const listeners = new Set<() => void>();
	const session: ExternalCollaborationSession = {
		doc,
		awareness: {
			clientID: doc.clientID,
			getLocalState: () => local,
			setLocalState: (state) => {
				local = state;
			},
			setLocalStateField: (field, value) => {
				if (local) {
					local = { ...local, [field]: value };
				}
			},
			getStates: () => new Map(local ? [[doc.clientID, local]] : []),
			on: () => {},
			off: () => {},
		},
		getSnapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
	if (initial.length) {
		reconcileSlidesInYDoc(initial, doc, factories);
	}
	return {
		doc,
		session,
		listeners,
		read: () => readSlidesFromYDoc(doc),
		publish: (next: ExternalCollaborationSnapshot) => {
			snapshot = next;
			for (const listener of listeners) {
				listener();
			}
		},
	};
}
function mount(
	h: ReturnType<typeof host>,
	initial = [slide('bootstrap')],
	extra: Partial<CollaborationConfig> = {},
	getSourceBytes?: () => Uint8Array,
	serialize?: UseCollaborationOptions['serialize'],
) {
	const scope = effectScope();
	cleanup.push(() => scope.stop());
	const slides = ref(initial);
	const loadVersion = ref(0);
	let loadOrigin: CollabLoadOrigin = 'bootstrap';
	const collab = scope.run(() =>
		useCollaboration({
			slides,
			onRemoteSlides: (next) => {
				slides.value = next;
			},
			loadVersion,
			getLoadOrigin: () => loadOrigin,
			getSourceBytes,
			serialize,
		}),
	)!;
	const config: CollaborationConfig = {
		roomId: 'external-room',
		serverUrl: '',
		userName: 'Ada',
		externalSession: h.session,
		...extra,
	};
	return {
		slides,
		collab,
		config,
		load: (next: PptxSlide[], origin: CollabLoadOrigin) => {
			slides.value = next;
			loadOrigin = origin;
			loadVersion.value++;
		},
	};
}

describe('useCollaboration external sessions', () => {
	it('cancels late retained serialization when the external session is replaced', async () => {
		vi.useFakeTimers();
		let resolve: (bytes: Uint8Array) => void = () => {};
		let isCurrent: () => boolean = () => false;
		const serialize = vi.fn((current: () => boolean) => {
			isCurrent = current;
			return new Promise<Uint8Array>((done) => {
				resolve = done;
			});
		});
		const onWriteBack = vi.fn();
		const m = mount(
			host([slide('room')]),
			[slide('bootstrap')],
			{ role: 'owner', onWriteBack, writeBackDebounceMs: 0 },
			undefined,
			serialize,
		);
		await m.collab.start(m.config);
		await vi.advanceTimersByTimeAsync(0);
		expect(serialize).toHaveBeenCalledOnce();
		expect(isCurrent()).toBeTruthy();
		await m.collab.start({
			...m.config,
			role: 'viewer',
			externalSession: host([slide('replacement')]).session,
		});
		expect(isCurrent()).toBeFalsy();
		resolve(new Uint8Array([4]));
		await vi.advanceTimersByTimeAsync(0);
		expect(onWriteBack).not.toHaveBeenCalled();
	});

	it('contains a retained serializer rejection after its session stops', async () => {
		vi.useFakeTimers();
		let reject: (reason: Error) => void = () => {};
		const onWriteBack = vi.fn();
		const m = mount(
			host([slide('room')]),
			[slide('bootstrap')],
			{ role: 'owner', onWriteBack, writeBackDebounceMs: 0 },
			undefined,
			() =>
				new Promise<Uint8Array>((_resolve, fail) => {
					reject = fail;
				}),
		);
		await m.collab.start(m.config);
		await vi.advanceTimersByTimeAsync(0);
		m.collab.stop();
		reject(new Error('retired serialization'));
		await vi.advanceTimersByTimeAsync(0);
		expect(onWriteBack).not.toHaveBeenCalled();
	});

	it('exposes reactive custom-shell permissions and detaches a cleared host config', async () => {
		const h = host([slide('room')], { status: 'connected', synced: false });
		const config = shallowRef<CollaborationConfig | undefined>({
			roomId: 'shell-room',
			serverUrl: '',
			userName: 'Ada',
			externalSession: h.session,
		});
		const canEdit = ref(true);
		const sourcePending = ref(false);
		const sourceError = ref(false);
		const scope = effectScope();
		cleanup.push(() => scope.stop());
		const slides = ref([slide('bootstrap')]);
		const collab = scope.run(() =>
			useCollaboration({
				slides,
				collaboration: config,
				canEdit,
				sourcePending,
				sourceError,
				onRemoteSlides: (next) => {
					slides.value = next;
				},
			}),
		)!;
		await vi.waitFor(() => expect(collab.active.value).toBeTruthy());
		expect(collab.shellState.value.canEdit).toBeFalsy();
		h.publish({ status: 'connected', synced: true });
		expect(collab.shellState.value.canEdit).toBeTruthy();
		expect(collab.shellState.value.connectedCount).toBe(1);
		canEdit.value = false;
		expect(collab.shellState.value.canEdit).toBeFalsy();
		canEdit.value = true;
		sourcePending.value = true;
		expect(collab.shellState.value.canEdit).toBeFalsy();
		sourcePending.value = false;
		sourceError.value = true;
		expect(collab.shellState.value.canEdit).toBeFalsy();
		sourceError.value = false;
		expect(collab.shellState.value.canEdit).toBeTruthy();
		const replacement = host([slide('other-room')]);
		config.value = { ...config.value!, role: 'viewer', externalSession: replacement.session };
		await vi.waitFor(() => expect(replacement.listeners.size).toBe(1));
		expect(h.listeners.size).toBe(0);
		expect(slides.value[0].id).toBe('other-room');
		expect(collab.shellState.value.canEdit).toBeFalsy();
		config.value = undefined;
		await nextTick();
		expect(collab.active.value).toBeFalsy();
		expect(h.listeners.size).toBe(0);
		expect(replacement.listeners.size).toBe(0);
		expect(collab.shellState.value).toMatchObject({
			canEdit: true,
			status: 'disconnected',
			connectedCount: 0,
		});
	});

	it('persists remote-only changes on the elected owner without a local edit', async () => {
		vi.useFakeTimers();
		const bytes = new Uint8Array([7]);
		vi.spyOn(PptxHandler.prototype, 'load').mockResolvedValue({} as never);
		const save = vi.spyOn(PptxHandler.prototype, 'save').mockResolvedValue(bytes);
		const onWriteBack = vi.fn();
		const h = host([slide('room')]);
		const m = mount(
			h,
			[slide('bootstrap')],
			{
				role: 'owner',
				onWriteBack,
				writeBackDebounceMs: 0,
			},
			() => bytes,
		);
		await m.collab.start(m.config);
		await vi.advanceTimersByTimeAsync(0);
		onWriteBack.mockClear();
		save.mockClear();
		reconcileSlidesInYDoc([slide('room', 42)], h.doc, factories, 'peer');
		await nextTick();
		await vi.advanceTimersByTimeAsync(0);
		expect(m.slides.value[0].elements[0].x).toBe(42);
		expect(save).toHaveBeenCalledOnce();
		expect(save.mock.calls[0][0][0].elements[0].x).toBe(42);
		expect(onWriteBack).toHaveBeenCalledWith(bytes);
	});

	it('keeps editing disabled and ignores partial room content until synced', async () => {
		const h = host([slide('partial')], { status: 'connected', synced: false });
		const m = mount(h);
		await m.collab.start(m.config);
		expect(m.collab.readOnly?.value).toBeTruthy();
		expect(m.slides.value[0].id).toBe('bootstrap');
		reconcileSlidesInYDoc([slide('room')], h.doc, factories, 'peer');
		expect(m.slides.value[0].id).toBe('bootstrap');
		h.publish({ status: 'connected', synced: true });
		expect(m.collab.readOnly.value).toBeFalsy();
		expect(m.slides.value[0].id).toBe('room');
		h.publish({ status: 'connecting', synced: false });
		expect(m.collab.readOnly.value).toBeTruthy();
		m.collab.stop();
		expect(m.collab.readOnly.value).toBeFalsy();
	});

	it('does not detach the host session when beforeunload is cancelled', async () => {
		const h = host([slide('room')]);
		const m = mount(h);
		await m.collab.start(m.config);
		window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
		expect(m.collab.active.value).toBeTruthy();
		expect(h.listeners.size).toBe(1);
		reconcileSlidesInYDoc([slide('room', 42)], h.doc, factories, 'peer');
		expect(m.slides.value[0].elements[0].x).toBe(42);
		window.dispatchEvent(new Event('pagehide'));
		expect(m.collab.active.value).toBeFalsy();
		expect(h.listeners.size).toBe(0);
	});

	it('re-adopts authoritative content after a delayed bootstrap load', async () => {
		const h = host([slide('room')]);
		const m = mount(h);
		await m.collab.start(m.config);
		m.load([slide('late-bootstrap')], 'bootstrap');
		await nextTick();
		expect(m.slides.value[0].id).toBe('room');
		expect(h.read()[0].id).toBe('room');
	});

	it('adopts an already-synced room before publishing and keeps the host alive on stop', async () => {
		const h = host([slide('room', 12)]);
		const destroy = vi.spyOn(h.doc, 'destroy');
		const m = mount(h);
		await m.collab.start(m.config);
		await nextTick();
		expect(m.slides.value[0].id).toBe('room');
		expect(h.read().map((item) => item.id)).toStrictEqual(['room']);
		m.slides.value = [slide('room', 90)];
		await nextTick();
		expect(h.read()[0].elements[0].x).toBe(90);
		m.collab.stop();
		expect(destroy).not.toHaveBeenCalled();
		expect(h.listeners.size).toBe(0);
		expect(h.session.awareness.getLocalState()).toStrictEqual({
			user: 'host',
			comments: { thread: 'one' },
		});
		h.doc.getMap('host').set('still-alive', true);
		expect(h.doc.getMap('host').get('still-alive')).toBeTruthy();
	});

	it('waits for the host sync signal without grace and retains synced offline editing', async () => {
		vi.useFakeTimers();
		const h = host([], { status: 'connected', synced: false });
		const m = mount(h, [slide('new')]);
		await m.collab.start(m.config);
		vi.advanceTimersByTime(60_000);
		await nextTick();
		expect(h.read()).toStrictEqual([]);
		expect(m.collab.livePatcher.isActive()).toBeFalsy();
		h.publish({ status: 'connected', synced: true });
		expect(h.read()[0].id).toBe('new');
		h.publish({ status: 'disconnected', synced: true });
		m.slides.value = [slide('new', 75)];
		await nextTick();
		expect(h.read()[0].elements[0].x).toBe(75);
		h.publish({ status: 'connecting', synced: false });
		m.slides.value = [slide('new', 100)];
		await nextTick();
		expect(h.read()[0].elements[0].x).toBe(75);
		expect(m.collab.livePatcher.isActive()).toBeFalsy();
		h.publish({ status: 'connected', synced: true });
		expect(m.slides.value[0].elements[0].x).toBe(75);
	});

	it('never writes full-slide or live changes in a viewer-only session', async () => {
		const h = host([slide('room', 12)]);
		const m = mount(h, [slide('bootstrap')], { role: 'viewer' });
		await m.collab.start(m.config);
		m.slides.value = [slide('room', 99)];
		m.collab.livePatcher.patchGeometry('room', 'shape', { x: 150 });
		await nextTick();
		expect(h.read()[0].elements[0].x).toBe(12);
		expect(m.collab.livePatcher.isActive()).toBeFalsy();
	});

	it('adopts deletion of the last slide before reopening writes after re-sync', async () => {
		const h = host([slide('room')]);
		const m = mount(h);
		await m.collab.start(m.config);
		h.publish({ status: 'connecting', synced: false });
		reconcileSlidesInYDoc([], h.doc, factories, 'peer');
		await nextTick();
		h.publish({ status: 'connected', synced: true });
		await nextTick();
		expect(m.slides.value).toStrictEqual([]);
		expect(h.read()).toStrictEqual([]);
	});

	it('does not seed a joined empty room but honors an explicit user load', async () => {
		const h = host();
		const m = mount(h, [slide('bootstrap')], { sessionIntent: 'join' });
		await m.collab.start(m.config);
		await nextTick();
		expect(h.read()).toStrictEqual([]);
		m.load([slide('opened')], 'user');
		await nextTick();
		expect(h.read().map((item) => item.id)).toStrictEqual(['opened']);
		m.slides.value = [];
		await nextTick();
		m.slides.value = [slide('later')];
		await nextTick();
		expect(h.read()[0].id).toBe('later');
	});

	it('applies remote deletion after joining and does not reset the join latch', async () => {
		const h = host();
		const m = mount(h, [slide('bootstrap')], { sessionIntent: 'join' });
		await m.collab.start(m.config);
		reconcileSlidesInYDoc([slide('room')], h.doc, factories, 'peer');
		await nextTick();
		expect(m.slides.value[0].id).toBe('room');
		reconcileSlidesInYDoc([], h.doc, factories, 'peer');
		await nextTick();
		expect(m.slides.value).toStrictEqual([]);
		m.slides.value = [slide('replacement')];
		await nextTick();
		expect(h.read()[0].id).toBe('replacement');
	});

	it('ignores a superseded async start and detaches from the previous host document', async () => {
		const first = host([slide('first')]);
		const second = host([slide('second')]);
		const m = mount(first);
		const a = m.collab.start(m.config);
		const b = m.collab.start({ ...m.config, externalSession: second.session });
		await Promise.all([a, b]);
		await nextTick();
		expect(m.slides.value[0].id).toBe('second');
		expect(first.listeners.size).toBe(0);
		expect(second.listeners.size).toBe(1);
		first.publish({ status: 'error', synced: false });
		expect(m.collab.status.value).toBe('connected');
		m.collab.stop();
	});
});
