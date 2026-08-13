import { describe, expect, it } from 'vitest';

import type { TextStyle, XmlObject } from '../types';
import { parseTextBodySp3d } from './text-body-sp3d';

const parseColor = (node: XmlObject | undefined): string | undefined => {
	const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
	return srgb?.['@_val'] ? `#${String(srgb['@_val'])}` : undefined;
};

/** Every numeric field of the parsed text3d, so a NaN cannot hide. */
function numericFields(style: TextStyle): Array<[string, number]> {
	return Object.entries(style.text3d ?? {}).filter(
		(entry): entry is [string, number] => typeof entry[1] === 'number',
	);
}

describe('parseTextBodySp3d - absent attributes must not become NaN', () => {
	it('omits extrusionHeight and bevel width/height when the source declares none', () => {
		// Exactly what PowerPoint writes for a default top bevel.
		const bodyPr: XmlObject = { 'a:sp3d': { 'a:bevelT': { '@_prst': 'circle' } } };
		const style: TextStyle = {};

		parseTextBodySp3d(bodyPr, style, parseColor);

		expect(style.text3d).toStrictEqual({ bevelTopType: 'circle' });
		for (const [field, value] of numericFields(style)) {
			expect(Number.isNaN(value), `${field} is NaN`).toBeFalsy();
		}
	});

	it('omits every numeric field for a bare a:sp3d with both bevels', () => {
		const bodyPr: XmlObject = {
			'a:sp3d': { 'a:bevelT': { '@_prst': 'circle' }, 'a:bevelB': { '@_prst': 'angle' } },
		};
		const style: TextStyle = {};

		parseTextBodySp3d(bodyPr, style, parseColor);

		expect(style.text3d).toStrictEqual({
			bevelTopType: 'circle',
			bevelBottomType: 'angle',
		});
		expect(numericFields(style)).toStrictEqual([]);
	});

	it('still reads the attributes that ARE present', () => {
		const bodyPr: XmlObject = {
			'a:sp3d': {
				'@_extrusionH': '57150',
				'@_prstMaterial': 'metal',
				'a:extrusionClr': { 'a:srgbClr': { '@_val': 'FF0000' } },
				'a:bevelT': { '@_prst': 'coolSlant', '@_w': '63500', '@_h': '25400' },
				'a:bevelB': { '@_prst': 'circle', '@_w': '12700' },
			},
		};
		const style: TextStyle = {};

		parseTextBodySp3d(bodyPr, style, parseColor);

		expect(style.text3d).toStrictEqual({
			extrusionHeight: 57150,
			extrusionColor: '#FF0000',
			presetMaterial: 'metal',
			bevelTopType: 'coolSlant',
			bevelTopWidth: 63500,
			bevelTopHeight: 25400,
			bevelBottomType: 'circle',
			bevelBottomWidth: 12700,
		});
	});

	it('ignores a non-numeric attribute rather than storing NaN', () => {
		const bodyPr: XmlObject = { 'a:sp3d': { '@_extrusionH': 'not-a-number' } };
		const style: TextStyle = {};

		parseTextBodySp3d(bodyPr, style, parseColor);

		expect(style.text3d).toBeUndefined();
	});

	it('leaves text3d unset when there is no a:sp3d at all', () => {
		const style: TextStyle = {};
		parseTextBodySp3d({ '@_wrap': 'square' }, style, parseColor);
		expect(style.text3d).toBeUndefined();
	});
});
