/**
 * collaboration.service.test.ts: Unit tests for the CollaborationService
 * connect() reentrancy guard.
 *
 * A guest can trigger a second connect() while the first is still awaiting the
 * dynamic transport import (e.g. the host config effect re-running when the
 * placeholder deck loads). Without the token guard, the second provider join on
 * the same room throws inside Yjs and the catch handler tears down the
 * surviving session. These tests mock the transport factories with manually
 * resolved promises so the interleaving is deterministic.
 *
 * The service is constructed via `Injector.create` with a stubbed `DestroyRef`
 * (same minimal-injection-context pattern as `print.service.test.ts`).
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

interface FakeBundle {
	bundle: ProviderBundle;
	doc: { destroy: ReturnType<typeof vi.fn> };
	provider: { disconnect: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
	departure: { announce: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> };
}

function makeBundle(): FakeBundle {
	const slidesArray = { observeDeep: vi.fn(), unobserveDeep: vi.fn(), length: 0 };
	const doc = { getArray: () => slidesArray, destroy: vi.fn() };
	const awareness: AwarenessLike = {
		clientID: 1,
		setLocalStateField: vi.fn(),
		getStates: () => new Map<number, Record<string, unknown>>(),
		on: vi.fn(),
		off: vi.fn(),
	};
	const provider = { awareness, disconnect: vi.fn(), destroy: vi.fn(), on: vi.fn() };
	const factories = {
		createMap: vi.fn(),
		createArray: vi.fn(),
		createText: vi.fn(),
	} as unknown as YjsFactories;
	const departure = { announce: vi.fn(), dispose: vi.fn() };
	return {
		bundle: {
			doc: doc as unknown as DestroyableYDoc,
			provider: provider as unknown as ProviderLike,
			awareness,
			factories,
			departure,
		},
		doc,
		provider,
		departure,
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

function config(roomId: string): CollaborationConfig {
	return { roomId, serverUrl: '', transport: 'webrtc', userName: 'Tester' };
}

describe('collaborationService connect reentrancy', () => {
	beforeEach(() => {
		mocks.pending.length = 0;
	});

	it('a superseding connect destroys the first bundle and keeps the second', async () => {
		const svc = createService();
		const first = svc.connect(config('room-1'));
		const second = svc.connect(config('room-1'));
		expect(mocks.pending).toHaveLength(2);

		const b1 = makeBundle();
		const b2 = makeBundle();
		mocks.pending[0].resolve(b1.bundle);
		mocks.pending[1].resolve(b2.bundle);
		await Promise.all([first, second]);

		// First (stale) bundle torn down without touching the newer session.
		expect(b1.provider.disconnect).toHaveBeenCalledWith();
		expect(b1.provider.destroy).toHaveBeenCalledWith();
		expect(b1.doc.destroy).toHaveBeenCalledWith();
		expect(b2.provider.destroy).not.toHaveBeenCalled();
		expect(b2.doc.destroy).not.toHaveBeenCalled();
		expect(svc.active()).toBeTruthy();
		expect(svc.status()).toBe('connected');
		svc.disconnect();
	});

	it('disconnect during a pending connect discards the created bundle', async () => {
		const svc = createService();
		const pendingConnect = svc.connect(config('room-2'));
		svc.disconnect();

		const b = makeBundle();
		mocks.pending[0].resolve(b.bundle);
		await pendingConnect;

		expect(b.provider.destroy).toHaveBeenCalledWith();
		expect(b.doc.destroy).toHaveBeenCalledWith();
		expect(svc.active()).toBeFalsy();
		expect(svc.status()).toBe('disconnected');
	});

	it('a rejected superseded connect leaves the newer session alone', async () => {
		const svc = createService();
		const first = svc.connect(config('room-3'));
		const second = svc.connect(config('room-3'));

		const b2 = makeBundle();
		mocks.pending[0].reject(new Error('transport import failed'));
		mocks.pending[1].resolve(b2.bundle);
		await Promise.all([first, second]);

		expect(svc.status()).toBe('connected');
		expect(svc.active()).toBeTruthy();
		expect(b2.provider.destroy).not.toHaveBeenCalled();
		svc.disconnect();
	});
});
