// oxlint-disable react-hooks/rules-of-hooks
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

import { useCollaboration } from './useCollaboration';

// ── Mock Yjs + y-websocket with the minimum surface the composable uses ──────
const { state } = vi.hoisted(() => ({
	state: {
		mapValues: new Map<string, unknown>(),
		mapObserver: null as null | (() => void),
		awarenessStates: new Map<number, Record<string, unknown>>(),
		awarenessChange: null as null | (() => void),
		statusCb: null as null | ((p: { status?: string }) => void),
	},
}));

vi.mock(import('yjs'), () => ({
	Doc: class {
		getMap() {
			return {
				set: (k: string, v: unknown) => {
					state.mapValues.set(k, v);
				},
				get: (k: string) => state.mapValues.get(k),
				observe: (cb: () => void) => {
					state.mapObserver = cb;
				},
			};
		}
		destroy() {}
	},
}));
vi.mock(import('y-websocket'), () => ({
	WebsocketProvider: class {
		awareness = {
			clientID: 1,
			setLocalStateField: (field: string, value: unknown) => {
				const self = state.awarenessStates.get(1) ?? {};
				self[field] = value;
				state.awarenessStates.set(1, self);
			},
			getStates: () => state.awarenessStates,
			on: (_e: string, cb: () => void) => {
				state.awarenessChange = cb;
			},
			off: () => {},
		};
		on(_e: string, cb: (p: { status?: string }) => void) {
			state.statusCb = cb;
		}
		disconnect() {}
		destroy() {}
	},
}));

function slide(id: string): PptxSlide {
	return { id, elements: [] } as unknown as PptxSlide;
}
const config = { roomId: 'r', serverUrl: 'wss://x', userName: 'Ada' };

describe('useCollaboration', () => {
	it('connects, reflects status, and maps remote cursors', async () => {
		state.mapValues.clear();
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;

		await collab.start(config);
		expect(collab.active.value).toBeTruthy();

		state.statusCb?.({ status: 'connected' });
		expect(collab.connected.value).toBeTruthy();

		// A remote peer appears with a cursor.
		state.awarenessStates.set(2, {
			user: { name: 'Bob', color: '#ff0000' },
			cursor: { x: 10, y: 20 },
		});
		state.awarenessChange?.();
		expect(collab.cursors.value).toHaveLength(1);
		expect(collab.cursors.value[0]).toMatchObject({ userName: 'Bob', x: 10, y: 20 });

		scope.stop();
	});

	it('publishes selection + active slide and surfaces remote presence', async () => {
		state.mapValues.clear();
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		// Local publishers write into the self awareness state.
		collab.setSelection(['el-1', 'el-2']);
		collab.setActiveSlide(3);
		expect(state.awarenessStates.get(1)).toMatchObject({
			selection: ['el-1', 'el-2'],
			activeSlide: 3,
		});

		// A remote peer publishes selection + active slide (no cursor yet).
		state.awarenessStates.set(2, {
			user: { name: 'Bob', color: '#00ff00' },
			selection: ['el-9'],
			activeSlide: 2,
		});
		state.awarenessChange?.();

		expect(collab.remotePresences.value).toHaveLength(1);
		expect(collab.remotePresences.value[0]).toMatchObject({
			clientId: 2,
			userName: 'Bob',
			selectionIds: ['el-9'],
			activeSlide: 2,
			cursor: undefined,
		});
		// Peers without a cursor are absent from the cursor projection.
		expect(collab.cursors.value).toHaveLength(0);

		scope.stop();
	});

	it('drives follow-mode from a followed peer active slide', async () => {
		state.mapValues.clear();
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		state.awarenessStates.set(2, {
			user: { name: 'Bob', color: '#00ff00' },
			activeSlide: 4,
		});
		state.awarenessChange?.();

		// Not following yet → null.
		expect(collab.followedSlideIndex.value).toBeNull();

		collab.followUser(2);
		expect(collab.followedClientId.value).toBe(2);
		expect(collab.followedSlideIndex.value).toBe(4);

		// The followed peer navigates; followedSlideIndex tracks it.
		state.awarenessStates.set(2, {
			user: { name: 'Bob', color: '#00ff00' },
			activeSlide: 7,
		});
		state.awarenessChange?.();
		expect(collab.followedSlideIndex.value).toBe(7);

		// The followed peer disconnects → follow target is dropped.
		state.awarenessStates.delete(2);
		state.awarenessChange?.();
		expect(collab.followedClientId.value).toBeNull();
		expect(collab.followedSlideIndex.value).toBeNull();

		// Explicitly stop following.
		collab.followUser(null);
		expect(collab.followedClientId.value).toBeNull();

		scope.stop();
	});

	it('broadcasts local slide changes and applies remote ones', async () => {
		state.mapValues.clear();
		state.awarenessStates.clear();
		const slides = ref<PptxSlide[]>([slide('1')]);
		const onRemoteSlides = vi.fn();
		const scope = effectScope();
		const collab = scope.run(() => useCollaboration({ slides, onRemoteSlides }))!;
		await collab.start(config);

		slides.value = [slide('1'), slide('2')];
		await Promise.resolve();
		expect(state.mapValues.get('slides')).toBeTypeOf('string');

		// Simulate a remote update.
		state.mapValues.set('slides', JSON.stringify([slide('9')]));
		state.mapObserver?.();
		expect(onRemoteSlides).toHaveBeenCalledWith([expect.objectContaining({ id: '9' })]);

		collab.stop();
		expect(collab.active.value).toBeFalsy();
		scope.stop();
	});
});
