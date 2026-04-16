import { describe, it, expect } from 'vitest';

import { getLeaderCharacter, getLeaderStyles, buildLeaderString } from './tab-leader';

describe('getLeaderCharacter', () => {
	it('returns period for dot leader', () => {
		expect(getLeaderCharacter('dot')).toBe('.');
	});

	it('returns hyphen for hyphen leader', () => {
		expect(getLeaderCharacter('hyphen')).toBe('-');
	});

	it('returns underscore for underscore leader', () => {
		expect(getLeaderCharacter('underscore')).toBe('_');
	});

	it('returns heavy horizontal for heavy leader', () => {
		expect(getLeaderCharacter('heavy')).toBe('\u2501');
	});

	it('returns middle dot for middleDot leader', () => {
		expect(getLeaderCharacter('middleDot')).toBe('\u00B7');
	});

	it('returns undefined for none', () => {
		expect(getLeaderCharacter('none')).toBeUndefined();
	});

	it('returns undefined for undefined input', () => {
		expect(getLeaderCharacter(undefined)).toBeUndefined();
	});

	it('returns undefined for unknown leader type', () => {
		expect(getLeaderCharacter('fancy')).toBeUndefined();
	});
});

describe('getLeaderStyles', () => {
	it('returns inline-block style with width', () => {
		const styles = getLeaderStyles(100);
		expect(styles).toBeDefined();
		expect(styles!.display).toBe('inline-block');
		expect(styles!.width).toBe('100px');
		expect(styles!.overflow).toBe('hidden');
	});

	it('includes colour when provided', () => {
		const styles = getLeaderStyles(50, '#FF0000');
		expect(styles!.color).toBe('#FF0000');
	});

	it('omits colour when not provided', () => {
		const styles = getLeaderStyles(50);
		expect(styles).not.toHaveProperty('color');
	});

	it('returns undefined for zero width', () => {
		expect(getLeaderStyles(0)).toBeUndefined();
	});

	it('returns undefined for negative width', () => {
		expect(getLeaderStyles(-10)).toBeUndefined();
	});
});

describe('buildLeaderString', () => {
	it('returns repeated dots for dot leader', () => {
		const result = buildLeaderString('dot', 100, 16);
		expect(result).toMatch(/^\.+$/);
		expect(result.length).toBeGreaterThan(0);
	});

	it('returns repeated hyphens for hyphen leader', () => {
		const result = buildLeaderString('hyphen', 100, 16);
		expect(result).toMatch(/^-+$/);
	});

	it('returns tab character for none leader', () => {
		expect(buildLeaderString('none', 100)).toBe('\t');
	});

	it('returns tab character for undefined leader', () => {
		expect(buildLeaderString(undefined, 100)).toBe('\t');
	});

	it('returns tab character for zero width', () => {
		expect(buildLeaderString('dot', 0)).toBe('\t');
	});

	it('scales repeat count with font size', () => {
		const small = buildLeaderString('dot', 100, 10);
		const large = buildLeaderString('dot', 100, 20);
		// Smaller font → more characters to fill the same width
		expect(small.length).toBeGreaterThan(large.length);
	});

	it('returns at least one character for very small widths', () => {
		const result = buildLeaderString('dot', 1, 16);
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	it('uses default font size of 16px', () => {
		const withDefault = buildLeaderString('dot', 100);
		const withExplicit = buildLeaderString('dot', 100, 16);
		expect(withDefault).toBe(withExplicit);
	});
});
