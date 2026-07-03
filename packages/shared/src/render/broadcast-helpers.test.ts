/**
 * broadcast-helpers.test.ts: unit tests for the shared Broadcast-dialog
 * helpers (room-id generation, start config, viewer-link building, clipboard
 * detection). Pure helpers, no framework.
 */

import { describe, expect, it } from 'vitest';

import {
	DEFAULT_BROADCAST_SERVER_URL,
	buildBroadcastConfig,
	buildBroadcastViewerUrl,
	canStartBroadcast,
	canUseClipboard,
	generateBroadcastRoomId,
	resolveTransportForServerUrl,
	seedBroadcastFields,
} from './broadcast-helpers';

describe('generateBroadcastRoomId', () => {
	it('produces a "broadcast-<suffix>" id', () => {
		expect(generateBroadcastRoomId()).toMatch(/^broadcast-[a-z0-9]+$/u);
	});

	it('produces distinct ids across calls', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 50; i++) {
			ids.add(generateBroadcastRoomId());
		}
		expect(ids.size).toBeGreaterThan(1);
	});
});

describe('seedBroadcastFields', () => {
	it('uses the supplied defaults verbatim', () => {
		const fields = seedBroadcastFields({
			roomId: 'broadcast-fixed',
			serverUrl: 'ws://example.test:1234',
		});
		expect(fields).toStrictEqual({
			roomId: 'broadcast-fixed',
			serverUrl: 'ws://example.test:1234',
		});
	});

	it('auto-generates a room id and falls back to the default server', () => {
		const fields = seedBroadcastFields();
		expect(fields.roomId).toMatch(/^broadcast-[a-z0-9]+$/u);
		expect(fields.serverUrl).toBe(DEFAULT_BROADCAST_SERVER_URL);
	});
});

describe('resolveTransportForServerUrl', () => {
	it('maps a blank server URL to webrtc and anything else to websocket', () => {
		expect(resolveTransportForServerUrl('')).toBe('webrtc');
		expect(resolveTransportForServerUrl('   ')).toBe('webrtc');
		expect(resolveTransportForServerUrl('ws://s')).toBe('websocket');
		expect(resolveTransportForServerUrl('wss://collab.example.com')).toBe('websocket');
	});
});

describe('canStartBroadcast', () => {
	it('requires a room id; a blank server URL is allowed (P2P)', () => {
		expect(canStartBroadcast({ roomId: 'r', serverUrl: 'ws://s' })).toBeTruthy();
		expect(canStartBroadcast({ roomId: '', serverUrl: 'ws://s' })).toBeFalsy();
		expect(canStartBroadcast({ roomId: 'r', serverUrl: '  ' })).toBeTruthy();
	});
});

describe('buildBroadcastConfig', () => {
	it('assembles a trimmed config with the derived transport', () => {
		expect(buildBroadcastConfig({ roomId: '  room  ', serverUrl: '  ws://s  ' })).toStrictEqual({
			roomId: 'room',
			serverUrl: 'ws://s',
			transport: 'websocket',
		});
	});

	it('selects the webrtc transport when the server URL is blank', () => {
		expect(buildBroadcastConfig({ roomId: 'room', serverUrl: '  ' })).toStrictEqual({
			roomId: 'room',
			serverUrl: '',
			transport: 'webrtc',
		});
	});

	it('returns null when incomplete', () => {
		expect(buildBroadcastConfig({ roomId: '', serverUrl: 'ws://s' })).toBeNull();
	});
});

describe('buildBroadcastViewerUrl', () => {
	it('builds a ?broadcast=&server= link from a location', () => {
		const url = buildBroadcastViewerUrl('room-1', 'ws://x', {
			origin: 'https://app.test',
			pathname: '/',
		});
		expect(url).toBe('https://app.test/?broadcast=room-1&server=ws%3A%2F%2Fx');
	});

	it('builds a ?broadcast=&transport=webrtc link when the server URL is blank', () => {
		const url = buildBroadcastViewerUrl('room-1', '  ', {
			origin: 'https://app.test',
			pathname: '/',
		});
		expect(url).toBe('https://app.test/?broadcast=room-1&transport=webrtc');
	});

	it('falls back to the room id without a location', () => {
		expect(buildBroadcastViewerUrl('room-1', 'ws://x')).toBe('room-1');
	});
});

describe('canUseClipboard', () => {
	it('is true when navigator.clipboard.writeText exists', () => {
		const nav = { clipboard: { writeText: () => Promise.resolve() } } as unknown as Navigator;
		expect(canUseClipboard(nav)).toBeTruthy();
	});

	it('is false when clipboard or navigator is unavailable', () => {
		expect(canUseClipboard(undefined)).toBeFalsy();
		expect(canUseClipboard({} as Navigator)).toBeFalsy();
	});
});
