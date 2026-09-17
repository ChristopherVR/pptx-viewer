import type { PptxSlide } from 'pptx-viewer-core';
import type {
	CollabLoadOrigin,
	CollaborationConfig,
	ExternalCollaborationSession,
	ExternalCollaborationSnapshot,
} from 'pptx-viewer-shared';
import { readSlidesFromYDoc, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import * as Y from 'yjs';

import { useCollaboration } from './useCollaboration';

const cleanup: (() => void)[] = [];
afterEach(() => {
	for (const dispose of cleanup.splice(0).reverse()) {
		dispose();
	}
	vi.useRealTimers();
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
