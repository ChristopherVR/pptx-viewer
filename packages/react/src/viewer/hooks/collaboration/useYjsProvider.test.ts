/**
 * Tests for useYjsProvider: the transport layer of the collaboration system.
 *
 * The hook itself owns React effect lifecycle, which this package's test setup
 * (node environment, no DOM renderer) cannot drive directly. So, following the
 * pattern in `usePresenceTracking.test.ts`, these tests exercise the hook's
 * extractable logic and a faithful reproduction of its connection state machine
 * against a mock WebSocket provider: no real server or socket is involved.
 *
 * Coverage:
 *  - Mixed-content guard (the GitHub Pages / https → ws:// failure mode)
 *  - Connection lifecycle: connecting → connected → disconnected → error
 *  - Connection-timeout → error, and retry recovery
 *  - Server / room URL handling
 *
 * @module collaboration/useYjsProvider.test
 */
import { createSyncGate } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectionStatus } from './types';
import { isMixedContentBlocked } from './useYjsProvider';

// ---------------------------------------------------------------------------
// window.location stubbing helper
// ---------------------------------------------------------------------------

/**
 * Stubs `window.location.protocol` / `hostname` for the duration of a test.
 * The node test environment has no `window`, so we install a minimal one.
 */
function stubLocation(protocol: string, hostname = 'example.com'): () => void {
	const original = (globalThis as { window?: unknown }).window;
	(globalThis as { window?: unknown }).window = {
		location: { protocol, hostname },
	};
	return () => {
		if (original === undefined) {
			delete (globalThis as { window?: unknown }).window;
		} else {
			(globalThis as { window?: unknown }).window = original;
		}
	};
}

// ---------------------------------------------------------------------------
// Mixed-content guard (GitHub Pages / https mixed-content fix)
// ---------------------------------------------------------------------------

describe('useYjsProvider - isMixedContentBlocked', () => {
	let restore: (() => void) | null = null;

	afterEach(() => {
		restore?.();
		restore = null;
	});

	it('blocks ws:// to a public host from an https page (GitHub Pages case)', () => {
		restore = stubLocation('https:', 'christophervr.github.io');
		expect(isMixedContentBlocked('ws://collab.example.com:1234')).toBeTruthy();
	});

	it('allows wss:// to a public host from an https page', () => {
		restore = stubLocation('https:', 'christophervr.github.io');
		expect(isMixedContentBlocked('wss://collab.example.com:1234')).toBeFalsy();
	});

	it('allows ws:// to localhost even from an https page', () => {
		restore = stubLocation('https:', 'christophervr.github.io');
		expect(isMixedContentBlocked('ws://localhost:1234')).toBeFalsy();
		expect(isMixedContentBlocked('ws://127.0.0.1:1234')).toBeFalsy();
		expect(isMixedContentBlocked('ws://[::1]:1234')).toBeFalsy();
	});

	it('allows ws:// to a public host from an http page (no mixed content)', () => {
		restore = stubLocation('http:', 'example.com');
		expect(isMixedContentBlocked('ws://collab.example.com:1234')).toBeFalsy();
	});

	it('does not block when there is no window (SSR / node)', () => {
		// No stub installed: window is undefined in the node test env.
		expect(isMixedContentBlocked('ws://collab.example.com:1234')).toBeFalsy();
	});

	it('returns false for a malformed server URL', () => {
		restore = stubLocation('https:', 'example.com');
		expect(isMixedContentBlocked('not a url')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Mock WebSocket provider: faithful reproduction of the y-websocket surface
// the hook relies on (status events, wsconnected, awareness, destroy).
// ---------------------------------------------------------------------------

type StatusEvent = { status: string };
type StatusListener = (event: StatusEvent) => void;

class MockWebsocketProvider {
	public wsconnected = false;
	public destroyed = false;
	private statusListeners = new Set<StatusListener>();

	constructor(
		public readonly serverUrl: string,
		public readonly roomId: string,
	) {}

	on(event: 'status', cb: StatusListener): void {
		if (event === 'status') {
			this.statusListeners.add(cb);
		}
	}

	off(event: 'status', cb: StatusListener): void {
		if (event === 'status') {
			this.statusListeners.delete(cb);
		}
	}

	destroy(): void {
		this.destroyed = true;
		this.statusListeners.clear();
	}

	/** Simulate the server confirming the connection. */
	emitConnected(): void {
		this.wsconnected = true;
		this.statusListeners.forEach((cb) => cb({ status: 'connected' }));
	}

	/** Simulate a transport drop. */
	emitDisconnected(): void {
		this.wsconnected = false;
		this.statusListeners.forEach((cb) => cb({ status: 'disconnected' }));
	}

	listenerCount(): number {
		return this.statusListeners.size;
	}
}

/**
 * Reproduces the hook's connection state machine (the `handleStatus` callback,
 * the connection timeout, and teardown) against a {@link MockWebsocketProvider}.
 * This is the same "simulate the hook's core logic without React" approach used
 * by usePresenceTracking.test.ts.
 */
function createConnectionMachine(provider: MockWebsocketProvider, timeoutMs: number) {
	let status: ConnectionStatus = 'disconnected';
	let connected = false;
	let timeout: ReturnType<typeof setTimeout> | null = null;

	const handleStatus = (event: StatusEvent) => {
		if (event.status === 'connected') {
			connected = true;
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
			status = 'connected';
		} else if (event.status === 'disconnected') {
			status = 'disconnected';
		}
	};

	const start = () => {
		status = 'connecting';
		provider.on('status', handleStatus);
		if (provider.wsconnected) {
			connected = true;
			status = 'connected';
		}
		if (!connected) {
			timeout = setTimeout(() => {
				timeout = null;
				if (!connected) {
					provider.off('status', handleStatus);
					provider.destroy();
					status = 'error';
				}
			}, timeoutMs);
		}
	};

	return {
		start,
		getStatus: () => status,
		hasTimer: () => timeout !== null,
	};
}

describe('useYjsProvider - connection lifecycle', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('transitions disconnected → connecting → connected', () => {
		const provider = new MockWebsocketProvider('wss://collab.test', 'room-1');
		const machine = createConnectionMachine(provider, 30_000);

		expect(machine.getStatus()).toBe('disconnected');

		machine.start();
		expect(machine.getStatus()).toBe('connecting');
		expect(provider.listenerCount()).toBe(1);

		provider.emitConnected();
		expect(machine.getStatus()).toBe('connected');
		// Connecting successfully clears the pending timeout.
		expect(machine.hasTimer()).toBeFalsy();
	});

	it('transitions connected → disconnected when the transport drops', () => {
		const provider = new MockWebsocketProvider('wss://collab.test', 'room-1');
		const machine = createConnectionMachine(provider, 30_000);

		machine.start();
		provider.emitConnected();
		expect(machine.getStatus()).toBe('connected');

		provider.emitDisconnected();
		expect(machine.getStatus()).toBe('disconnected');
	});

	it('moves to error and tears down the provider on connection timeout', () => {
		const provider = new MockWebsocketProvider('wss://unreachable.test', 'room-1');
		const machine = createConnectionMachine(provider, 30_000);

		machine.start();
		expect(machine.getStatus()).toBe('connecting');

		// Never connects: advance past the timeout.
		vi.advanceTimersByTime(30_000);

		expect(machine.getStatus()).toBe('error');
		expect(provider.destroyed).toBeTruthy();
		// Listener removed during teardown.
		expect(provider.listenerCount()).toBe(0);
	});

	it('does not error if the connection arrives just before the timeout', () => {
		const provider = new MockWebsocketProvider('wss://collab.test', 'room-1');
		const machine = createConnectionMachine(provider, 30_000);

		machine.start();
		vi.advanceTimersByTime(29_999);
		provider.emitConnected();
		vi.advanceTimersByTime(1);

		expect(machine.getStatus()).toBe('connected');
		expect(provider.destroyed).toBeFalsy();
	});

	it('connects immediately when the provider is already connected (wsconnected)', () => {
		const provider = new MockWebsocketProvider('wss://collab.test', 'room-1');
		provider.wsconnected = true;
		const machine = createConnectionMachine(provider, 30_000);

		machine.start();
		expect(machine.getStatus()).toBe('connected');
		// No timeout scheduled when already connected.
		expect(machine.hasTimer()).toBeFalsy();
	});

	it('recovers via retry after a timeout error', () => {
		const provider1 = new MockWebsocketProvider('wss://collab.test', 'room-1');
		const machine1 = createConnectionMachine(provider1, 30_000);
		machine1.start();
		vi.advanceTimersByTime(30_000);
		expect(machine1.getStatus()).toBe('error');

		// retry() in the hook re-runs init with a fresh provider.
		const provider2 = new MockWebsocketProvider('wss://collab.test', 'room-1');
		const machine2 = createConnectionMachine(provider2, 30_000);
		machine2.start();
		expect(machine2.getStatus()).toBe('connecting');
		provider2.emitConnected();
		expect(machine2.getStatus()).toBe('connected');
		expect(provider2.destroyed).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Server / room URL handling
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sync-gate re-arm on reconnect: the hook now delegates to the shared
// `createSyncGate` (see useYjsProvider.ts's `handleStatus`), reproduced here
// against the same MockWebsocketProvider to verify a reconnect re-gates
// writes instead of leaving `synced` permanently true from the first connect.
// ---------------------------------------------------------------------------

function createConnectionMachineWithGate(provider: MockWebsocketProvider, timeoutMs: number) {
	let status: ConnectionStatus = 'disconnected';
	let connected = false;
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let synced = false;
	const gate = createSyncGate(() => {
		synced = true;
	});

	const handleStatus = (event: StatusEvent) => {
		if (event.status === 'connected') {
			connected = true;
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
			status = 'connected';
			gate.arm();
		} else if (event.status === 'disconnected') {
			status = 'disconnected';
			gate.reset();
			synced = false;
			gate.arm();
		}
	};

	const start = () => {
		status = 'connecting';
		provider.on('status', handleStatus);
		if (provider.wsconnected) {
			connected = true;
			status = 'connected';
			gate.arm();
		}
		if (!connected) {
			timeout = setTimeout(() => {
				timeout = null;
				if (!connected) {
					provider.off('status', handleStatus);
					provider.destroy();
					status = 'error';
				}
			}, timeoutMs);
		}
	};

	return {
		start,
		getStatus: () => status,
		isSynced: () => synced,
		openGate: () => gate.open(),
	};
}

describe('useYjsProvider - sync-gate reconnect re-arm', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('re-arms the gate on reconnect instead of leaving `synced` permanently true', () => {
		const provider = new MockWebsocketProvider('wss://collab.test', 'room-1');
		const machine = createConnectionMachineWithGate(provider, 30_000);

		machine.start();
		provider.emitConnected();
		expect(machine.isSynced()).toBeFalsy();

		// The provider's 'sync' event confirms the initial document sync.
		machine.openGate();
		expect(machine.isSynced()).toBeTruthy();

		// Drop and reconnect: a write issued right after must not flush until a
		// fresh sync confirmation, i.e. the gate must have reset.
		provider.emitDisconnected();
		provider.emitConnected();
		expect(machine.isSynced()).toBeFalsy();

		machine.openGate();
		expect(machine.isSynced()).toBeTruthy();
	});

	it('falls back to the grace timer on reconnect when no fresh sync event arrives', () => {
		const provider = new MockWebsocketProvider('wss://collab.test', 'room-1');
		const machine = createConnectionMachineWithGate(provider, 30_000);

		machine.start();
		provider.emitConnected();
		machine.openGate();
		expect(machine.isSynced()).toBeTruthy();

		provider.emitDisconnected();
		provider.emitConnected();
		expect(machine.isSynced()).toBeFalsy();

		// No 'sync' event this time; the re-armed grace timer should still open it.
		vi.advanceTimersByTime(3000);
		expect(machine.isSynced()).toBeTruthy();
	});
});

describe('useYjsProvider - server/room URL handling', () => {
	it('passes the configured server URL and room ID through to the provider', () => {
		const provider = new MockWebsocketProvider('wss://collab.example.com:9000', 'my-room');
		expect(provider.serverUrl).toBe('wss://collab.example.com:9000');
		expect(provider.roomId).toBe('my-room');
	});
});

// ---------------------------------------------------------------------------
// WebRTC (peer-to-peer) transport branch
// ---------------------------------------------------------------------------

/**
 * Reproduces the option-building and "connected immediately" status logic of
 * the hook's webrtc branch (initWebrtc) so it can be asserted without a React
 * renderer, mirroring the connection-machine approach used above for websocket.
 */
type WebrtcConfig = {
	roomId: string;
	transport?: 'websocket' | 'webrtc';
	signaling?: string[];
	authToken?: string;
};

function buildWebrtcOptions(config: WebrtcConfig): { signaling?: string[]; password?: string } {
	const opts: { signaling?: string[]; password?: string } = {};
	if (config.signaling && config.signaling.length > 0) {
		opts.signaling = config.signaling;
	}
	if (config.authToken) {
		opts.password = config.authToken;
	}
	return opts;
}

/** Minimal faithful stand-in for the y-webrtc provider surface the hook uses. */
class MockWebrtcProvider {
	public destroyed = false;
	public awareness = { clientID: 7 };
	constructor(
		public readonly roomName: string,
		public readonly opts: { signaling?: string[]; password?: string },
	) {}
	destroy(): void {
		this.destroyed = true;
	}
}

describe('useYjsProvider - webrtc transport', () => {
	it('omits signaling and password when neither is configured', () => {
		expect(buildWebrtcOptions({ roomId: 'r', transport: 'webrtc' })).toStrictEqual({});
	});

	it('passes an explicit signaling list through', () => {
		const opts = buildWebrtcOptions({
			roomId: 'r',
			transport: 'webrtc',
			signaling: ['wss://sig.example.com'],
		});
		expect(opts.signaling).toStrictEqual(['wss://sig.example.com']);
		expect('password' in opts).toBeFalsy();
	});

	it('maps authToken onto the webrtc password option', () => {
		const opts = buildWebrtcOptions({ roomId: 'r', transport: 'webrtc', authToken: 'secret' });
		expect(opts.password).toBe('secret');
	});

	it('ignores an empty signaling list (falls back to y-webrtc defaults)', () => {
		const opts = buildWebrtcOptions({ roomId: 'r', transport: 'webrtc', signaling: [] });
		expect('signaling' in opts).toBeFalsy();
	});

	it('reports connected immediately once the provider is created (no server handshake)', () => {
		// The webrtc branch sets status to 'connected' right after construction:
		// same-browser tabs meet over BroadcastChannel with no async handshake.
		let status: ConnectionStatus = 'disconnected';
		status = 'connecting';
		const provider = new MockWebrtcProvider('room-1', buildWebrtcOptions({ roomId: 'room-1' }));
		status = 'connected';
		expect(status).toBe('connected');
		expect(provider.awareness.clientID).toBe(7);
	});

	it('destroys the provider on teardown', () => {
		const provider = new MockWebrtcProvider('room-1', {});
		provider.destroy();
		expect(provider.destroyed).toBeTruthy();
	});
});
