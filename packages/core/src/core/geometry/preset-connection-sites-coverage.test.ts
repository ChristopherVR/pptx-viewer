/**
 * Exhaustive sanity check over every preset connection-site table in this
 * repo (wave 1's 53 plus the 121 transcribed alongside this file): every
 * `cxnLst` site must evaluate to finite, box-relative coordinates at default
 * adjustment values. This is the guard against a mistranscribed or undefined
 * guide reference silently resolving to 0 (or NaN/Infinity from a division
 * bug) via `resolveOperand`'s defensive fallback.
 *
 * @module render/preset-connection-sites-coverage.test
 */
import { describe, expect, it } from 'vitest';

import { ACTION_BUTTON_CONNECTION_SITES } from './preset-connection-sites-action-buttons';
import { ARROW_CONNECTION_SITES } from './preset-connection-sites-arrows';
import { CURVED_ARROW_CONNECTION_SITES } from './preset-connection-sites-arrows-curved';
import { MISC_ARROW_CONNECTION_SITES } from './preset-connection-sites-arrows-misc';
import { BASIC_SHAPE_CONNECTION_SITES_A } from './preset-connection-sites-basic-a';
import { BASIC_SHAPE_CONNECTION_SITES_B } from './preset-connection-sites-basic-b';
import { BRACE_CONNECTION_SITES } from './preset-connection-sites-braces';
import { ARROW_CALLOUT_CONNECTION_SITES } from './preset-connection-sites-callouts-arrow';
import { CALLOUT_CONNECTION_SITES } from './preset-connection-sites-callouts-basic';
import { CIRCULAR_ARROW_CONNECTION_SITES } from './preset-connection-sites-circular-arrow';
import { FLOWCHART_CONNECTION_SITES } from './preset-connection-sites-flowchart';
import { GEAR9_CONNECTION_SITES } from './preset-connection-sites-gear9';
import { LEFT_CIRCULAR_ARROW_CONNECTION_SITES } from './preset-connection-sites-left-circular-arrow';
import { LEFT_RIGHT_CIRCULAR_ARROW_CONNECTION_SITES } from './preset-connection-sites-left-right-circular-arrow';
import { MATH_SYMBOL_CONNECTION_SITES } from './preset-connection-sites-math';
import { MISC_SHAPE_CONNECTION_SITES } from './preset-connection-sites-misc';
import { POLYGON_CONNECTION_SITES } from './preset-connection-sites-polygons';
import { QUAD_CONNECTION_SITES } from './preset-connection-sites-quads';
import { RECT_VARIANT_CONNECTION_SITES } from './preset-connection-sites-rects';
import { RIBBON_CONNECTION_SITES } from './preset-connection-sites-ribbons';
import { STAR_CONNECTION_SITES } from './preset-connection-sites-stars';
import { getPresetConnectionSites } from './preset-connection-sites-table';
import { TAB_CONNECTION_SITES } from './preset-connection-sites-tabs';

const ALL_FAMILIES: Record<string, Record<string, unknown>> = {
	QUAD_CONNECTION_SITES,
	POLYGON_CONNECTION_SITES,
	ARROW_CONNECTION_SITES,
	FLOWCHART_CONNECTION_SITES,
	CALLOUT_CONNECTION_SITES,
	ARROW_CALLOUT_CONNECTION_SITES,
	ACTION_BUTTON_CONNECTION_SITES,
	CURVED_ARROW_CONNECTION_SITES,
	MISC_ARROW_CONNECTION_SITES,
	CIRCULAR_ARROW_CONNECTION_SITES,
	LEFT_CIRCULAR_ARROW_CONNECTION_SITES,
	LEFT_RIGHT_CIRCULAR_ARROW_CONNECTION_SITES,
	STAR_CONNECTION_SITES,
	RECT_VARIANT_CONNECTION_SITES,
	BRACE_CONNECTION_SITES,
	MATH_SYMBOL_CONNECTION_SITES,
	RIBBON_CONNECTION_SITES,
	TAB_CONNECTION_SITES,
	BASIC_SHAPE_CONNECTION_SITES_A,
	BASIC_SHAPE_CONNECTION_SITES_B,
	GEAR9_CONNECTION_SITES,
	MISC_SHAPE_CONNECTION_SITES,
};

const ALL_PRESET_NAMES = Object.values(ALL_FAMILIES).flatMap((family) => Object.keys(family));

describe('every transcribed preset cxnLst evaluates to finite, box-relative coordinates', () => {
	it('covers the expected number of presets (174 = 53 wave-1 + 121 this wave)', () => {
		expect(new Set(ALL_PRESET_NAMES).size).toBe(174);
	});

	const width = 200;
	const height = 100;
	// Generous margin: a callout pointer tip or an arc-head control point can
	// legitimately land outside the notional box, but never by a wild
	// multiple of it (that signature indicates a division-by-near-zero or an
	// undefined-guide-resolves-to-0 mistranscription rather than real geometry).
	const margin = { minX: -width, maxX: 2 * width, minY: -height, maxY: 2 * height };

	for (const name of ALL_PRESET_NAMES) {
		it(`${name}: every cxnLst site is finite and within a generous box margin`, () => {
			const sites = getPresetConnectionSites(name, width, height);
			expect(sites).toBeDefined();
			expect(sites!.length).toBeGreaterThan(0);
			for (const site of sites!) {
				expect(Number.isFinite(site.x)).toBeTruthy();
				expect(Number.isFinite(site.y)).toBeTruthy();
				expect(site.x).toBeGreaterThanOrEqual(margin.minX);
				expect(site.x).toBeLessThanOrEqual(margin.maxX);
				expect(site.y).toBeGreaterThanOrEqual(margin.minY);
				expect(site.y).toBeLessThanOrEqual(margin.maxY);
			}
		});
	}
});

describe('presets with no ECMA cxnLst fall back to undefined intentionally', () => {
	// Verified against the same presetShapeDefinitions.xml source: these
	// entries have no <cxnLst> child at all, so there is nothing to
	// transcribe; getPresetConnectionSites returning undefined for them is
	// correct, not a gap. `getPresetConnectionSites` (preset-connection-sites-table.ts)
	// falls back to the 4 cardinal edge midpoints one layer up in
	// `packages/shared/src/render/connector-sites.ts`.
	const noCxnLstPresets = [
		'straightConnector1',
		'bentConnector2',
		'bentConnector3',
		'bentConnector4',
		'bentConnector5',
		'curvedConnector2',
		'curvedConnector3',
		'curvedConnector4',
		'curvedConnector5',
		'chartPlus',
		'chartStar',
		'chartX',
		'funnel',
	];

	it('lists exactly 13 presets confirmed to have no ECMA cxnLst', () => {
		expect(noCxnLstPresets).toHaveLength(13);
	});

	for (const name of noCxnLstPresets) {
		it(`${name}: getPresetConnectionSites returns undefined`, () => {
			expect(getPresetConnectionSites(name, 200, 100)).toBeUndefined();
		});
	}
});
