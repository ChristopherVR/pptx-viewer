import { describe, it, expect } from 'vitest';

import { buildTabContext, computeTabbedLayout, leaderGlyph } from './text-tab-layout';
import type { TabStopSpec } from './text-tab-layout';

/** Deterministic monospace measurement: 10px per character. */
const measure = (text: string): number => text.length * 10;

describe('leaderGlyph', () => {
	it('maps OOXML leader tokens to fill glyphs', () => {
		expect(leaderGlyph('dot')).toBe('.');
		expect(leaderGlyph('hyphen')).toBe('-');
		expect(leaderGlyph('underscore')).toBe('_');
	});

	it('returns empty string for none/undefined', () => {
		expect(leaderGlyph('none')).toBe('');
		expect(leaderGlyph(undefined)).toBe('');
	});
});

describe('computeTabbedLayout', () => {
	it('places the first piece at the origin with no leader', () => {
		const pieces = computeTabbedLayout(['Hello'], [], measure, 48);
		expect(pieces).toHaveLength(1);
		expect(pieces[0].left).toBe(0);
		expect(pieces[0].leaderWidth).toBe(0);
		expect(pieces[0].leaderChar).toBe('');
	});

	it('left tab: piece starts at the stop position', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const pieces = computeTabbedLayout(['A', 'B'], stops, measure, 48);
		expect(pieces[1].left).toBe(100);
		expect(pieces[1].leaderWidth).toBe(90);
	});

	it('right tab: piece trailing edge lands on the stop', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'r' }];
		const pieces = computeTabbedLayout(['A', 'BB'], stops, measure, 48);
		expect(pieces[1].left).toBe(80);
		expect(pieces[1].leaderWidth).toBe(70);
	});

	it('center tab: piece is centred on the stop', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'ctr' }];
		const pieces = computeTabbedLayout(['A', 'BB'], stops, measure, 48);
		expect(pieces[1].left).toBe(90);
	});

	it('decimal tab: the decimal point aligns to the stop', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'dec' }];
		const pieces = computeTabbedLayout(['', '12.34'], stops, measure, 48);
		// "12" measures 20px, so the run starts 20px left of the stop.
		expect(pieces[1].left).toBe(80);
	});

	it('decimal tab without a decimal point behaves like a right tab', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'dec' }];
		const pieces = computeTabbedLayout(['', '99'], stops, measure, 48);
		expect(pieces[1].left).toBe(80);
	});

	it('fills the gap with the leader glyph', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'r', leader: 'dot' }];
		const pieces = computeTabbedLayout(['Label', '12'], stops, measure, 48);
		expect(pieces[1].leaderChar).toBe('.');
		expect(pieces[1].leaderWidth).toBeGreaterThan(0);
	});

	it('advances by the default tab interval when no stop lies past the cursor', () => {
		const pieces = computeTabbedLayout(['AB', 'C'], [], measure, 40);
		// cursor = 20; next multiple of 40 strictly greater than 20 is 40.
		expect(pieces[1].left).toBe(40);
	});

	it('clamps to the cursor so pieces never overlap', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'r' }];
		const pieces = computeTabbedLayout(['AAAAAAAAA', 'BBB'], stops, measure, 48);
		// Piece 0 is 90px wide; a right tab at 100 would put "BBB" at 70 (overlap),
		// so it is clamped to the cursor (90) with no leader.
		expect(pieces[1].left).toBe(90);
		expect(pieces[1].leaderWidth).toBe(0);
		expect(pieces[1].leaderChar).toBe('');
	});
});

describe('buildTabContext', () => {
	it('returns undefined when there are no tab stops', () => {
		expect(buildTabContext(undefined, 48, 16, 'Arial', false, false)).toBeUndefined();
		expect(buildTabContext([], 48, 16, 'Arial', false, false)).toBeUndefined();
	});

	it('builds a canvas font shorthand honouring weight and style', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const ctx = buildTabContext(stops, 48, 16, 'Arial', true, true);
		expect(ctx).toBeDefined();
		expect(ctx?.font).toBe('italic 700 16px Arial');
		expect(ctx?.defaultTabSize).toBe(48);
	});

	it('normalizes a missing default tab size to 0', () => {
		const stops: TabStopSpec[] = [{ position: 100, align: 'l' }];
		const ctx = buildTabContext(stops, undefined, 16, 'Arial', false, false);
		expect(ctx?.defaultTabSize).toBe(0);
		expect(ctx?.font).toBe('400 16px Arial');
	});
});
