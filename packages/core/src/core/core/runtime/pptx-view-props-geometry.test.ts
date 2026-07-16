import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { buildViewPropertiesXml, parseViewProperties } from './pptx-view-props-helpers';

describe('view properties geometry', () => {
	it('parses Strict markup by local name with common-view nesting', () => {
		const result = parseViewProperties({
			'x:slideViewPr': {
				'x:cSldViewPr': {
					'@_snapToGrid': '1',
					'@_showGuides': '1',
					'x:cViewPr': {
						'@_varScale': '1',
						'x:scale': {
							'd:sx': { '@_n': '3', '@_d': '4' },
							'd:sy': { '@_n': '2', '@_d': '3' },
						},
						'x:origin': { '@_x': '-100', '@_y': '200' },
					},
					'x:guideLst': {
						'x:guide': [
							{ '@_orient': 'vert', '@_pos': '1000' },
							{ '@_orient': 'horz', '@_pos': '-2000' },
						],
					},
				},
			},
			'x:gridSpacing': { '@_cx': '76200', '@_cy': '38100' },
		});

		expect(result.slideViewPr).toMatchObject({
			snapToGrid: true,
			showGuides: true,
			variableScale: true,
			origin: { x: -100, y: 200 },
			scale: { n: 3, d: 4, sy: { n: 2, d: 3 } },
			guides: [
				{ orientation: 'vert', position: 1000 },
				{ orientation: 'horz', position: -2000 },
			],
		});
		expect(result.gridSpacing).toStrictEqual({ cx: 76200, cy: 38100 });
	});

	it('emits schema-correct generated geometry', () => {
		const root = buildViewPropertiesXml({
			slideViewPr: {
				variableScale: false,
				origin: { x: 10, y: 20 },
				scale: { n: 1, d: 2, sy: { n: 2, d: 3 } },
				guides: [{ orientation: 'vert', position: 300 }],
			},
			gridSpacing: { cx: 100, cy: 200 },
		})['p:viewPr'] as XmlObject;
		const slideView = root['p:slideViewPr'] as XmlObject;
		const commonSlideView = slideView['p:cSldViewPr'] as XmlObject;
		const common = commonSlideView['p:cViewPr'] as XmlObject;

		expect(common['@_varScale']).toBe('0');
		expect(common['p:scale']['a:sy']).toStrictEqual({ '@_n': '2', '@_d': '3' });
		expect(common['p:origin']).toStrictEqual({ '@_x': '10', '@_y': '20' });
		const guideList = commonSlideView['p:guideLst'] as XmlObject;
		expect(guideList['p:guide']).toHaveLength(1);
		expect(root['p:gridSpacing']).toMatchObject({ '@_cx': '100', '@_cy': '200' });
		expect(parseViewProperties(root).slideViewPr).toMatchObject({
			variableScale: false,
			origin: { x: 10, y: 20 },
			scale: { n: 1, d: 2, sy: { n: 2, d: 3 } },
			guides: [{ orientation: 'vert', position: 300 }],
		});
	});

	it('applies typed edits over raw custom-prefix XML and preserves extensions', () => {
		const raw = {
			'x:slideViewPr': {
				'@_custom': 'keep',
				'x:cSldViewPr': {
					'x:cViewPr': { 'x:ext': { '@_value': 'keep' } },
					'x:guideLst': { 'x:ext': { '@_value': 'keep' } },
				},
			},
			'x:extLst': { 'x:ext': { '@_uri': 'keep' } },
		};
		const root = buildViewPropertiesXml({
			rawXml: raw,
			slideViewPr: { origin: { x: 1, y: 2 }, guides: [{ position: 42 }] },
			gridSpacing: { cx: 50, cy: 60 },
		})['p:viewPr'] as XmlObject;
		const slideView = root['x:slideViewPr'] as XmlObject;
		const commonSlideView = slideView['x:cSldViewPr'] as XmlObject;
		const commonView = commonSlideView['x:cViewPr'] as XmlObject;
		const guideList = commonSlideView['x:guideLst'] as XmlObject;

		expect(slideView['@_custom']).toBe('keep');
		expect(commonView['x:ext']).toBeDefined();
		expect(guideList['x:ext']).toBeDefined();
		expect(root['x:gridSpacing']).toMatchObject({ '@_cx': '50', '@_cy': '60' });
		expect(root['x:extLst']).toBeDefined();
	});

	it('rejects invalid generated dimensions and ratios', () => {
		expect(() => buildViewPropertiesXml({ gridSpacing: { cx: 0, cy: 1 } })).toThrow(RangeError);
		expect(() => buildViewPropertiesXml({ slideViewPr: { scale: { n: 1, d: 0 } } })).toThrow(
			RangeError,
		);
	});
});
