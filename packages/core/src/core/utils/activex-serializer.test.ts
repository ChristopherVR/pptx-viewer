import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { parseActiveXControlsFromSlide } from './activex-parser';
import { applyActiveXControlsToSlide, buildActiveXControlNode } from './activex-serializer';

/** Minimal slide XML carrying two `p:control` references plus a placeholder pic. */
function synthSlide(): XmlObject {
	return {
		'p:sld': {
			'p:cSld': {
				'p:spTree': {},
				'p:controls': {
					'p:control': [
						{
							'@_r:id': 'rId2',
							'@_name': 'CommandButton1',
							'@_spid': '1026',
							'p:pic': { 'p:nvPicPr': {}, 'p:blipFill': {}, 'p:spPr': {} },
						},
						{ '@_r:id': 'rId3', '@_spid': '1027' },
					],
				},
				'p:extLst': { 'p:ext': { '@_uri': '{X}' } },
			},
		},
	};
}

describe('activex control serialization', () => {
	it('round-trips typed ActiveX controls through parse and serialize', () => {
		const slide = synthSlide();
		const parsed = parseActiveXControlsFromSlide(slide);
		expect(parsed).toHaveLength(2);

		applyActiveXControlsToSlide(slide, parsed);
		const reparsed = parseActiveXControlsFromSlide(slide);

		expect(
			reparsed.map((c) => ({ relId: c.relId, name: c.name, shapeId: c.shapeId })),
		).toStrictEqual([
			{ relId: 'rId2', name: 'CommandButton1', shapeId: '1026' },
			{ relId: 'rId3', name: undefined, shapeId: '1027' },
		]);
	});

	it('preserves the placeholder pic child during a typed write', () => {
		const slide = synthSlide();
		const parsed = parseActiveXControlsFromSlide(slide);
		applyActiveXControlsToSlide(slide, parsed);

		const controls = ((slide['p:sld'] as XmlObject)['p:cSld'] as XmlObject)[
			'p:controls'
		] as XmlObject;
		const first = (controls['p:control'] as XmlObject[])[0];
		expect(first['p:pic']).toBeDefined();
	});

	it('serializes edited control attributes back into the slide', () => {
		const slide = synthSlide();
		const parsed = parseActiveXControlsFromSlide(slide);
		parsed[0].name = 'RenamedButton';
		parsed[0].relId = 'rId9';
		applyActiveXControlsToSlide(slide, parsed);

		const reparsed = parseActiveXControlsFromSlide(slide);
		expect(reparsed[0]).toMatchObject({ relId: 'rId9', name: 'RenamedButton', shapeId: '1026' });
	});

	it('drops the controls container when no controls remain', () => {
		const slide = synthSlide();
		applyActiveXControlsToSlide(slide, []);
		const cSld = (slide['p:sld'] as XmlObject)['p:cSld'] as XmlObject;
		expect(cSld['p:controls']).toBeUndefined();
	});

	it('keeps the controls container ahead of the extension list', () => {
		const cSld: XmlObject = { 'p:spTree': {}, 'p:extLst': { 'p:ext': {} } };
		const slide: XmlObject = { 'p:sld': { 'p:cSld': cSld } };
		applyActiveXControlsToSlide(slide, [{ relId: 'rId5', shapeId: '2048' }]);
		const keys = Object.keys((slide['p:sld'] as XmlObject)['p:cSld'] as XmlObject);
		expect(keys.indexOf('p:controls')).toBeLessThan(keys.indexOf('p:extLst'));
	});

	it('emits a bare control node when only a relationship id is known', () => {
		const node = buildActiveXControlNode({ relId: 'rId7' });
		expect(node).toStrictEqual({ '@_r:id': 'rId7' });
	});
});
