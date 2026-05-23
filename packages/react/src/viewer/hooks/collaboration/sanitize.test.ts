/**
 * Tests for collaboration sanitization utilities.
 */
import { describe, it, expect } from 'vitest';

import {
	validateRoomId,
	sanitizeUserName,
	clampCursorPosition,
	sanitizeColor,
	sanitizeAvatarUrl,
	sanitizeSlideIndex,
	sanitizePresence,
} from './sanitize';

// ---------------------------------------------------------------------------
// validateRoomId
// ---------------------------------------------------------------------------

describe('validateRoomId', () => {
	it('accepts valid alphanumeric room IDs', () => {
		expect(validateRoomId('room-123')).toBe('room-123');
		expect(validateRoomId('my_room_456')).toBe('my_room_456');
		expect(validateRoomId('AbCdEf')).toBe('AbCdEf');
	});

	it('accepts room IDs with hyphens and underscores', () => {
		expect(validateRoomId('a-b_c')).toBe('a-b_c');
	});

	it('rejects empty strings', () => {
		expect(() => validateRoomId('')).toThrow('Invalid collaboration room ID');
	});

	it('rejects room IDs with spaces', () => {
		expect(() => validateRoomId('room 123')).toThrow('Invalid collaboration room ID');
	});

	it('rejects room IDs with special characters', () => {
		expect(() => validateRoomId('room@123')).toThrow('Invalid collaboration room ID');
		expect(() => validateRoomId('room/path')).toThrow('Invalid collaboration room ID');
		expect(() => validateRoomId('<script>')).toThrow('Invalid collaboration room ID');
	});

	it('rejects room IDs longer than 128 characters', () => {
		const longId = 'a'.repeat(129);
		expect(() => validateRoomId(longId)).toThrow('Invalid collaboration room ID');
	});

	it('accepts room IDs exactly 128 characters', () => {
		const id = 'a'.repeat(128);
		expect(validateRoomId(id)).toBe(id);
	});
});

// ---------------------------------------------------------------------------
// sanitizeUserName
// ---------------------------------------------------------------------------

describe('sanitizeUserName', () => {
	it('returns the name for valid strings', () => {
		expect(sanitizeUserName('Alice')).toBe('Alice');
	});

	it('strips HTML tags', () => {
		expect(sanitizeUserName('<b>Bob</b>')).toBe('Bob');
		expect(sanitizeUserName('<script>alert("xss")</script>Alice')).toBe('alert("xss")Alice');
		expect(sanitizeUserName('<img src=x onerror=alert(1)>')).toBe('Anonymous');
	});

	it("returns 'Anonymous' for empty names after stripping", () => {
		expect(sanitizeUserName('<img src=x>')).toBe('Anonymous');
		expect(sanitizeUserName('   ')).toBe('Anonymous');
		expect(sanitizeUserName('')).toBe('Anonymous');
	});

	it("returns 'Anonymous' for non-string values", () => {
		expect(sanitizeUserName(null)).toBe('Anonymous');
		expect(sanitizeUserName(undefined)).toBe('Anonymous');
		expect(sanitizeUserName(42)).toBe('Anonymous');
		expect(sanitizeUserName({})).toBe('Anonymous');
	});

	it('truncates to 64 characters', () => {
		const longName = 'A'.repeat(100);
		expect(sanitizeUserName(longName)).toBe('A'.repeat(64));
	});

	it('trims whitespace', () => {
		expect(sanitizeUserName('  Alice  ')).toBe('Alice');
	});
});

// ---------------------------------------------------------------------------
// clampCursorPosition
// ---------------------------------------------------------------------------

describe('clampCursorPosition', () => {
	it('clamps to slide bounds with margin', () => {
		expect(clampCursorPosition(500, 0, 960)).toBe(500);
		expect(clampCursorPosition(-100, 0, 960)).toBe(-20); // clamped to -margin
		expect(clampCursorPosition(1000, 0, 960)).toBe(980); // clamped to max+margin
	});

	it('returns 0 for non-number values', () => {
		expect(clampCursorPosition('abc', 0, 960)).toBe(0);
		expect(clampCursorPosition(null, 0, 960)).toBe(0);
		expect(clampCursorPosition(undefined, 0, 960)).toBe(0);
		expect(clampCursorPosition(NaN, 0, 960)).toBe(0);
		expect(clampCursorPosition(Infinity, 0, 960)).toBe(0);
	});

	it('allows positions within the margin zone', () => {
		expect(clampCursorPosition(-10, 0, 960)).toBe(-10);
		expect(clampCursorPosition(970, 0, 960)).toBe(970);
	});
});

// ---------------------------------------------------------------------------
// sanitizeColor
// ---------------------------------------------------------------------------

describe('sanitizeColor', () => {
	it('accepts valid hex colors', () => {
		expect(sanitizeColor('#ff0000')).toBe('#ff0000');
		expect(sanitizeColor('#6366f1')).toBe('#6366f1');
		expect(sanitizeColor('#AABBCC')).toBe('#AABBCC');
	});

	it('returns fallback for invalid colors', () => {
		expect(sanitizeColor('red')).toBe('#6366f1');
		expect(sanitizeColor('#fff')).toBe('#6366f1');
		expect(sanitizeColor('rgb(255,0,0)')).toBe('#6366f1');
		expect(sanitizeColor(null)).toBe('#6366f1');
		expect(sanitizeColor(42)).toBe('#6366f1');
	});

	it('uses custom fallback', () => {
		expect(sanitizeColor('invalid', '#000000')).toBe('#000000');
	});
});

// ---------------------------------------------------------------------------
// sanitizeAvatarUrl
// ---------------------------------------------------------------------------

describe('sanitizeAvatarUrl', () => {
	it('accepts https URLs', () => {
		expect(sanitizeAvatarUrl('https://example.com/avatar.png')).toBe(
			'https://example.com/avatar.png',
		);
	});

	it('accepts http URLs', () => {
		expect(sanitizeAvatarUrl('http://example.com/avatar.png')).toBe(
			'http://example.com/avatar.png',
		);
	});

	it('accepts data: URIs', () => {
		const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
		expect(sanitizeAvatarUrl(dataUri)).toBe(dataUri);
	});

	it('rejects javascript: URLs', () => {
		expect(sanitizeAvatarUrl(`${'javascript'}:alert(1)`)).toBeUndefined();
	});

	it('rejects invalid URLs', () => {
		expect(sanitizeAvatarUrl('not-a-url')).toBeUndefined();
	});

	it('returns undefined for non-string values', () => {
		expect(sanitizeAvatarUrl(null)).toBeUndefined();
		expect(sanitizeAvatarUrl(42)).toBeUndefined();
		expect(sanitizeAvatarUrl(undefined)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// sanitizeSlideIndex
// ---------------------------------------------------------------------------

describe('sanitizeSlideIndex', () => {
	it('accepts non-negative integers', () => {
		expect(sanitizeSlideIndex(0)).toBe(0);
		expect(sanitizeSlideIndex(5)).toBe(5);
	});

	it('floors fractional values', () => {
		expect(sanitizeSlideIndex(2.7)).toBe(2);
	});

	it('clamps negative values to 0', () => {
		expect(sanitizeSlideIndex(-3)).toBe(0);
	});

	it('returns 0 for non-number values', () => {
		expect(sanitizeSlideIndex('abc')).toBe(0);
		expect(sanitizeSlideIndex(null)).toBe(0);
		expect(sanitizeSlideIndex(NaN)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// sanitizePresence
// ---------------------------------------------------------------------------

describe('sanitizePresence', () => {
	const canvasWidth = 960;
	const canvasHeight = 540;

	it('sanitises valid presence data', () => {
		const result = sanitizePresence(
			{
				clientId: 1,
				userName: 'Alice',
				userColor: '#ff0000',
				activeSlideIndex: 2,
				cursorX: 100,
				cursorY: 200,
				lastUpdated: '2026-01-01T00:00:00.000Z',
			},
			canvasWidth,
			canvasHeight,
		);
		expect(result).toStrictEqual({
			clientId: 1,
			userName: 'Alice',
			userAvatar: undefined,
			userColor: '#ff0000',
			activeSlideIndex: 2,
			cursorX: 100,
			cursorY: 200,
			lastUpdated: '2026-01-01T00:00:00.000Z',
			selectedElementId: undefined,
			role: undefined,
		});
	});

	it('returns null when clientId is missing', () => {
		expect(sanitizePresence({ userName: 'Alice' }, canvasWidth, canvasHeight)).toBeNull();
	});

	it('sanitises HTML in userName', () => {
		const result = sanitizePresence(
			{
				clientId: 1,
				userName: '<b>Evil</b>',
				cursorX: 0,
				cursorY: 0,
			},
			canvasWidth,
			canvasHeight,
		);
		expect(result?.userName).toBe('Evil');
	});

	it('clamps out-of-bounds cursor positions', () => {
		const result = sanitizePresence(
			{
				clientId: 1,
				cursorX: 99999,
				cursorY: -99999,
			},
			canvasWidth,
			canvasHeight,
		);
		expect(result?.cursorX).toBe(canvasWidth + 20); // clamped to max+margin
		expect(result?.cursorY).toBe(-20); // clamped to -margin
	});

	it('truncates selectedElementId', () => {
		const longId = 'x'.repeat(200);
		const result = sanitizePresence(
			{ clientId: 1, selectedElementId: longId },
			canvasWidth,
			canvasHeight,
		);
		expect(result?.selectedElementId).toBe('x'.repeat(128));
	});

	it('rejects javascript: avatar URLs', () => {
		const result = sanitizePresence(
			{ clientId: 1, userAvatar: `${'javascript'}:alert(1)` },
			canvasWidth,
			canvasHeight,
		);
		expect(result?.userAvatar).toBeUndefined();
	});

	it('applies defaults for completely missing fields', () => {
		const result = sanitizePresence({ clientId: 42 }, canvasWidth, canvasHeight);
		expect(result).not.toBeNull();
		expect(result?.clientId).toBe(42);
		expect(result?.userName).toBe('Anonymous');
		expect(result?.userAvatar).toBeUndefined();
		expect(result?.userColor).toBe('#6366f1');
		expect(result?.activeSlideIndex).toBe(0);
		expect(result?.cursorX).toBe(0);
		expect(result?.cursorY).toBe(0);
		expect(result?.selectedElementId).toBeUndefined();
		// lastUpdated should be a valid ISO timestamp
		expect(() => new Date(result!.lastUpdated)).not.toThrow();
	});

	it('handles non-string lastUpdated by generating a fresh timestamp', () => {
		const before = Date.now();
		const result = sanitizePresence(
			{ clientId: 1, lastUpdated: 123456 },
			canvasWidth,
			canvasHeight,
		);
		const after = Date.now();
		const ts = new Date(result!.lastUpdated).getTime();
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});

	it('preserves valid avatar URL in full presence', () => {
		const result = sanitizePresence(
			{ clientId: 1, userAvatar: 'https://example.com/pic.png' },
			canvasWidth,
			canvasHeight,
		);
		expect(result?.userAvatar).toBe('https://example.com/pic.png');
	});

	it('returns null for non-number clientId types', () => {
		expect(
			sanitizePresence({ clientId: 'abc' as unknown as number }, canvasWidth, canvasHeight),
		).toBeNull();
		expect(
			sanitizePresence({ clientId: null as unknown as number }, canvasWidth, canvasHeight),
		).toBeNull();
		expect(
			sanitizePresence({ clientId: undefined as unknown as number }, canvasWidth, canvasHeight),
		).toBeNull();
	});

	it('ignores non-string selectedElementId', () => {
		const result = sanitizePresence(
			{ clientId: 1, selectedElementId: 12345 },
			canvasWidth,
			canvasHeight,
		);
		expect(result?.selectedElementId).toBeUndefined();
	});

	it('sanitises all fields simultaneously with malicious input', () => {
		const result = sanitizePresence(
			{
				clientId: 7,
				userName: '<img src=x onerror="alert(1)">Hacker',
				userAvatar: `${'javascript'}:void(0)`,
				userColor: 'not-a-hex-value',
				activeSlideIndex: -10.7,
				cursorX: -9999,
				cursorY: 9999,
				lastUpdated: 'not-a-date',
				selectedElementId: 'x'.repeat(300),
			},
			canvasWidth,
			canvasHeight,
		);
		expect(result).not.toBeNull();
		expect(result?.userName).toBe('Hacker');
		expect(result?.userAvatar).toBeUndefined();
		expect(result?.userColor).toBe('#6366f1');
		expect(result?.activeSlideIndex).toBe(0);
		expect(result?.cursorX).toBe(-20);
		expect(result?.cursorY).toBe(canvasHeight + 20);
		expect(result?.selectedElementId).toHaveLength(128);
	});
});

// ---------------------------------------------------------------------------
// Edge cases — additional coverage
// ---------------------------------------------------------------------------

describe('validateRoomId — edge cases', () => {
	it('accepts single-character room IDs', () => {
		expect(validateRoomId('a')).toBe('a');
		expect(validateRoomId('Z')).toBe('Z');
		expect(validateRoomId('0')).toBe('0');
	});

	it('rejects dots and other punctuation', () => {
		expect(() => validateRoomId('room.123')).toThrow('Invalid collaboration room ID');
		expect(() => validateRoomId('room:123')).toThrow('Invalid collaboration room ID');
		expect(() => validateRoomId('room+123')).toThrow('Invalid collaboration room ID');
		expect(() => validateRoomId('room#123')).toThrow('Invalid collaboration room ID');
	});

	it('rejects unicode characters', () => {
		expect(() => validateRoomId('room\u00E9')).toThrow('Invalid collaboration room ID');
		expect(() => validateRoomId('\u4F60\u597D')).toThrow('Invalid collaboration room ID');
	});

	it('rejects newlines and tabs', () => {
		expect(() => validateRoomId('room\n123')).toThrow('Invalid collaboration room ID');
		expect(() => validateRoomId('room\t123')).toThrow('Invalid collaboration room ID');
	});
});

describe('sanitizeUserName — edge cases', () => {
	it('handles nested HTML tags', () => {
		expect(sanitizeUserName('<div><span>Name</span></div>')).toBe('Name');
	});

	it('handles self-closing tags', () => {
		expect(sanitizeUserName('Before<br/>After')).toBe('BeforeAfter');
	});

	it('preserves ampersands and non-tag angle brackets', () => {
		// "A & B" has no HTML tags, so it should pass through
		expect(sanitizeUserName('A & B')).toBe('A & B');
	});

	it('handles names at exactly 64 characters', () => {
		const name64 = 'A'.repeat(64);
		expect(sanitizeUserName(name64)).toBe(name64);
	});

	it('handles boolean input', () => {
		expect(sanitizeUserName(true as unknown as string)).toBe('Anonymous');
		expect(sanitizeUserName(false as unknown as string)).toBe('Anonymous');
	});
});

describe('clampCursorPosition — edge cases', () => {
	it('clamps exactly at the boundary', () => {
		// At max (960) — should be within bounds since max+20 = 980
		expect(clampCursorPosition(960, 0, 960)).toBe(960);
		// At min (0) — within bounds since min-20 = -20
		expect(clampCursorPosition(0, 0, 960)).toBe(0);
	});

	it('clamps at the margin edge', () => {
		expect(clampCursorPosition(-20, 0, 960)).toBe(-20);
		expect(clampCursorPosition(980, 0, 960)).toBe(980);
	});

	it('clamps just beyond the margin', () => {
		expect(clampCursorPosition(-21, 0, 960)).toBe(-20);
		expect(clampCursorPosition(981, 0, 960)).toBe(980);
	});

	it('works with different canvas sizes', () => {
		expect(clampCursorPosition(500, 0, 1920)).toBe(500);
		expect(clampCursorPosition(2000, 0, 1920)).toBe(1940); // 1920+20
		expect(clampCursorPosition(-100, 0, 1920)).toBe(-20);
	});

	it('handles -Infinity', () => {
		expect(clampCursorPosition(-Infinity, 0, 960)).toBe(0);
	});
});

describe('sanitizeColor — edge cases', () => {
	it('rejects 3-character shorthand hex', () => {
		expect(sanitizeColor('#abc')).toBe('#6366f1');
	});

	it('rejects 8-character hex with alpha', () => {
		expect(sanitizeColor('#ff000080')).toBe('#6366f1');
	});

	it('rejects hex without hash', () => {
		expect(sanitizeColor('ff0000')).toBe('#6366f1');
	});

	it('rejects empty string', () => {
		expect(sanitizeColor('')).toBe('#6366f1');
	});

	it('handles undefined', () => {
		expect(sanitizeColor(undefined)).toBe('#6366f1');
	});

	it('accepts mixed case hex', () => {
		expect(sanitizeColor('#aAbBcC')).toBe('#aAbBcC');
	});
});

describe('sanitizeAvatarUrl — edge cases', () => {
	it('rejects ftp: URLs', () => {
		expect(sanitizeAvatarUrl('ftp://evil.com/file.png')).toBeUndefined();
	});

	it('rejects file: URLs', () => {
		expect(sanitizeAvatarUrl('file:///etc/passwd')).toBeUndefined();
	});

	it('rejects empty string', () => {
		expect(sanitizeAvatarUrl('')).toBeUndefined();
	});

	it('accepts data URI with complex base64', () => {
		const uri =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
		expect(sanitizeAvatarUrl(uri)).toBe(uri);
	});

	it('accepts https URL with query params', () => {
		const url = 'https://example.com/avatar.png?size=64&v=2';
		expect(sanitizeAvatarUrl(url)).toBe(url);
	});

	it('handles array input', () => {
		expect(sanitizeAvatarUrl([] as unknown as string)).toBeUndefined();
	});
});

describe('sanitizeSlideIndex — edge cases', () => {
	it('handles very large numbers', () => {
		expect(sanitizeSlideIndex(999999)).toBe(999999);
	});

	it('handles Infinity', () => {
		expect(sanitizeSlideIndex(Infinity)).toBe(0);
	});

	it('handles -Infinity', () => {
		expect(sanitizeSlideIndex(-Infinity)).toBe(0);
	});

	it('handles boolean values', () => {
		// typeof true === 'boolean', not 'number'
		expect(sanitizeSlideIndex(true as unknown as number)).toBe(0);
	});

	it('floors 0.999', () => {
		expect(sanitizeSlideIndex(0.999)).toBe(0);
	});
});
