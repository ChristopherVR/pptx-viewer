import { describe, expect, it, vi } from 'vitest';

import { createCollabProvider } from './collaboration-provider';

const { calls } = vi.hoisted(() => ({
	calls: {
		ws: [] as unknown[][],
		webrtc: [] as unknown[][],
	},
}));

vi.mock(import('y-websocket'), () => ({
	WebsocketProvider: class {
		awareness = { clientID: 1 };
		wsconnected = true;
		constructor(...args: unknown[]) {
			calls.ws.push(args);
		}
		on() {}
		disconnect() {}
		destroy() {}
	},
}));

vi.mock(import('y-webrtc'), () => ({
	WebrtcProvider: class {
		awareness = { clientID: 2 };
		constructor(...args: unknown[]) {
			calls.webrtc.push(args);
		}
		on() {}
		disconnect() {}
		destroy() {}
	},
}));

const doc = {} as ConstructorParameters<typeof import('y-websocket').WebsocketProvider>[2];

describe('createCollabProvider', () => {
	it('creates a y-websocket provider and reports its live connection state', async () => {
		calls.ws.length = 0;
		const handle = await createCollabProvider(
			'websocket',
			{ roomId: 'room', serverUrl: 'wss://x', userName: 'Ada', authToken: 'tok' },
			doc,
		);
		expect(calls.ws).toHaveLength(1);
		// (serverUrl, roomId, doc, { params: { token } })
		expect(calls.ws[0][0]).toBe('wss://x');
		expect(calls.ws[0][1]).toBe('room');
		expect(calls.ws[0][3]).toStrictEqual({ params: { token: 'tok' } });
		expect(handle.connectedNow).toBeTruthy();
	});

	it('creates a serverless y-webrtc provider with signaling + password options', async () => {
		calls.webrtc.length = 0;
		const handle = await createCollabProvider(
			'webrtc',
			{
				roomId: 'p2p',
				serverUrl: '',
				userName: 'Ada',
				authToken: 'secret',
				signaling: ['wss://sig.example'],
			},
			doc,
		);
		expect(calls.webrtc).toHaveLength(1);
		// (roomId, doc, { signaling, password })
		expect(calls.webrtc[0][0]).toBe('p2p');
		expect(calls.webrtc[0][2]).toStrictEqual({
			signaling: ['wss://sig.example'],
			password: 'secret',
		});
		// Same-browser tabs meet immediately, so report connected at once.
		expect(handle.connectedNow).toBeTruthy();
	});

	it('omits signaling when none is supplied (y-webrtc uses its defaults)', async () => {
		calls.webrtc.length = 0;
		await createCollabProvider('webrtc', { roomId: 'p2p', serverUrl: '', userName: 'Ada' }, doc);
		expect(calls.webrtc[0][2]).toStrictEqual({ signaling: undefined, password: undefined });
	});
});
