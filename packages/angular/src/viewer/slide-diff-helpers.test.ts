/**
 * slide-diff-helpers.test.ts: Unit tests for the pure label / icon helpers
 * split out of the slide-diff row.
 */

import { describe, expect, it } from 'vitest';

import type { SlideDiff } from '../internal/shared';
import { changeCountLabel, changeIcon, slideNumberOf, statusLabel } from './slide-diff-helpers';

describe('changeIcon', () => {
	it('maps each change kind to its glyph', () => {
		expect(changeIcon('added')).toBe('+');
		expect(changeIcon('removed')).toBe('-');
		expect(changeIcon('moved')).toBe('⇄');
		expect(changeIcon('resized')).toBe('⇄');
		expect(changeIcon('textChanged')).toBe('T');
	});
});

describe('statusLabel', () => {
	it('maps each status to its label', () => {
		expect(statusLabel('added')).toBe('Added');
		expect(statusLabel('removed')).toBe('Removed');
		expect(statusLabel('changed')).toBe('Changed');
		expect(statusLabel('unchanged')).toBe('Unchanged');
	});
});

describe('changeCountLabel', () => {
	it('uses the singular for one change', () => {
		expect(changeCountLabel(1)).toBe('1 change');
	});

	it('uses the plural otherwise', () => {
		expect(changeCountLabel(0)).toBe('0 changes');
		expect(changeCountLabel(3)).toBe('3 changes');
	});
});

describe('slideNumberOf', () => {
	it('prefers the 1-based base index when present', () => {
		expect(slideNumberOf({ baseIndex: 2, compareIndex: 5 } as SlideDiff)).toBe(3);
	});

	it('falls back to the compare index for added slides', () => {
		expect(slideNumberOf({ baseIndex: -1, compareIndex: 4 } as SlideDiff)).toBe(5);
	});
});
