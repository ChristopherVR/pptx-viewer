import { describe, expect, it } from 'vitest';

import {
	assignUserColor,
	clampCursorPosition,
	derivePresenceList,
	formatCursorLabel,
	isMixedContentBlocked,
	isPresenceFresh,
	isValidRoomId,
	presenceToCursors,
	sanitizeAvatarUrl,
	sanitizeColor,
	sanitizePresence,
	sanitizeSlideIndex,
	sanitizeUserName,
	validateRoomId,
} from './collaboration-presence';

describe('collaboration-presence: room id', () => {
	it('accepts alphanumeric / hyphen / underscore tokens', () => {
		expect(isValidRoomId('room-1_A')).toBeTruthy();
		expect(validateRoomId('room-1_A')).toBe('room-1_A');
	});

	it('rejects empty, overlong, and unsafe room ids', () => {
		expect(isValidRoomId('')).toBeFalsy();
		expect(isValidRoomId('a'.repeat(129))).toBeFalsy();
		expect(isValidRoomId('room/../../etc')).toBeFalsy();
		expect(() => validateRoomId('bad room')).toThrow(/Invalid collaboration room ID/u);
	});
});

describe('collaboration-presence: scalar sanitisers', () => {
	it('strips HTML and clamps usernames', () => {
		expect(sanitizeUserName('<b>Ada</b>')).toBe('Ada');
		expect(sanitizeUserName('  ')).toBe('Anonymous');
		expect(sanitizeUserName(42)).toBe('Anonymous');
		expect(sanitizeUserName('x'.repeat(100))).toHaveLength(64);
	});

	it('validates hex colours and falls back', () => {
		// Build the unsafe scheme at runtime so the literal isn't a lint smell.
		const unsafeScheme = `${'java'}script:alert(1)`;
		expect(sanitizeColor('#abcdef')).toBe('#abcdef');
		expect(sanitizeColor('red')).toBe('#4c8bf5');
		expect(sanitizeColor(unsafeScheme, '#000000')).toBe('#000000');
	});

	it('allows only http(s)/data avatar urls', () => {
		const unsafeUrl = `${'java'}script:alert(1)`;
		expect(sanitizeAvatarUrl('https://x/a.png')).toBe('https://x/a.png');
		expect(sanitizeAvatarUrl('data:image/png;base64,AAAA')).toMatch(/^data:/u);
		expect(sanitizeAvatarUrl(unsafeUrl)).toBeUndefined();
		expect(sanitizeAvatarUrl(123)).toBeUndefined();
	});

	it('coerces slide index and clamps cursor positions', () => {
		expect(sanitizeSlideIndex(3.9)).toBe(3);
		expect(sanitizeSlideIndex(-2)).toBe(0);
		expect(sanitizeSlideIndex('x')).toBe(0);
		// 20px margin allowed outside bounds.
		expect(clampCursorPosition(5000, 0, 100)).toBe(120);
		expect(clampCursorPosition(-100, 0, 100)).toBe(-20);
		expect(clampCursorPosition(Number.NaN, 0, 100)).toBe(0);
	});
});

describe('collaboration-presence: mixed content', () => {
	it('blocks ws:// from an https page except loopback', () => {
		expect(isMixedContentBlocked('ws://example.com', 'https:')).toBeTruthy();
		expect(isMixedContentBlocked('ws://localhost:1234', 'https:')).toBeFalsy();
		expect(isMixedContentBlocked('wss://example.com', 'https:')).toBeFalsy();
		expect(isMixedContentBlocked('ws://example.com', 'http:')).toBeFalsy();
		expect(isMixedContentBlocked('not a url', 'https:')).toBeFalsy();
	});
});

describe('collaboration-presence: colour + label', () => {
	it('assigns a stable colour per seed', () => {
		expect(assignUserColor('ada')).toBe(assignUserColor('ada'));
	});

	it('truncates long labels with an ellipsis', () => {
		expect(formatCursorLabel('short')).toBe('short');
		const long = formatCursorLabel('a really really long name', 10);
		expect([...long]).toHaveLength(10);
		expect(long.endsWith('...')).toBeTruthy();
	});
});

describe('collaboration-presence: presence derivation', () => {
	const fresh = new Date().toISOString();

	it('sanitises a raw presence record', () => {
		const out = sanitizePresence(
			{
				clientId: 7,
				userName: '<i>Bob</i>',
				userColor: '#ffffff',
				activeSlideIndex: 2.7,
				cursorX: 99999,
				cursorY: 10,
				role: 'viewer',
				lastUpdated: fresh,
			},
			100,
			100,
		);
		expect(out).toMatchObject({
			clientId: 7,
			userName: 'Bob',
			userColor: '#ffffff',
			activeSlideIndex: 2,
			cursorX: 120,
			role: 'viewer',
		});
	});

	it('returns null without a numeric client id', () => {
		expect(sanitizePresence({ userName: 'x' }, 100, 100)).toBeNull();
	});

	it('drops stale entries and the local client', () => {
		const now = Date.now();
		const states = new Map<number, Record<string, unknown>>([
			[1, { presence: { userName: 'self', lastUpdated: new Date(now).toISOString() } }],
			[2, { presence: { userName: 'fresh', lastUpdated: new Date(now).toISOString() } }],
			[3, { presence: { userName: 'stale', lastUpdated: new Date(now - 60_000).toISOString() } }],
		]);
		const list = derivePresenceList(states, 1, 800, 600, now);
		expect(list.map((p) => p.userName)).toStrictEqual(['fresh']);
		expect(isPresenceFresh(new Date(now - 60_000).toISOString(), now)).toBeFalsy();
	});

	it('projects presence into cursors filtered by slide', () => {
		const presence = [
			sanitizePresence(
				{ clientId: 2, cursorX: 5, cursorY: 6, activeSlideIndex: 0, lastUpdated: fresh },
				800,
				600,
			)!,
			sanitizePresence(
				{ clientId: 3, cursorX: 7, cursorY: 8, activeSlideIndex: 1, lastUpdated: fresh },
				800,
				600,
			)!,
		];
		expect(presenceToCursors(presence, 0)).toHaveLength(1);
		expect(presenceToCursors(presence)).toHaveLength(2);
	});
});
