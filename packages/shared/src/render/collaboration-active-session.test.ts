import { describe, expect, it } from 'vitest';

import { buildActiveSessionUsers, getUserInitials } from './collaboration-active-session';
import type { SanitizedPresence } from './collaboration-presence';

function presence(overrides: Partial<SanitizedPresence> = {}): SanitizedPresence {
	return {
		clientId: 42,
		userName: 'Grace Hopper',
		userColor: '#22c55e',
		activeSlideIndex: 2,
		cursorX: 0,
		cursorY: 0,
		lastUpdated: new Date().toISOString(),
		...overrides,
	};
}

describe('collaboration-active-session: getUserInitials', () => {
	it('takes first + last initial for a multi-word name', () => {
		expect(getUserInitials('Grace Hopper')).toBe('GH');
		expect(getUserInitials('Ada Augusta Lovelace')).toBe('AL');
	});

	it('falls back to the first two characters for a single word', () => {
		expect(getUserInitials('Ada')).toBe('AD');
	});

	it('trims surrounding whitespace before splitting', () => {
		expect(getUserInitials('  Grace Hopper  ')).toBe('GH');
	});
});

describe('collaboration-active-session: buildActiveSessionUsers', () => {
	it('puts the local user first, using the default colour when none is given', () => {
		const users = buildActiveSessionUsers({ localUserName: 'Ada Lovelace', remoteUsers: [] });
		expect(users).toStrictEqual([
			{
				id: 'local',
				name: 'Ada Lovelace',
				initials: 'AL',
				color: '#6366f1',
				isLocal: true,
			},
		]);
	});

	it('appends remote users in their existing order with a 1-based slide number', () => {
		const users = buildActiveSessionUsers({
			localUserName: 'Ada Lovelace',
			localUserColor: '#f97316',
			remoteUsers: [
				presence({ clientId: 1, userName: 'Grace Hopper', activeSlideIndex: 0 }),
				presence({ clientId: 2, userName: 'Katherine Johnson', activeSlideIndex: 4 }),
			],
		});
		expect(users).toStrictEqual([
			{ id: 'local', name: 'Ada Lovelace', initials: 'AL', color: '#f97316', isLocal: true },
			{
				id: '1',
				name: 'Grace Hopper',
				initials: 'GH',
				color: '#22c55e',
				avatarUrl: undefined,
				isLocal: false,
				slideNumber: 1,
			},
			{
				id: '2',
				name: 'Katherine Johnson',
				initials: 'KJ',
				color: '#22c55e',
				avatarUrl: undefined,
				isLocal: false,
				slideNumber: 5,
			},
		]);
	});

	it('carries the remote avatar URL through when present', () => {
		const users = buildActiveSessionUsers({
			localUserName: 'Ada',
			remoteUsers: [presence({ userAvatar: 'https://example.com/a.png' })],
		});
		expect(users[1]?.avatarUrl).toBe('https://example.com/a.png');
	});
});
