/**
 * Simplified world-region outlines and coordinate-projection helpers for the
 * regionMap chart kind.
 *
 * Split out of `chart-waterfall-map.ts` (which re-exports the regionMap
 * builder that consumes these) to keep that file's two unrelated chart kinds
 * (waterfall, regionMap) each under the repo's per-file line budget.
 *
 * @module chart-map-projection
 */

import type { PptxChartRegionMapOptions } from 'pptx-viewer-core';

// ─────────────────────────────────────────────────────────────────────────────
// Simplified world region outlines (1000 x 500 viewBox)
// ─────────────────────────────────────────────────────────────────────────────

export interface RegionDef {
	code: string;
	name: string;
	/** SVG path d attribute (simplified outline on a 1000 x 500 coordinate system). */
	path: string;
	/** Label anchor [x, y] in the 1000 x 500 space. */
	labelXY: [number, number];
}

/** Simplified world region outlines (mirrors `WORLD_REGIONS` in React's chart-map.tsx). */
export const WORLD_REGIONS: RegionDef[] = [
	{
		code: 'US',
		name: 'United States',
		path: 'M130,160 L250,155 265,170 270,190 260,210 230,215 200,220 170,215 145,205 130,195Z M280,175 L295,165 310,170 310,185 295,195 280,190Z',
		labelXY: [200, 190],
	},
	{
		code: 'CA',
		name: 'Canada',
		path: 'M120,90 L280,85 290,100 295,130 280,150 250,155 200,155 160,155 130,155 115,140 110,115Z',
		labelXY: [200, 125],
	},
	{
		code: 'MX',
		name: 'Mexico',
		path: 'M145,215 L200,220 210,235 200,255 185,265 165,260 150,245 140,230Z',
		labelXY: [175, 240],
	},
	{
		code: 'BR',
		name: 'Brazil',
		path: 'M270,300 L310,280 335,290 340,320 330,355 310,370 285,365 265,345 260,320Z',
		labelXY: [300, 330],
	},
	{
		code: 'AR',
		name: 'Argentina',
		path: 'M260,370 L280,365 290,380 285,410 275,435 260,445 250,425 248,395Z',
		labelXY: [268, 410],
	},
	{
		code: 'GB',
		name: 'United Kingdom',
		path: 'M440,120 L448,110 455,115 455,135 448,142 440,138Z',
		labelXY: [448, 128],
	},
	{
		code: 'FR',
		name: 'France',
		path: 'M450,145 L470,140 480,150 478,168 465,175 450,170 445,158Z',
		labelXY: [463, 158],
	},
	{
		code: 'DE',
		name: 'Germany',
		path: 'M478,125 L498,120 505,130 502,148 490,152 478,148 475,138Z',
		labelXY: [490, 138],
	},
	{
		code: 'IT',
		name: 'Italy',
		path: 'M490,155 L498,152 505,162 500,180 492,190 488,178 486,165Z',
		labelXY: [495, 172],
	},
	{
		code: 'ES',
		name: 'Spain',
		path: 'M432,168 L460,165 465,175 460,188 442,192 430,185 428,175Z',
		labelXY: [448, 180],
	},
	{
		code: 'RU',
		name: 'Russia',
		path: 'M510,60 L780,50 830,70 840,100 820,120 750,115 700,105 650,100 580,105 530,110 510,100 505,80Z',
		labelXY: [670, 85],
	},
	{
		code: 'TR',
		name: 'Turkey',
		path: 'M530,165 L570,160 585,170 580,182 555,185 530,180Z',
		labelXY: [558, 175],
	},
	{
		code: 'EG',
		name: 'Egypt',
		path: 'M530,200 L555,195 565,205 560,225 545,230 530,222Z',
		labelXY: [548, 215],
	},
	{
		code: 'NG',
		name: 'Nigeria',
		path: 'M475,275 L500,270 510,280 505,298 490,302 475,295Z',
		labelXY: [492, 288],
	},
	{
		code: 'ZA',
		name: 'South Africa',
		path: 'M520,380 L545,370 560,380 555,400 540,410 520,405 515,392Z',
		labelXY: [538, 392],
	},
	{
		code: 'SA',
		name: 'Saudi Arabia',
		path: 'M565,220 L600,210 615,225 610,250 590,258 570,250 560,238Z',
		labelXY: [590, 238],
	},
	{
		code: 'IN',
		name: 'India',
		path: 'M640,210 L665,195 685,210 688,240 678,268 660,278 645,265 635,240Z',
		labelXY: [662, 240],
	},
	{
		code: 'CN',
		name: 'China',
		path: 'M700,120 L775,115 800,130 805,160 790,180 760,185 730,180 710,168 695,150 690,135Z',
		labelXY: [750, 155],
	},
	{
		code: 'JP',
		name: 'Japan',
		path: 'M835,145 L845,135 852,140 850,158 842,165 835,160Z',
		labelXY: [843, 152],
	},
	{
		code: 'KR',
		name: 'South Korea',
		path: 'M815,158 L825,152 830,160 827,170 818,172 813,165Z',
		labelXY: [822, 163],
	},
	{
		code: 'ID',
		name: 'Indonesia',
		path: 'M740,295 L780,288 810,292 830,298 825,310 790,312 755,308 740,305Z',
		labelXY: [785, 302],
	},
	{
		code: 'AU',
		name: 'Australia',
		path: 'M790,350 L850,340 880,355 885,385 870,405 840,410 810,400 790,380Z',
		labelXY: [838, 378],
	},
];

// ─────────────────────────────────────────────────────────────────────────────
// Region bounding-box helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface RegionBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export function regionBounds(region: RegionDef): RegionBounds {
	const coordinates = region.path.match(/-?\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
	const xs: number[] = [];
	const ys: number[] = [];
	for (let index = 0; index < coordinates.length; index += 2) {
		xs.push(coordinates[index] ?? 0);
		ys.push(coordinates[index + 1] ?? 0);
	}
	return {
		minX: Math.min(...xs),
		minY: Math.min(...ys),
		maxX: Math.max(...xs),
		maxY: Math.max(...ys),
	};
}

export function regionViewBounds(
	viewedRegionType: PptxChartRegionMapOptions['viewedRegionType'],
	regionValues: ReadonlyMap<string, unknown>,
): RegionBounds {
	if (!viewedRegionType || viewedRegionType === 'world' || regionValues.size === 0) {
		return { minX: 0, minY: 0, maxX: 1000, maxY: 500 };
	}
	const matched = WORLD_REGIONS.filter((region) => regionValues.has(region.code));
	const targets = viewedRegionType === 'countryRegion' ? matched.slice(0, 1) : matched;
	if (targets.length === 0) {
		return { minX: 0, minY: 0, maxX: 1000, maxY: 500 };
	}
	const bounds = targets.map(regionBounds);
	const padding = 10;
	return {
		minX: Math.max(0, Math.min(...bounds.map((item) => item.minX)) - padding),
		minY: Math.max(0, Math.min(...bounds.map((item) => item.minY)) - padding),
		maxX: Math.min(1000, Math.max(...bounds.map((item) => item.maxX)) + padding),
		maxY: Math.min(500, Math.max(...bounds.map((item) => item.maxY)) + padding),
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Path scaling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-scale and translate each coordinate pair in a simple SVG path `d`
 * attribute (M/L/Z commands only, space/comma delimited).
 *
 * This avoids needing a `transform` attribute on `SvgPath` which doesn't exist
 * in the existing primitive schema.
 */
export function scalePathD(d: string, scale: number, dx: number, dy: number): string {
	// Tokenise: split on whitespace, commas, and command letters while keeping
	// command letters in the output.
	const tokens = d.trim().split(/[\s,]+/u);
	const out: string[] = [];
	let i = 0;
	while (i < tokens.length) {
		const tok = tokens[i];
		if (tok === undefined) {
			i++;
			continue;
		}
		// Command letter (M, L, Z, etc.)
		if (/^[A-Za-z]$/u.test(tok)) {
			out.push(tok);
			i++;
			continue;
		}
		// Coordinate pair: tok = x value, tokens[i+1] = y value.
		const xRaw = parseFloat(tok);
		const yRaw = parseFloat(tokens[i + 1] ?? '0');
		if (!Number.isNaN(xRaw) && !Number.isNaN(yRaw)) {
			out.push(`${(xRaw * scale + dx).toFixed(2)},${(yRaw * scale + dy).toFixed(2)}`);
			i += 2;
		} else {
			out.push(tok);
			i++;
		}
	}
	return out.join(' ');
}
