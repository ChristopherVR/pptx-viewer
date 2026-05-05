import { describe, expect, it } from 'vitest';

import {
	BLIP_FILL_ORDER,
	EFFECT_LST_ORDER,
	SP_PR_ORDER,
	TC_PR_BORDERS_ORDER,
	reorderObjectKeys,
} from './xml-reorder';

describe('reorderObjectKeys', () => {
	it('places schema keys first in the declared order', () => {
		const input = {
			'a:outerShdw': { '@_blurRad': '1' },
			'a:innerShdw': { '@_blurRad': '2' },
			'a:glow': { '@_rad': '3' },
			'a:blur': { '@_rad': '4' },
		};
		const result = reorderObjectKeys(input, EFFECT_LST_ORDER);
		expect(Object.keys(result)).toStrictEqual(['a:blur', 'a:glow', 'a:innerShdw', 'a:outerShdw']);
	});

	it('appends unknown keys after schema keys preserving their original order', () => {
		const input = {
			'@_misc': 'z',
			'a:outerShdw': {},
			'a:custom': {},
			'a:blur': {},
			'a:other': {},
		};
		const result = reorderObjectKeys(input, EFFECT_LST_ORDER);
		expect(Object.keys(result)).toStrictEqual([
			'a:blur',
			'a:outerShdw',
			'@_misc',
			'a:custom',
			'a:other',
		]);
	});

	it('skips keys whose values are undefined', () => {
		const input: Record<string, unknown> = {
			'a:blur': undefined,
			'a:glow': { '@_rad': '3' },
			'a:other': undefined,
			'a:keep': { keep: true },
		};
		const result = reorderObjectKeys(input, EFFECT_LST_ORDER);
		expect(Object.keys(result)).toStrictEqual(['a:glow', 'a:keep']);
		expect('a:blur' in result).toBeFalsy();
		expect('a:other' in result).toBeFalsy();
	});

	it('treats an empty schemaOrder as a no-op (preserves insertion order)', () => {
		const input = {
			zeta: 1,
			alpha: 2,
			beta: 3,
		};
		const result = reorderObjectKeys(input, []);
		expect(Object.keys(result)).toStrictEqual(['zeta', 'alpha', 'beta']);
		expect(result).toStrictEqual(input);
		expect(result).not.toBe(input);
	});

	it('does not mutate the input object', () => {
		const input = { 'a:outerShdw': {}, 'a:blur': {} };
		const inputKeysBefore = Object.keys(input);
		reorderObjectKeys(input, EFFECT_LST_ORDER);
		expect(Object.keys(input)).toStrictEqual(inputKeysBefore);
	});

	it('preserves values by reference', () => {
		const inner = { nested: true };
		const input = { 'a:glow': inner, 'a:blur': {} };
		const result = reorderObjectKeys(input, EFFECT_LST_ORDER);
		expect(result['a:glow']).toBe(inner);
	});

	it('orders spPr keys per CT_ShapeProperties', () => {
		const input = {
			'a:extLst': {},
			'a:effectLst': {},
			'a:ln': {},
			'a:solidFill': {},
			'a:prstGeom': {},
			'a:xfrm': {},
		};
		const result = reorderObjectKeys(input, SP_PR_ORDER);
		expect(Object.keys(result)).toStrictEqual([
			'a:xfrm',
			'a:prstGeom',
			'a:solidFill',
			'a:ln',
			'a:effectLst',
			'a:extLst',
		]);
	});

	it('orders tcPr borders per CT_TableCellProperties', () => {
		const input = {
			'a:lnB': {},
			'a:lnT': {},
			'a:lnR': {},
			'a:lnL': {},
			'@_marL': '0',
		};
		const result = reorderObjectKeys(input, TC_PR_BORDERS_ORDER);
		expect(Object.keys(result)).toStrictEqual(['a:lnL', 'a:lnR', 'a:lnT', 'a:lnB', '@_marL']);
	});

	it('orders blipFill children per CT_BlipFillProperties', () => {
		const input = {
			'a:stretch': {},
			'a:blip': {},
			'a:srcRect': {},
		};
		const result = reorderObjectKeys(input, BLIP_FILL_ORDER);
		expect(Object.keys(result)).toStrictEqual(['a:blip', 'a:srcRect', 'a:stretch']);
	});
});
