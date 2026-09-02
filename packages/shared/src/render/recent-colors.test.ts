import { describe, expect, it } from 'vitest';

import {
	mruColorsPatch,
	pushRecentColor,
	RECENT_COLOR_LIMIT,
	seedRecentColors,
} from './recent-colors';

describe('seedRecentColors', () => {
	it('normalises to uppercase #RRGGBB', () => {
		expect(seedRecentColors({ mruColors: ['#ff0000', 'ff0000'] })).toStrictEqual(['#FF0000']);
	});

	it('drops entries that are not a plain 6-digit hex colour', () => {
		expect(
			seedRecentColors({ mruColors: ['#FF0000', 'red', 'rgb(0,0,0)', '#FFF', '#GGGGGG'] }),
		).toStrictEqual(['#FF0000']);
	});

	it('de-duplicates case-insensitively, keeping the first occurrence', () => {
		expect(seedRecentColors({ mruColors: ['#FF0000', '#ff0000', '#00FF00'] })).toStrictEqual([
			'#FF0000',
			'#00FF00',
		]);
	});

	it('caps at RECENT_COLOR_LIMIT', () => {
		const colors = Array.from(
			{ length: RECENT_COLOR_LIMIT + 5 },
			(_, i) => `#${i.toString(16).padStart(6, '0')}`,
		);
		expect(seedRecentColors({ mruColors: colors })).toHaveLength(RECENT_COLOR_LIMIT);
	});

	it('returns an empty array when mruColors is absent', () => {
		expect(seedRecentColors({})).toStrictEqual([]);
	});
});

describe('pushRecentColor', () => {
	it('inserts a new colour at the front', () => {
		expect(pushRecentColor(['#00FF00'], '#FF0000')).toStrictEqual(['#FF0000', '#00FF00']);
	});

	it('moves an existing colour to the front instead of duplicating it', () => {
		expect(pushRecentColor(['#FF0000', '#00FF00', '#0000FF'], '#00ff00')).toStrictEqual([
			'#00FF00',
			'#FF0000',
			'#0000FF',
		]);
	});

	it('caps at RECENT_COLOR_LIMIT, dropping the oldest', () => {
		const full = Array.from(
			{ length: RECENT_COLOR_LIMIT },
			(_, i) => `#${i.toString(16).padStart(6, '0')}`,
		);
		const result = pushRecentColor(full, '#ABCDEF');
		expect(result).toHaveLength(RECENT_COLOR_LIMIT);
		expect(result[0]).toBe('#ABCDEF');
		expect(result).not.toContain(full[full.length - 1]);
	});

	it('returns the same reference when the colour is invalid', () => {
		const recent = ['#FF0000'];
		expect(pushRecentColor(recent, 'not-a-color')).toBe(recent);
	});
});

describe('mruColorsPatch', () => {
	it('wraps a normalised, capped list as a PptxData patch', () => {
		expect(mruColorsPatch(['#ff0000', '#00ff00'])).toStrictEqual({
			mruColors: ['#FF0000', '#00FF00'],
		});
	});

	it('drops invalid entries', () => {
		expect(mruColorsPatch(['#FF0000', 'not-a-color'])).toStrictEqual({ mruColors: ['#FF0000'] });
	});

	it('round-trips through seedRecentColors', () => {
		const recent = pushRecentColor(pushRecentColor([], '#FF0000'), '#00FF00');
		const patch = mruColorsPatch(recent);
		expect(seedRecentColors(patch)).toStrictEqual(recent);
	});
});
