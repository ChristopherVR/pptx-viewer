import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { customGeometryPathsToXml } from './custom-geometry';
import { parseStructuredCustomGeometry } from './custom-geometry-parser';

const ensureArray = (value: unknown): unknown[] =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

describe('parseStructuredCustomGeometry', () => {
	it('preserves formula-resolved arcs and path-specific attributes', () => {
		const geometry: XmlObject = {
			'a:avLst': { 'a:gd': { '@_name': 'adj', '@_fmla': 'val 25' } },
			'a:gdLst': { 'a:gd': { '@_name': 'radius', '@_fmla': '*/ w adj 100' } },
			'a:pathLst': {
				'a:path': [
					{
						'@_w': '200',
						'@_h': '100',
						'@_fill': 'none',
						'@_stroke': '0',
						'a:moveTo': { 'a:pt': { '@_x': 'radius', '@_y': '0' } },
						'a:arcTo': {
							'@_wR': 'radius',
							'@_hR': '25',
							'@_stAng': '0',
							'@_swAng': '5400000',
						},
					},
					{
						'@_w': '400',
						'@_h': '300',
						'@_fill': 'darkenLess',
						'@_extrusionOk': '1',
						'a:moveTo': { 'a:pt': { '@_x': '0', '@_y': '0' } },
						'a:lnTo': { 'a:pt': { '@_x': '400', '@_y': '300' } },
					},
				],
			},
		};

		const paths = parseStructuredCustomGeometry(geometry, 200, 100, ensureArray);

		expect(paths).toHaveLength(2);
		expect(paths[0]).toMatchObject({ width: 200, height: 100, fillMode: 'none', stroke: false });
		expect(paths[0].segments).toStrictEqual([
			{ type: 'moveTo', pt: { x: 50, y: 0 } },
			{ type: 'arcTo', wR: 50, hR: 25, stAng: 0, swAng: 5400000 },
		]);
		expect(paths[1]).toMatchObject({
			width: 400,
			height: 300,
			fillMode: 'darkenLess',
			extrusionOk: true,
		});

		const serialized = customGeometryPathsToXml(paths);
		const serializedPaths = serialized['a:pathLst']['a:path'] as XmlObject[];
		expect(serializedPaths).toHaveLength(2);
		expect(serializedPaths[0]['a:arcTo']).toStrictEqual({
			'@_wR': '50',
			'@_hR': '25',
			'@_stAng': '0',
			'@_swAng': '5400000',
		});
		expect(serializedPaths[1]['@_fill']).toBe('darkenLess');
	});
});
