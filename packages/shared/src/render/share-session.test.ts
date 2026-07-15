import { describe, expect, it } from 'vitest';

import {
	buildCollaborationShareUrl,
	buildCreateCollaborationConfig,
	buildJoinCollaborationConfig,
} from './share-session';

describe('share session helpers', () => {
	it('builds an explicitly created websocket session', () => {
		expect(
			buildCreateCollaborationConfig({
				roomId: 'team-room',
				userName: ' Ada ',
				serverUrl: ' wss://x ',
			}),
		).toMatchObject({
			roomId: 'team-room',
			userName: 'Ada',
			serverUrl: 'wss://x',
			transport: 'websocket',
			sessionIntent: 'create',
		});
	});

	it('joins a URL created by another binding and preserves WebRTC signaling', () => {
		const config = buildJoinCollaborationConfig({
			invitation:
				'https://react.example/viewer?room=deck-1&transport=webrtc&signaling=wss%3A%2F%2Fa%2Cwss%3A%2F%2Fb',
			userName: 'Grace',
			serverUrl: 'wss://fallback',
		});
		expect(config).toStrictEqual({
			roomId: 'deck-1',
			userName: 'Grace',
			serverUrl: '',
			transport: 'webrtc',
			signaling: ['wss://a', 'wss://b'],
			role: 'collaborator',
			sessionIntent: 'join',
		});
	});

	it('joins a bare room with the local default server', () => {
		expect(
			buildJoinCollaborationConfig({
				invitation: 'deck_2',
				userName: 'Lin',
				serverUrl: 'wss://vue.example',
			}),
		).toMatchObject({ roomId: 'deck_2', serverUrl: 'wss://vue.example', sessionIntent: 'join' });
	});

	it('rejects invalid or broadcast invitations', () => {
		expect(
			buildJoinCollaborationConfig({ invitation: 'bad room', userName: 'Lin', serverUrl: '' }),
		).toBeNull();
		expect(
			buildJoinCollaborationConfig({
				invitation: 'https://x.test/?broadcast=room-1',
				userName: 'Lin',
				serverUrl: '',
			}),
		).toBeNull();
	});

	it('round-trips a websocket invitation independently of its host app', () => {
		const link = buildCollaborationShareUrl(
			{ roomId: 'deck-3', serverUrl: 'wss://relay.example', transport: 'websocket' },
			{ origin: 'https://angular.example', pathname: '/viewer' },
		);
		expect(
			buildJoinCollaborationConfig({ invitation: link, userName: 'Sam', serverUrl: '' }),
		).toMatchObject({ roomId: 'deck-3', serverUrl: 'wss://relay.example', sessionIntent: 'join' });
	});
});
