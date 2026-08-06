/**
 * Performance contract for the Angular collaboration service (issue #145 class).
 *
 * `signal.set` notifies on every call with a fresh array (signals compare with
 * `Object.is`), and awareness fires on every peer heartbeat, so the `presence`
 * signal used to change identity on a fixed interval. Everything derived from
 * it (`cursors`, `connectedCount`, `followedSlideIndex`, `broadcasterSlideIndex`
 * and the overlay that reads them) recomputed each time in an idle room.
 *
 * The assertion is on REFERENCE IDENTITY of the signal value, which is exactly
 * what decides whether a downstream `computed` re-runs.
 */

import { DestroyRef, Injector } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollaborationConfig, YjsFactories } from '../internal/shared';
import type {
	AwarenessLike,
	DestroyableYDoc,
	ProviderBundle,
	ProviderLike,
} from './collaboration-providers';
import { CollaborationService } from './collaboration.service';

const PEER_ID = 2;

const mocks = vi.hoisted(() => {
	const pending: Array<{
		resolve: (bundle: ProviderBundle) => void;
		reject: (error: unknown) => void;
	}> = [];
	return { pending };
});

vi.mock(import('./collaboration-providers'), () => {
	const defer = (): Promise<ProviderBundle> =>
		new Promise((resolve, reject) => {
			mocks.pending.push({ resolve, reject });
		});
	return {
		createWebrtcBundle: defer,
		createWebsocketBundle: defer,
	};
});

/** A bundle whose awareness keeps a real listener registry and state map. */
function makeLiveBundle() {
	const states = new Map<number, Record<string, unknown>>();
	const listeners = new Set<() => void>();
	const awareness: AwarenessLike = {
		clientID: 1,
		setLocalStateField: vi.fn(),
		getStates: () => states,
		on: (_event: string, cb: () => void) => {
			listeners.add(cb);
		},
		off: (_event: string, cb: () => void) => {
			listeners.delete(cb);
		},
	};
	const slidesArray = { observeDeep: vi.fn(), unobserveDeep: vi.fn(), length: 0 };
	const doc = { getArray: () => slidesArray, destroy: vi.fn() };
	const provider = { awareness, disconnect: vi.fn(), destroy: vi.fn(), on: vi.fn() };
	return {
		bundle: {
			doc: doc as unknown as DestroyableYDoc,
			provider: provider as unknown as ProviderLike,
			awareness,
			factories: {
				createMap: vi.fn(),
				createArray: vi.fn(),
				createText: vi.fn(),
			} as unknown as YjsFactories,
			departure: { announce: vi.fn(), dispose: vi.fn() },
		} satisfies ProviderBundle,
		states,
		emit: () => listeners.forEach((cb) => cb()),
		emitPeer(overrides: Record<string, unknown> = {}) {
			states.set(PEER_ID, {
				presence: {
					userName: 'Grace',
					userColor: '#22c55e',
					activeSlideIndex: 0,
					cursorX: 100,
					cursorY: 200,
					lastUpdated: new Date().toISOString(),
					...overrides,
				},
			});
			listeners.forEach((cb) => cb());
		},
	};
}

function createService(): CollaborationService {
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: { onDestroy: () => () => undefined } as DestroyRef },
			{ provide: CollaborationService, useClass: CollaborationService },
		],
	});
	return injector.get(CollaborationService);
}

const config: CollaborationConfig = {
	roomId: 'perf-room',
	serverUrl: '',
	transport: 'webrtc',
	userName: 'Tester',
};

async function connected() {
	const svc = createService();
	const pendingConnect = svc.connect(config, { canvasWidth: 960, canvasHeight: 540 });
	const live = makeLiveBundle();
	mocks.pending[0].resolve(live.bundle);
	await pendingConnect;
	return { svc, live };
}

describe('angular presence signal cost (issue #145)', () => {
	beforeEach(() => {
		mocks.pending.length = 0;
	});

	it('keeps the same presence array across peer heartbeats', async () => {
		const { svc, live } = await connected();

		live.emitPeer();
		const afterJoin = svc.presence();
		expect(afterJoin).toHaveLength(1);

		for (let beat = 0; beat < 10; beat += 1) {
			live.emitPeer({ lastUpdated: new Date(Date.now() + beat * 1000).toISOString() });
		}

		expect(svc.presence()).toBe(afterJoin);
		svc.disconnect();
	});

	it('adopts a new array when a peer moves', async () => {
		const { svc, live } = await connected();

		live.emitPeer();
		const afterJoin = svc.presence();

		live.emitPeer({ cursorX: 400 });

		expect(svc.presence()).not.toBe(afterJoin);
		expect(svc.presence()[0]?.cursorX).toBe(400);
		svc.disconnect();
	});

	it('adopts a new array when a peer leaves', async () => {
		const { svc, live } = await connected();

		live.emitPeer();
		const afterJoin = svc.presence();

		live.states.delete(PEER_ID);
		live.emit();

		expect(svc.presence()).not.toBe(afterJoin);
		expect(svc.presence()).toHaveLength(0);
		svc.disconnect();
	});
});
