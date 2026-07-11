import { describe, expect, it } from 'vitest';

import { buildBroadcastSessionConfig } from './broadcast-helpers';

describe('buildBroadcastSessionConfig', () => {
	it('assembles an owner-role session from a validated broadcast config', () => {
		const session = buildBroadcastSessionConfig(
			{ roomId: 'r1', serverUrl: 'ws://x', transport: 'websocket' },
			'Ada',
		);
		expect(session).toStrictEqual({
			roomId: 'r1',
			serverUrl: 'ws://x',
			transport: 'websocket',
			userName: 'Ada',
			role: 'owner',
		});
	});

	it('trims the presenter name', () => {
		const session = buildBroadcastSessionConfig({ roomId: 'r1', serverUrl: '' }, '  Ada  ');
		expect(session.userName).toBe('Ada');
	});

	it('falls back to the default presenter name when blank or absent', () => {
		expect(buildBroadcastSessionConfig({ roomId: 'r1', serverUrl: '' }, undefined).userName).toBe(
			'Presenter',
		);
		expect(buildBroadcastSessionConfig({ roomId: 'r1', serverUrl: '' }, '   ').userName).toBe(
			'Presenter',
		);
	});
});
