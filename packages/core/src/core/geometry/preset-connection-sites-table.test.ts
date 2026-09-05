import { describe, expect, it } from 'vitest';

import {
	getPresetConnectionSites,
	lookupPresetConnectionSites,
} from './preset-connection-sites-table';

describe('getPresetConnectionSites', () => {
	it('returns undefined for a preset whose ECMA cxnLst genuinely has no entries (straightConnector1: connectors attach by endpoint, not cxnLst)', () => {
		expect(getPresetConnectionSites('straightConnector1', 200, 100)).toBeUndefined();
	});

	it('wedgeRoundRectCallout: resolves the callout pointer-tip site (idx 4) in addition to the 4 cardinals', () => {
		// adj1=-20833, adj2=62500 (defaults): dxPos = w*adj1/100000, dyPos = h*adj2/100000
		const sites = getPresetConnectionSites('wedgeRoundRectCallout', 200, 100);
		expect(sites).toHaveLength(5);
		expect(sites?.[4]).toStrictEqual({
			x: 100 + (200 * -20833) / 100000,
			y: 50 + (100 * 62500) / 100000,
		});
	});

	it('rect: matches the ECMA cxnLst order (top, left, bottom, right)', () => {
		const sites = getPresetConnectionSites('rect', 200, 100);
		expect(sites).toStrictEqual([
			{ x: 100, y: 0 }, // top
			{ x: 0, y: 50 }, // left
			{ x: 100, y: 100 }, // bottom
			{ x: 200, y: 50 }, // right
		]);
	});

	it('triangle: apex sits at the adj-driven x1, not the horizontal center, for an asymmetric adj', () => {
		// adj=0 -> a=0 -> x1 = w*0/200000 = 0: the apex collapses to the left edge.
		const sites = getPresetConnectionSites('triangle', 200, 100, { adj: 0 });
		expect(sites?.[0]).toStrictEqual({ x: 0, y: 0 }); // top site at x1, t
		// x3 = x1 + w/2 = 0 + 100 = 100
		expect(sites?.[5]).toStrictEqual({ x: 100, y: 50 }); // right-vertex site
	});

	it('triangle: the apex site (idx 0) and the bottom-mid site (idx 3) use x2 (the full apex offset), not x1 (half)', () => {
		// default adj=50000 -> a=50000 -> x2 = w*a/100000 = 100 (horizontal
		// center, since the default triangle is isosceles). A prior
		// transcription used x1 (=50, a quarter of the width) for these two
		// sites, which put the apex off-center even for a symmetric triangle.
		const sites = getPresetConnectionSites('triangle', 200, 100);
		expect(sites?.[0]).toStrictEqual({ x: 100, y: 0 }); // apex, horizontally centered
		expect(sites?.[3]).toStrictEqual({ x: 100, y: 100 }); // directly below the apex
	});

	it('ellipse: the 45-degree inscribed corners (il/it/ir/ib) differ from the bounding-box corners', () => {
		const sites = getPresetConnectionSites('ellipse', 200, 100);
		expect(sites).toHaveLength(8);
		// idx = cos(wd2, 45deg) = 100 * cos(45deg) ~= 70.71; il = hc - idx = 100 - 70.71
		const topLeftInset = sites?.[1];
		expect(topLeftInset?.x).toBeCloseTo(29.29, 1);
		expect(topLeftInset?.y).toBeCloseTo(14.64, 1);
	});

	it('roundRect: cxnLst is the plain 4-cardinal fallback shape, independent of the corner-radius adj', () => {
		const sites = getPresetConnectionSites('roundRect', 200, 100, { adj: 50000 });
		expect(sites).toStrictEqual([
			{ x: 100, y: 0 },
			{ x: 0, y: 50 },
			{ x: 100, y: 100 },
			{ x: 200, y: 50 },
		]);
	});

	it('rightArrow: the shaft/head boundary (x1) responds to adj2, not just the cardinal box', () => {
		// adj2=100000 (max, ss=min(200,100)=100) -> a2=100000, dx1 = ss*a2/100000 = 100, x1 = r - dx1 = 200-100 = 100
		const sites = getPresetConnectionSites('rightArrow', 200, 100, { adj1: 50000, adj2: 100000 });
		expect(sites?.[0]).toStrictEqual({ x: 100, y: 0 });
	});

	it('normalizes a preset alias (oval -> ellipse) the same way lookupPresetShape does', () => {
		const aliased = getPresetConnectionSites('oval', 200, 100);
		const direct = getPresetConnectionSites('ellipse', 200, 100);
		expect(aliased).toStrictEqual(direct);
	});

	it('flowChartConnector: the circular il/it/ir/ib sites differ from a plain box (not the 4-cardinal fallback)', () => {
		const sites = getPresetConnectionSites('flowChartConnector', 200, 100);
		expect(sites).toHaveLength(8);
	});

	it('pentagon: resolves cos/sin-based guides (dx1/dx2/dy1/dy2) into distinct left/right vertex sites', () => {
		const sites = getPresetConnectionSites('pentagon', 200, 100);
		expect(sites).toHaveLength(6);
		expect(sites?.[1].x).not.toBe(sites?.[5].x);
	});
});

describe('lookupPresetConnectionSites', () => {
	it('returns undefined for an empty name', () => {
		expect(lookupPresetConnectionSites('')).toBeUndefined();
	});

	it('finds chevron directly', () => {
		expect(lookupPresetConnectionSites('chevron')).toBeDefined();
	});
});
