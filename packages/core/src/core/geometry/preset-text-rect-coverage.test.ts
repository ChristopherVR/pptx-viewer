/**
 * Exhaustive sanity check over every preset text-rect override
 * (`preset-text-rect-*.ts`, 93 presets): every `<a:rect>` edge must evaluate
 * to a finite number, and the rect must not be degenerate (left < right,
 * top < bottom) at default adjustment values. Guards against a
 * mistranscribed or undefined guide reference silently resolving to 0 (or
 * NaN/Infinity from a division bug), the same failure mode gap G1 found in
 * the original (unverified) `PresetShapeGeometryDefinition.rect` table.
 *
 * @module render/preset-text-rect-coverage.test
 */
import { describe, expect, it } from 'vitest';

import { ACTION_BUTTON_TEXT_RECTS } from './preset-text-rect-action-buttons';
import { ARROW_TEXT_RECTS } from './preset-text-rect-arrows';
import { BRACE_TEXT_RECTS } from './preset-text-rect-braces';
import { CALLOUT_TEXT_RECTS } from './preset-text-rect-callouts';
import { CIRCULAR_ARROW_TEXT_RECTS } from './preset-text-rect-circular-arrows';
import { FLOWCHART_TEXT_RECTS } from './preset-text-rect-flowchart';
import { MISC_TEXT_RECTS_A } from './preset-text-rect-misc-a';
import { MISC_TEXT_RECTS_B } from './preset-text-rect-misc-b';
import { POLYGON_TEXT_RECTS } from './preset-text-rect-polygons';
import { QUAD_TEXT_RECTS } from './preset-text-rect-quads';
import { RIBBON_TEXT_RECTS } from './preset-text-rect-ribbons';
import { STAR_TEXT_RECTS } from './preset-text-rect-stars';
import { getPresetTextRect } from './preset-text-rect-table';
import { TAB_TEXT_RECTS } from './preset-text-rect-tabs';

const ALL_FAMILIES: Record<string, Record<string, unknown>> = {
	ACTION_BUTTON_TEXT_RECTS,
	CALLOUT_TEXT_RECTS,
	FLOWCHART_TEXT_RECTS,
	STAR_TEXT_RECTS,
	ARROW_TEXT_RECTS,
	CIRCULAR_ARROW_TEXT_RECTS,
	BRACE_TEXT_RECTS,
	RIBBON_TEXT_RECTS,
	TAB_TEXT_RECTS,
	QUAD_TEXT_RECTS,
	POLYGON_TEXT_RECTS,
	MISC_TEXT_RECTS_A,
	MISC_TEXT_RECTS_B,
};

const ALL_PRESET_NAMES = Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family));

describe('every preset text-rect override evaluates to a finite, non-degenerate rect', () => {
	it('covers exactly 93 presets', () => {
		expect(new Set(ALL_PRESET_NAMES).size).toBe(93);
	});

	const width = 200;
	const height = 100;
	// Same generous margin as the connection-sites coverage test: a callout
	// pointer tip can legitimately land near or outside the box, but a wild
	// multiple of it signals a mistranscription, not real geometry.
	const margin = { min: -width, maxX: 2 * width, maxY: 2 * height };

	for (const name of ALL_PRESET_NAMES) {
		it(`${name}: rect edges are finite, ordered, and within a generous box margin`, () => {
			const rect = getPresetTextRect(name, width, height);
			expect(rect, `${name}: no override evaluated`).toBeDefined();
			if (!rect) {
				return;
			}
			expect(Number.isFinite(rect.l)).toBeTruthy();
			expect(Number.isFinite(rect.t)).toBeTruthy();
			expect(Number.isFinite(rect.r)).toBeTruthy();
			expect(Number.isFinite(rect.b)).toBeTruthy();
			expect(rect.l).toBeLessThan(rect.r);
			expect(rect.t).toBeLessThan(rect.b);
			expect(rect.l).toBeGreaterThanOrEqual(margin.min);
			expect(rect.r).toBeLessThanOrEqual(margin.maxX);
			expect(rect.t).toBeGreaterThanOrEqual(margin.min);
			expect(rect.b).toBeLessThanOrEqual(margin.maxY);
		});
	}
});
