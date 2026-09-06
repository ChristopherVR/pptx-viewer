import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { extractAfterAnimationFromSubTnLst } from './native-animation-after-effect';

/** Build the genuine COM-measured dim `p:subTnLst` (see module doc for provenance). */
function dimSubTnLst(colorHex: string): XmlObject {
	return {
		'p:animClr': {
			'@_clrSpc': 'rgb',
			'@_dir': 'cw',
			'p:cBhvr': {
				'@_override': 'childStyle',
				'p:cTn': {
					'@_dur': '1',
					'@_fill': 'hold',
					'@_display': '0',
					'@_masterRel': 'nextClick',
					'@_afterEffect': '1',
				},
				'p:tgtEl': { 'p:spTgt': { '@_spid': '2' } },
				'p:attrNameLst': { 'p:attrName': 'ppt_c' },
			},
			'p:to': { 'a:srgbClr': { '@_val': colorHex } },
		},
	};
}

function hideSubTnLst(masterRel: 'sameClick' | 'nextClick', entranceId?: string): XmlObject {
	const cTn: XmlObject = {
		'@_dur': '1',
		'@_fill': 'hold',
		'@_display': '0',
		'@_masterRel': masterRel,
		'@_afterEffect': '1',
	};
	if (masterRel === 'sameClick') {
		cTn['p:stCondLst'] = {
			'p:cond': { '@_evt': 'end', '@_delay': '0', 'p:tn': { '@_val': entranceId } },
		};
	}
	return {
		'p:set': {
			'p:cBhvr': {
				'@_override': 'childStyle',
				'p:cTn': cTn,
				'p:tgtEl': { 'p:spTgt': { '@_spid': '2' } },
				'p:attrNameLst': { 'p:attrName': 'style.visibility' },
			},
			'p:to': { 'p:strVal': { '@_val': 'hidden' } },
		},
	};
}

describe('extractAfterAnimationFromSubTnLst', () => {
	it('returns undefined when the cTn has no p:subTnLst', () => {
		expect(extractAfterAnimationFromSubTnLst({})).toBeUndefined();
	});

	it('decodes a genuine dim-to-RGB-colour behaviour', () => {
		const cTn: XmlObject = { 'p:subTnLst': dimSubTnLst('808080') };
		expect(extractAfterAnimationFromSubTnLst(cTn)).toStrictEqual({
			action: 'dimToColor',
			color: '#808080',
		});
	});

	it('decodes a dim behaviour with a scheme colour as a theme colour ref', () => {
		const subTnLst: XmlObject = {
			'p:animClr': {
				'p:cBhvr': {
					'p:cTn': { '@_afterEffect': '1', '@_masterRel': 'nextClick' },
					'p:attrNameLst': { 'p:attrName': 'ppt_c' },
				},
				'p:to': { 'a:schemeClr': { '@_val': 'accent2' } },
			},
		};
		expect(extractAfterAnimationFromSubTnLst({ 'p:subTnLst': subTnLst })).toStrictEqual({
			action: 'dimToColor',
			colorRef: { scheme: 'accent2' },
		});
	});

	it('does not treat an animClr with a different attrName as an after-effect', () => {
		const subTnLst: XmlObject = {
			'p:animClr': {
				'p:cBhvr': {
					'p:cTn': { '@_afterEffect': '1' },
					'p:attrNameLst': { 'p:attrName': 'fillcolor' },
				},
				'p:to': { 'a:srgbClr': { '@_val': '00FF00' } },
			},
		};
		expect(extractAfterAnimationFromSubTnLst({ 'p:subTnLst': subTnLst })).toBeUndefined();
	});

	it('decodes hideAfterAnimation from a sameClick masterRel', () => {
		const cTn: XmlObject = { '@_id': '13', 'p:subTnLst': hideSubTnLst('sameClick', '13') };
		expect(extractAfterAnimationFromSubTnLst(cTn)).toStrictEqual({ action: 'hideAfterAnimation' });
	});

	it('decodes hideOnNextClick from a nextClick masterRel', () => {
		const cTn: XmlObject = { 'p:subTnLst': hideSubTnLst('nextClick') };
		expect(extractAfterAnimationFromSubTnLst(cTn)).toStrictEqual({ action: 'hideOnNextClick' });
	});

	it('ignores a p:set whose target value is not "hidden"', () => {
		const subTnLst: XmlObject = {
			'p:set': {
				'p:cBhvr': {
					'p:cTn': { '@_afterEffect': '1', '@_masterRel': 'nextClick' },
					'p:attrNameLst': { 'p:attrName': 'style.visibility' },
				},
				'p:to': { 'p:strVal': { '@_val': 'visible' } },
			},
		};
		expect(extractAfterAnimationFromSubTnLst({ 'p:subTnLst': subTnLst })).toBeUndefined();
	});

	it('requires the afterEffect flag on the behaviour cTn, not just masterRel', () => {
		const subTnLst: XmlObject = {
			'p:set': {
				'p:cBhvr': {
					'p:cTn': { '@_masterRel': 'sameClick' },
					'p:attrNameLst': { 'p:attrName': 'style.visibility' },
				},
				'p:to': { 'p:strVal': { '@_val': 'hidden' } },
			},
		};
		expect(extractAfterAnimationFromSubTnLst({ 'p:subTnLst': subTnLst })).toBeUndefined();
	});
});
