import { describe, it, expect } from 'vitest';

import type { CustomGeometryPath } from '../types';
import {
	customGeometryPathsToSvg,
	customGeometryPathsToSvgSubpaths,
	svgToCustomGeometryPaths,
	customGeometryPathsToXml,
	getAllPointsFromPaths,
	recalculatePathBounds,
} from './custom-geometry';

// ---------------------------------------------------------------------------
// customGeometryPathsToSvgSubpaths
// ---------------------------------------------------------------------------

describe('customGeometryPathsToSvgSubpaths', () => {
	it('keeps each sub-path separate with its fill/stroke flags', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				fillMode: 'norm',
				stroke: true,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{ type: 'lineTo', pt: { x: 100, y: 100 } },
					{ type: 'close' },
				],
			},
			{
				width: 100,
				height: 100,
				fillMode: 'none',
				stroke: true,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 50 } },
					{ type: 'lineTo', pt: { x: 100, y: 50 } },
				],
			},
		];
		const result = customGeometryPathsToSvgSubpaths(paths, 100, 100);
		expect(result).toHaveLength(2);
		expect(result[0]).toStrictEqual({
			d: 'M 0 0 L 100 100 Z',
			fillMode: 'norm',
			stroke: true,
		});
		expect(result[1]).toStrictEqual({
			d: 'M 0 50 L 100 50',
			fillMode: 'none',
			stroke: true,
		});
	});

	it('scales a sub-path from its own @w/@h into the target coordinate space', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 200,
				height: 400,
				segments: [
					{ type: 'moveTo', pt: { x: 100, y: 200 } },
					{ type: 'lineTo', pt: { x: 200, y: 400 } },
				],
			},
		];
		// Target space is 100x100, so x halves and y quarters.
		const [sub] = customGeometryPathsToSvgSubpaths(paths, 100, 100);
		expect(sub.d).toBe('M 50 50 L 100 100');
	});

	it('handles a stroke-off (@stroke=0) sub-path flag', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 10,
				height: 10,
				stroke: false,
				segments: [{ type: 'moveTo', pt: { x: 0, y: 0 } }],
			},
		];
		const [sub] = customGeometryPathsToSvgSubpaths(paths, 10, 10);
		expect(sub.stroke).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// customGeometryPathsToSvg
// ---------------------------------------------------------------------------

describe('customGeometryPathsToSvg', () => {
	it('converts a simple triangle to SVG path data', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 50, y: 0 } },
					{ type: 'lineTo', pt: { x: 100, y: 100 } },
					{ type: 'lineTo', pt: { x: 0, y: 100 } },
					{ type: 'close' },
				],
			},
		];
		expect(customGeometryPathsToSvg(paths)).toBe('M 50 0 L 100 100 L 0 100 Z');
	});

	it('converts a cubic Bezier segment', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{
						type: 'cubicBezTo',
						pts: [
							{ x: 33, y: 0 },
							{ x: 66, y: 100 },
							{ x: 100, y: 100 },
						],
					},
				],
			},
		];
		expect(customGeometryPathsToSvg(paths)).toBe('M 0 0 C 33 0 66 100 100 100');
	});

	it('converts a quadratic Bezier segment', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{
						type: 'quadBezTo',
						pts: [
							{ x: 50, y: 100 },
							{ x: 100, y: 0 },
						],
					},
				],
			},
		];
		expect(customGeometryPathsToSvg(paths)).toBe('M 0 0 Q 50 100 100 0');
	});

	it('handles multiple paths concatenated', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{ type: 'lineTo', pt: { x: 100, y: 0 } },
					{ type: 'close' },
				],
			},
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 50 } },
					{ type: 'lineTo', pt: { x: 100, y: 50 } },
				],
			},
		];
		expect(customGeometryPathsToSvg(paths)).toBe('M 0 0 L 100 0 Z M 0 50 L 100 50');
	});

	it('returns empty string for empty paths array', () => {
		expect(customGeometryPathsToSvg([])).toBe('');
	});

	it('handles close command restoring pen to last moveTo position', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 10, y: 20 } },
					{ type: 'lineTo', pt: { x: 90, y: 80 } },
					{ type: 'close' },
					{ type: 'lineTo', pt: { x: 50, y: 50 } },
				],
			},
		];
		// After close, pen should be at (10, 20) from the last moveTo
		// The subsequent lineTo should go from there to (50, 50)
		const result = customGeometryPathsToSvg(paths);
		expect(result).toBe('M 10 20 L 90 80 Z L 50 50');
	});
});

// ---------------------------------------------------------------------------
// svgToCustomGeometryPaths
// ---------------------------------------------------------------------------

describe('svgToCustomGeometryPaths', () => {
	it('parses M and L commands', () => {
		const paths = svgToCustomGeometryPaths('M 0 0 L 100 100', 100, 100);
		expect(paths).toHaveLength(1);
		expect(paths[0].width).toBe(100);
		expect(paths[0].height).toBe(100);
		expect(paths[0].segments).toHaveLength(2);
		expect(paths[0].segments[0]).toStrictEqual({
			type: 'moveTo',
			pt: { x: 0, y: 0 },
		});
		expect(paths[0].segments[1]).toStrictEqual({
			type: 'lineTo',
			pt: { x: 100, y: 100 },
		});
	});

	it('parses Z (close) commands', () => {
		const paths = svgToCustomGeometryPaths('M 0 0 L 100 0 L 100 100 Z', 100, 100);
		expect(paths[0].segments).toHaveLength(4);
		expect(paths[0].segments[3]).toStrictEqual({ type: 'close' });
	});

	it('parses C (cubic Bezier) commands', () => {
		const paths = svgToCustomGeometryPaths('M 0 0 C 10 20 30 40 50 60', 100, 100);
		expect(paths[0].segments[1]).toStrictEqual({
			type: 'cubicBezTo',
			pts: [
				{ x: 10, y: 20 },
				{ x: 30, y: 40 },
				{ x: 50, y: 60 },
			],
		});
	});

	it('parses Q (quadratic Bezier) commands', () => {
		const paths = svgToCustomGeometryPaths('M 0 0 Q 50 100 100 0', 100, 100);
		expect(paths[0].segments[1]).toStrictEqual({
			type: 'quadBezTo',
			pts: [
				{ x: 50, y: 100 },
				{ x: 100, y: 0 },
			],
		});
	});

	it('returns a single path with empty segments for empty input', () => {
		const paths = svgToCustomGeometryPaths('', 100, 100);
		expect(paths).toHaveLength(1);
		expect(paths[0].segments).toHaveLength(0);
	});

	it('ignores commands with insufficient coordinates', () => {
		// L needs 2 coords, only 1 given
		const paths = svgToCustomGeometryPaths('M 0 0 L 50', 100, 100);
		expect(paths[0].segments).toHaveLength(1); // Only M parsed
	});
});

// ---------------------------------------------------------------------------
// customGeometryPathsToSvg / svgToCustomGeometryPaths round-trip
// ---------------------------------------------------------------------------

describe('sVG path round-trip', () => {
	it('round-trips a simple polygon path', () => {
		const original = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
		const paths = svgToCustomGeometryPaths(original, 100, 100);
		const svg = customGeometryPathsToSvg(paths);
		expect(svg).toBe(original);
	});
});

// ---------------------------------------------------------------------------
// customGeometryPathsToXml
// ---------------------------------------------------------------------------

describe('customGeometryPathsToXml', () => {
	it('produces a valid a:custGeom XML structure', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 200,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{ type: 'lineTo', pt: { x: 100, y: 200 } },
					{ type: 'close' },
				],
			},
		];
		const xml = customGeometryPathsToXml(paths);
		expect(xml['a:avLst']).toStrictEqual({});
		expect(xml['a:gdLst']).toStrictEqual({});
		expect(xml['a:ahLst']).toStrictEqual({});
		expect(xml['a:cxnLst']).toStrictEqual({});
		expect(xml['a:rect']).toStrictEqual({
			'@_l': 'l',
			'@_t': 't',
			'@_r': 'r',
			'@_b': 'b',
		});
		const pathXml = xml['a:pathLst']['a:path'];
		expect(pathXml['@_w']).toBe('100');
		expect(pathXml['@_h']).toBe('200');
		expect(pathXml['a:moveTo']).toBeDefined();
		expect(pathXml['a:lnTo']).toBeDefined();
		expect(pathXml['a:close']).toStrictEqual({});
	});

	it('serializes multiple moveTo and lineTo elements correctly', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{ type: 'lineTo', pt: { x: 50, y: 0 } },
					{ type: 'lineTo', pt: { x: 100, y: 100 } },
				],
			},
		];
		const xml = customGeometryPathsToXml(paths);
		const pathXml = xml['a:pathLst']['a:path'];
		// Multiple lineTo segments should be an array
		expect(Array.isArray(pathXml['a:lnTo'])).toBeTruthy();
		expect(pathXml['a:lnTo']).toHaveLength(2);
	});

	it('serializes cubic Bezier segments', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{
						type: 'cubicBezTo',
						pts: [
							{ x: 10, y: 20 },
							{ x: 30, y: 40 },
							{ x: 50, y: 60 },
						],
					},
				],
			},
		];
		const xml = customGeometryPathsToXml(paths);
		const pathXml = xml['a:pathLst']['a:path'];
		expect(pathXml['a:cubicBezTo']).toBeDefined();
		const pts = pathXml['a:cubicBezTo']['a:pt'];
		expect(pts).toHaveLength(3);
		expect(pts[0]).toStrictEqual({ '@_x': '10', '@_y': '20' });
	});

	it('serializes arcTo segments', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 50, y: 0 } },
					{ type: 'arcTo', wR: 50, hR: 50, stAng: 0, swAng: 5400000 },
				],
			},
		];
		const xml = customGeometryPathsToXml(paths);
		const pathXml = xml['a:pathLst']['a:path'];
		expect(pathXml['a:arcTo']).toBeDefined();
		expect(pathXml['a:arcTo']['@_wR']).toBe('50');
		expect(pathXml['a:arcTo']['@_hR']).toBe('50');
		expect(pathXml['a:arcTo']['@_stAng']).toBe('0');
		expect(pathXml['a:arcTo']['@_swAng']).toBe('5400000');
	});
});

// ---------------------------------------------------------------------------
// getAllPointsFromPaths
// ---------------------------------------------------------------------------

describe('getAllPointsFromPaths', () => {
	it('extracts points from moveTo and lineTo segments', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{ type: 'lineTo', pt: { x: 100, y: 100 } },
					{ type: 'close' },
				],
			},
		];
		const points = getAllPointsFromPaths(paths);
		expect(points).toHaveLength(2);
		expect(points[0]).toStrictEqual({ x: 0, y: 0 });
		expect(points[1]).toStrictEqual({ x: 100, y: 100 });
	});

	it('extracts all 3 control points from cubicBezTo', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{
						type: 'cubicBezTo',
						pts: [
							{ x: 10, y: 20 },
							{ x: 30, y: 40 },
							{ x: 50, y: 60 },
						],
					},
				],
			},
		];
		expect(getAllPointsFromPaths(paths)).toHaveLength(3);
	});

	it('extracts both control points from quadBezTo', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{
						type: 'quadBezTo',
						pts: [
							{ x: 25, y: 50 },
							{ x: 75, y: 50 },
						],
					},
				],
			},
		];
		expect(getAllPointsFromPaths(paths)).toHaveLength(2);
	});

	it('ignores arcTo and close segments', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [{ type: 'arcTo', wR: 50, hR: 50, stAng: 0, swAng: 5400000 }, { type: 'close' }],
			},
		];
		expect(getAllPointsFromPaths(paths)).toHaveLength(0);
	});

	it('returns empty array for empty paths', () => {
		expect(getAllPointsFromPaths([])).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// recalculatePathBounds
// ---------------------------------------------------------------------------

describe('recalculatePathBounds', () => {
	it('returns { width: 1, height: 1 } for empty paths', () => {
		expect(recalculatePathBounds([])).toStrictEqual({ width: 1, height: 1 });
	});

	it('calculates tight bounds from all points', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 200,
				height: 200,
				segments: [
					{ type: 'moveTo', pt: { x: 10, y: 20 } },
					{ type: 'lineTo', pt: { x: 150, y: 80 } },
					{ type: 'lineTo', pt: { x: 50, y: 120 } },
				],
			},
		];
		const bounds = recalculatePathBounds(paths);
		expect(bounds.width).toBe(150);
		expect(bounds.height).toBe(120);
	});

	it('enforces minimum dimensions of 1', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [{ type: 'moveTo', pt: { x: 0, y: 0 } }],
			},
		];
		const bounds = recalculatePathBounds(paths);
		expect(bounds.width).toBe(1);
		expect(bounds.height).toBe(1);
	});

	it('handles paths spanning multiple sub-paths', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [{ type: 'moveTo', pt: { x: 50, y: 30 } }],
			},
			{
				width: 100,
				height: 100,
				segments: [{ type: 'lineTo', pt: { x: 200, y: 150 } }],
			},
		];
		const bounds = recalculatePathBounds(paths);
		expect(bounds.width).toBe(200);
		expect(bounds.height).toBe(150);
	});
});

// ---------------------------------------------------------------------------
// customGeometryPathsToXml — Phase 5 Stream A item 5 (G-H1, G-H2)
// ---------------------------------------------------------------------------

describe('customGeometryPathsToXml — round-trip extension', () => {
	it('preserves raw adjustment, guide, handle, connection, and text-rect data', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [
					{ type: 'moveTo', pt: { x: 0, y: 0 } },
					{ type: 'lineTo', pt: { x: 100, y: 100 } },
				],
			},
		];
		const rawData = {
			avLstXml: { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
			gdLstXml: { 'a:gd': [{ '@_name': 'g1', '@_fmla': 'val 21600' }] },
			ahLstXml: { 'a:ahXY': { '@_gdRefX': 'adj1', 'a:pos': { '@_x': '50', '@_y': '50' } } },
			cxnLstXml: { 'a:cxn': { '@_ang': '0', 'a:pos': { '@_x': '0', '@_y': '50' } } },
			rectXml: { '@_l': 'g1', '@_t': '0', '@_r': '100', '@_b': '100' },
		};
		const xml = customGeometryPathsToXml(paths, rawData);
		expect(xml['a:avLst']).toBe(rawData.avLstXml);
		expect(xml['a:gdLst']).toBe(rawData.gdLstXml);
		expect(xml['a:ahLst']).toBe(rawData.ahLstXml);
		expect(xml['a:cxnLst']).toBe(rawData.cxnLstXml);
		expect(xml['a:rect']).toBe(rawData.rectXml);
	});

	it('emits path-level @_fill, @_stroke, @_extrusionOk attributes (G-H2)', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [{ type: 'moveTo', pt: { x: 0, y: 0 } }],
				fillMode: 'darken',
				stroke: false,
				extrusionOk: true,
			},
		];
		const xml = customGeometryPathsToXml(paths);
		const pathXml = xml['a:pathLst']['a:path'];
		expect(pathXml['@_fill']).toBe('darken');
		expect(pathXml['@_stroke']).toBe('0');
		expect(pathXml['@_extrusionOk']).toBe('1');
	});

	it('omits path-level attributes when not specified', () => {
		const paths: CustomGeometryPath[] = [
			{
				width: 100,
				height: 100,
				segments: [{ type: 'moveTo', pt: { x: 0, y: 0 } }],
			},
		];
		const xml = customGeometryPathsToXml(paths);
		const pathXml = xml['a:pathLst']['a:path'];
		expect(pathXml['@_fill']).toBeUndefined();
		expect(pathXml['@_stroke']).toBeUndefined();
		expect(pathXml['@_extrusionOk']).toBeUndefined();
	});
});
