/**
 * viewer-collaboration-session.service.test.ts: Unit tests for
 * `ViewerCollaborationSessionService.syncHostConfig`'s reference-dedup guard.
 *
 * The viewer effect that forwards the host `collaboration` input can re-run
 * with the SAME config object (Angular effects re-execute on unrelated signal
 * changes read inside the call). A repeat with the same reference must not
 * reconnect: a second provider join on the same Yjs room throws and tears down
 * the live session. A NEW object (or undefined) must still connect/disconnect,
 * and the explicit stop paths must clear the guard so stop + restart with the
 * same object works. Mirrors Vue's `useCollaborationWiring` config-reference
 * dedup.
 *
 * The service is constructed via `Injector.create` with a stubbed
 * `CollaborationService` (same pattern as `viewer-inspector-panel.service.test.ts`).
 */

import { Injector } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { CollaborationService } from './collaboration.service';
import type { CollaborationConfig } from './types';
import { ViewerCollaborationSessionService } from './viewer-collaboration-session.service';

interface CollabStub {
	connect: ReturnType<typeof vi.fn>;
	disconnect: ReturnType<typeof vi.fn>;
	seedBaseline: ReturnType<typeof vi.fn>;
}

function createSession(): { svc: ViewerCollaborationSessionService; collab: CollabStub } {
	const collab: CollabStub = {
		connect: vi.fn(async () => undefined),
		disconnect: vi.fn(),
		seedBaseline: vi.fn(),
	};
	const injector = Injector.create({
		providers: [
			{ provide: CollaborationService, useValue: collab as unknown as CollaborationService },
			{
				provide: ViewerCollaborationSessionService,
				useClass: ViewerCollaborationSessionService,
			},
		],
	});
	const svc = injector.get(ViewerCollaborationSessionService);
	svc.bind({
		authorName: () => 'Author',
		shareDefaults: () => undefined,
		getTemplateElements: () => ({}),
		applyRemoteSlides: () => undefined,
		canvasSize: () => ({ width: 960, height: 540 }),
		getSourceBytes: () => null,
		currentSlides: () => [],
		emitStart: () => undefined,
		emitStop: () => undefined,
	});
	return { svc, collab };
}

function makeConfig(): CollaborationConfig {
	return { roomId: 'room-1', serverUrl: '', transport: 'webrtc', userName: 'Tester' };
}

describe('viewerCollaborationSessionService syncHostConfig dedup', () => {
	it('connects once for repeated calls with the same config reference', () => {
		const { svc, collab } = createSession();
		const cfg = makeConfig();
		svc.syncHostConfig(cfg);
		svc.syncHostConfig(cfg);
		svc.syncHostConfig(cfg);
		expect(collab.connect).toHaveBeenCalledOnce();
		expect(collab.seedBaseline).toHaveBeenCalledOnce();
	});

	it('reconnects when a new config object arrives', () => {
		const { svc, collab } = createSession();
		svc.syncHostConfig(makeConfig());
		svc.syncHostConfig(makeConfig());
		expect(collab.connect).toHaveBeenCalledTimes(2);
	});

	it('disconnects on undefined and allows the same object to reconnect afterwards', () => {
		const { svc, collab } = createSession();
		const cfg = makeConfig();
		svc.syncHostConfig(cfg);
		svc.syncHostConfig(undefined);
		expect(collab.disconnect).toHaveBeenCalledOnce();
		svc.syncHostConfig(cfg);
		expect(collab.connect).toHaveBeenCalledTimes(2);
	});

	it('dedups a repeated undefined (no redundant disconnects)', () => {
		const { svc, collab } = createSession();
		svc.syncHostConfig(makeConfig());
		svc.syncHostConfig(undefined);
		svc.syncHostConfig(undefined);
		expect(collab.disconnect).toHaveBeenCalledOnce();
	});

	it('onShareStop clears the guard so the same config can restart the session', () => {
		const { svc, collab } = createSession();
		const cfg = makeConfig();
		svc.syncHostConfig(cfg);
		svc.onShareStop();
		expect(collab.disconnect).toHaveBeenCalledOnce();
		svc.syncHostConfig(cfg);
		expect(collab.connect).toHaveBeenCalledTimes(2);
	});
});
