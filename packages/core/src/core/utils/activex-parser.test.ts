import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { parseActiveXControlsFromSlide } from './activex-parser';

function slideWithControls(controls: XmlObject): XmlObject {
	return { 'p:sld': { 'p:cSld': { 'p:controls': controls } } };
}

describe('parseActiveXControlsFromSlide', () => {
	it('returns an empty array when there are no controls', () => {
		expect(parseActiveXControlsFromSlide({ 'p:sld': { 'p:cSld': {} } })).toStrictEqual([]);
	});

	it('parses a direct p:control with relId/name/spid', () => {
		const controls = parseActiveXControlsFromSlide(
			slideWithControls({
				'p:control': { '@_r:id': 'rId5', '@_name': 'CommandButton1', '@_spid': '_x0000_s1026' },
			}),
		);
		expect(controls).toHaveLength(1);
		expect(controls[0]).toMatchObject({
			relId: 'rId5',
			name: 'CommandButton1',
			shapeId: '_x0000_s1026',
		});
	});

	it('extracts geometry and fallback picture relId from an AlternateContent fallback', () => {
		const controls = parseActiveXControlsFromSlide(
			slideWithControls({
				'mc:AlternateContent': {
					'mc:Choice': {
						'@_Requires': 'v',
						'p:control': { '@_r:id': 'rId5', '@_name': 'Btn', '@_spid': '_x0000_s1026' },
					},
					'mc:Fallback': {
						'p:control': {
							'@_r:id': 'rId5',
							'@_name': 'Btn',
							'@_spid': '_x0000_s1026',
							'p:pic': {
								'p:blipFill': { 'a:blip': { '@_r:embed': 'rId6' } },
								'p:spPr': {
									'a:xfrm': {
										'a:off': { '@_x': 914400, '@_y': 457200 },
										'a:ext': { '@_cx': 1828800, '@_cy': 914400 },
									},
								},
							},
						},
					},
				},
			}),
		);

		expect(controls).toHaveLength(1);
		expect(controls[0]).toMatchObject({
			relId: 'rId5',
			fallbackImageRelId: 'rId6',
			// 914400 EMU / 9525 = 96 px, etc.
			x: 96,
			y: 48,
			width: 192,
			height: 96,
		});
	});

	it('dedupes a control present in both choice and fallback, keeping the preview', () => {
		const controls = parseActiveXControlsFromSlide(
			slideWithControls({
				'mc:AlternateContent': {
					'mc:Choice': {
						'@_Requires': 'v',
						'p:control': { '@_r:id': 'rId9', '@_spid': 's1' },
					},
					'mc:Fallback': {
						'p:control': {
							'@_r:id': 'rId9',
							'@_spid': 's1',
							'p:pic': { 'p:blipFill': { 'a:blip': { '@_r:embed': 'rId10' } } },
						},
					},
				},
			}),
		);
		expect(controls).toHaveLength(1);
		expect(controls[0].fallbackImageRelId).toBe('rId10');
	});
});
