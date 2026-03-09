import { describe, it, expect } from 'vitest';
import {
	resolveDirection,
	resolveDirection8,
	resolveOrientation,
	RANDOM_ELIGIBLE_TYPES,
	INSTANT,
} from './transition-helpers';

describe('resolveDirection', () => {
	it('should resolve "l" to "left"', () => {
		expect(resolveDirection('l', 'right')).toBe('left');
	});

	it('should resolve "r" to "right"', () => {
		expect(resolveDirection('r', 'left')).toBe('right');
	});

	it('should resolve "u" to "up"', () => {
		expect(resolveDirection('u', 'down')).toBe('up');
	});

	it('should resolve "d" to "down"', () => {
		expect(resolveDirection('d', 'up')).toBe('down');
	});

	it('should return default direction for undefined input', () => {
		expect(resolveDirection(undefined, 'left')).toBe('left');
	});

	it('should return default direction for unknown input', () => {
		expect(resolveDirection('xyz', 'right')).toBe('right');
	});

	it('should return default direction for empty string', () => {
		expect(resolveDirection('', 'up')).toBe('up');
	});
});

describe('resolveDirection8', () => {
	it('should resolve basic 4 directions like resolveDirection', () => {
		expect(resolveDirection8('l', 'right')).toBe('left');
		expect(resolveDirection8('r', 'left')).toBe('right');
		expect(resolveDirection8('u', 'down')).toBe('up');
		expect(resolveDirection8('d', 'up')).toBe('down');
	});

	it('should resolve diagonal "lu" (left-up)', () => {
		expect(resolveDirection8('lu', 'left')).toBe('lu');
	});

	it('should resolve diagonal "ld" (left-down)', () => {
		expect(resolveDirection8('ld', 'left')).toBe('ld');
	});

	it('should resolve diagonal "ru" (right-up)', () => {
		expect(resolveDirection8('ru', 'left')).toBe('ru');
	});

	it('should resolve diagonal "rd" (right-down)', () => {
		expect(resolveDirection8('rd', 'left')).toBe('rd');
	});

	it('should return default for undefined input', () => {
		expect(resolveDirection8(undefined, 'down')).toBe('down');
	});

	it('should return default for unknown input', () => {
		expect(resolveDirection8('xyz', 'up')).toBe('up');
	});
});

describe('resolveOrientation', () => {
	it('should return "horz" when orient is "horz"', () => {
		expect(resolveOrientation(undefined, 'horz')).toBe('horz');
	});

	it('should return "vert" when orient is "vert"', () => {
		expect(resolveOrientation(undefined, 'vert')).toBe('vert');
	});

	it('should fall back to direction when orient is not valid', () => {
		expect(resolveOrientation('horz', undefined)).toBe('horz');
		expect(resolveOrientation('vert', undefined)).toBe('vert');
	});

	it('should default to "horz" when neither orient nor direction is valid', () => {
		expect(resolveOrientation(undefined, undefined)).toBe('horz');
		expect(resolveOrientation('xyz', 'abc')).toBe('horz');
	});

	it('should prefer orient over direction', () => {
		expect(resolveOrientation('vert', 'horz')).toBe('horz');
	});

	it('should handle empty strings as invalid', () => {
		expect(resolveOrientation('', '')).toBe('horz');
	});
});

describe('RANDOM_ELIGIBLE_TYPES', () => {
	it('should contain multiple transition types', () => {
		expect(RANDOM_ELIGIBLE_TYPES.length).toBeGreaterThanOrEqual(5);
	});

	it('should contain known transition types', () => {
		expect(RANDOM_ELIGIBLE_TYPES).toContain('fade');
		expect(RANDOM_ELIGIBLE_TYPES).toContain('push');
		expect(RANDOM_ELIGIBLE_TYPES).toContain('wipe');
		expect(RANDOM_ELIGIBLE_TYPES).toContain('dissolve');
	});

	it('should not contain "none" or "cut"', () => {
		expect(RANDOM_ELIGIBLE_TYPES).not.toContain('none');
		expect(RANDOM_ELIGIBLE_TYPES).not.toContain('cut');
	});

	it('should not contain "random" to avoid infinite recursion', () => {
		expect(RANDOM_ELIGIBLE_TYPES).not.toContain('random');
	});
});

describe('INSTANT sentinel', () => {
	it('should have "none" for both outgoing and incoming', () => {
		expect(INSTANT.outgoing).toBe('none');
		expect(INSTANT.incoming).toBe('none');
	});

	it('should set outgoingOnTop to true', () => {
		expect(INSTANT.outgoingOnTop).toBe(true);
	});
});
