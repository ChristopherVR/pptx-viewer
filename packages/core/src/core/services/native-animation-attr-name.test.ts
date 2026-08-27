import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import {
	extractAttrNameFromCBhvr,
	extractChildKeyframeAttrName,
} from './native-animation-attr-name';

describe('extractAttrNameFromCBhvr', () => {
	it('returns undefined when p:cBhvr is absent', () => {
		expect(extractAttrNameFromCBhvr(undefined)).toBeUndefined();
	});

	it('returns undefined when p:attrNameLst is absent', () => {
		expect(extractAttrNameFromCBhvr({ 'p:cTn': {} })).toBeUndefined();
	});

	it('reads a plain-string p:attrName (fast-xml-parser text-node shape)', () => {
		const cBhvr: XmlObject = {
			'p:attrNameLst': { 'p:attrName': 'style.opacity' },
		};
		expect(extractAttrNameFromCBhvr(cBhvr)).toBe('style.opacity');
	});

	it('reads a { "#text": ... } shaped p:attrName without dropping it', () => {
		const cBhvr: XmlObject = {
			'p:attrNameLst': { 'p:attrName': { '#text': 'fillcolor' } },
		};
		expect(extractAttrNameFromCBhvr(cBhvr)).toBe('fillcolor');
	});

	it('lowercases and trims the attribute name', () => {
		const cBhvr: XmlObject = {
			'p:attrNameLst': { 'p:attrName': '  Style.Opacity  ' },
		};
		expect(extractAttrNameFromCBhvr(cBhvr)).toBe('style.opacity');
	});

	it('takes the first name when p:attrName is an array', () => {
		const cBhvr: XmlObject = {
			'p:attrNameLst': { 'p:attrName': ['ppt_x', 'ppt_y'] },
		};
		expect(extractAttrNameFromCBhvr(cBhvr)).toBe('ppt_x');
	});

	it('returns undefined for a blank attribute name', () => {
		const cBhvr: XmlObject = {
			'p:attrNameLst': { 'p:attrName': '   ' },
		};
		expect(extractAttrNameFromCBhvr(cBhvr)).toBeUndefined();
	});
});

describe('extractChildKeyframeAttrName', () => {
	it('returns undefined when childTnList is absent', () => {
		expect(extractChildKeyframeAttrName(undefined)).toBeUndefined();
	});

	it('finds the attrName on the same p:anim node that carries p:tavLst', () => {
		const childTnLst: XmlObject = {
			'p:anim': {
				'p:cBhvr': {
					'p:attrNameLst': { 'p:attrName': 'style.opacity' },
				},
				'p:tavLst': { 'p:tav': { '@_tm': '0', 'p:val': { 'p:fltVal': { '@_val': '0' } } } },
			},
		};
		expect(extractChildKeyframeAttrName(childTnLst)).toBe('style.opacity');
	});

	it('ignores a p:anim node with no p:tavLst', () => {
		const childTnLst: XmlObject = {
			'p:anim': {
				'p:cBhvr': {
					'p:attrNameLst': { 'p:attrName': 'style.opacity' },
				},
			},
		};
		expect(extractChildKeyframeAttrName(childTnLst)).toBeUndefined();
	});

	it('finds fillcolor on a p:tavLst-carrying node', () => {
		const childTnLst: XmlObject = {
			'p:anim': {
				'p:cBhvr': {
					'p:attrNameLst': { 'p:attrName': 'fillcolor' },
				},
				'p:tavLst': {
					'p:tav': { '@_tm': '0', 'p:val': { 'p:clrVal': { 'a:srgbClr': { '@_val': 'FF0000' } } } },
				},
			},
		};
		expect(extractChildKeyframeAttrName(childTnLst)).toBe('fillcolor');
	});
});
