import { describe, expect, it } from 'vitest';

import {
	isXmlNode,
	xmlAttr,
	xmlAttrBool,
	xmlAttrNumber,
	xmlChild,
	xmlChildren,
	xmlHasChild,
	xmlPath,
	xmlText,
} from './xml-access';

describe('xml-access', () => {
	describe('xmlChild', () => {
		it('returns a single child object', () => {
			const node = { 'p:bg': { '@_idx': '1' } };
			expect(xmlChild(node, 'p:bg')).toStrictEqual({ '@_idx': '1' });
		});

		it('returns the first element when the child is an array', () => {
			const node = { 'p:sp': [{ id: 'a' }, { id: 'b' }] };
			expect(xmlChild(node, 'p:sp')).toStrictEqual({ id: 'a' });
		});

		it('returns undefined when the key is missing', () => {
			expect(xmlChild({}, 'p:bg')).toBeUndefined();
		});

		it('returns undefined for non-object input', () => {
			expect(xmlChild(undefined, 'p:bg')).toBeUndefined();
			expect(xmlChild(null, 'p:bg')).toBeUndefined();
			expect(xmlChild('text', 'p:bg')).toBeUndefined();
			expect(xmlChild([{ a: 1 }], 'p:bg')).toBeUndefined();
		});

		it('returns undefined when the child value is a primitive', () => {
			expect(xmlChild({ 'p:bg': 'flat' }, 'p:bg')).toBeUndefined();
		});
	});

	describe('xmlChildren', () => {
		it('wraps a single child in an array', () => {
			const node = { 'p:sp': { id: 'only' } };
			expect(xmlChildren(node, 'p:sp')).toStrictEqual([{ id: 'only' }]);
		});

		it('returns the array as-is when the child repeats', () => {
			const node = { 'p:sp': [{ id: 'a' }, { id: 'b' }] };
			expect(xmlChildren(node, 'p:sp')).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
		});

		it('filters non-object array entries', () => {
			const node = { 'p:sp': [{ id: 'a' }, 'stray', null, { id: 'b' }] };
			expect(xmlChildren(node, 'p:sp')).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
		});

		it('returns an empty array when the key is missing', () => {
			expect(xmlChildren({}, 'p:sp')).toStrictEqual([]);
		});

		it('returns an empty array for non-object input', () => {
			expect(xmlChildren(undefined, 'p:sp')).toStrictEqual([]);
			expect(xmlChildren('text', 'p:sp')).toStrictEqual([]);
		});
	});

	describe('xmlHasChild', () => {
		it('detects object and self-closing empty children', () => {
			expect(xmlHasChild({ 'a:buNone': {} }, 'a:buNone')).toBeTruthy();
			expect(xmlHasChild({ 'a:buNone': '' }, 'a:buNone')).toBeTruthy();
		});

		it('returns false when the child is absent or the node is invalid', () => {
			expect(xmlHasChild({}, 'a:buNone')).toBeFalsy();
			expect(xmlHasChild(undefined, 'a:buNone')).toBeFalsy();
		});
	});

	describe('xmlAttr', () => {
		it('reads an unprefixed attribute name', () => {
			const node = { '@_id': '42', '@_r:embed': 'rId3' };
			expect(xmlAttr(node, 'id')).toBe('42');
			expect(xmlAttr(node, 'r:embed')).toBe('rId3');
		});

		it('coerces numeric and boolean values to strings', () => {
			const node = { '@_idx': 7, '@_flag': true };
			expect(xmlAttr(node, 'idx')).toBe('7');
			expect(xmlAttr(node, 'flag')).toBe('true');
		});

		it('returns undefined when missing', () => {
			expect(xmlAttr({}, 'id')).toBeUndefined();
			expect(xmlAttr(undefined, 'id')).toBeUndefined();
		});
	});

	describe('xmlAttrNumber', () => {
		it('parses numeric attribute strings', () => {
			expect(xmlAttrNumber({ '@_idx': '12' }, 'idx')).toBe(12);
			expect(xmlAttrNumber({ '@_idx': '-3.5' }, 'idx')).toBe(-3.5);
		});

		it('returns undefined for unparseable values', () => {
			expect(xmlAttrNumber({ '@_idx': 'abc' }, 'idx')).toBeUndefined();
			expect(xmlAttrNumber({}, 'idx')).toBeUndefined();
		});
	});

	describe('xmlAttrBool', () => {
		it('treats "1" and "true" as true', () => {
			expect(xmlAttrBool({ '@_flag': '1' }, 'flag')).toBeTruthy();
			expect(xmlAttrBool({ '@_flag': 'true' }, 'flag')).toBeTruthy();
			expect(xmlAttrBool({ '@_flag': 'TRUE' }, 'flag')).toBeTruthy();
		});

		it('treats "0" and "false" as false', () => {
			expect(xmlAttrBool({ '@_flag': '0' }, 'flag')).toBeFalsy();
			expect(xmlAttrBool({ '@_flag': 'false' }, 'flag')).toBeFalsy();
		});

		it('returns undefined for missing or non-boolean values', () => {
			expect(xmlAttrBool({}, 'flag')).toBeUndefined();
			expect(xmlAttrBool({ '@_flag': 'maybe' }, 'flag')).toBeUndefined();
		});
	});

	describe('xmlText', () => {
		it('reads the #text key', () => {
			expect(xmlText({ '#text': 'hello' })).toBe('hello');
		});

		it('returns the string value when the node is a bare string', () => {
			expect(xmlText('hello')).toBe('hello');
		});

		it('coerces numeric text values to strings', () => {
			expect(xmlText({ '#text': 16 })).toBe('16');
		});

		it('returns undefined when missing', () => {
			expect(xmlText({})).toBeUndefined();
			expect(xmlText(undefined)).toBeUndefined();
		});
	});

	describe('xmlPath', () => {
		it('walks nested children', () => {
			const root = {
				'p:sld': {
					'p:cSld': {
						'p:bg': {
							'p:bgPr': { '@_shadeToTitle': '1' },
						},
					},
				},
			};
			const bgPr = xmlPath(root, 'p:sld', 'p:cSld', 'p:bg', 'p:bgPr');
			expect(xmlAttr(bgPr, 'shadeToTitle')).toBe('1');
		});

		it('returns undefined when any step is missing', () => {
			const root = { 'p:sld': { 'p:cSld': {} } };
			expect(xmlPath(root, 'p:sld', 'p:cSld', 'p:bg', 'p:bgPr')).toBeUndefined();
		});

		it('returns the input when called with no keys', () => {
			const root = { '@_x': '1' };
			expect(xmlPath(root)).toStrictEqual(root);
		});

		it('handles array-valued intermediate children by picking the first', () => {
			const root = {
				'p:sp': [{ 'p:nvSpPr': { '@_id': 'a' } }, { 'p:nvSpPr': { '@_id': 'b' } }],
			};
			expect(xmlAttr(xmlPath(root, 'p:sp', 'p:nvSpPr'), 'id')).toBe('a');
		});
	});

	describe('isXmlNode', () => {
		it('accepts plain objects', () => {
			expect(isXmlNode({})).toBeTruthy();
			expect(isXmlNode({ a: 1 })).toBeTruthy();
		});

		it('rejects primitives, arrays, and null', () => {
			expect(isXmlNode(null)).toBeFalsy();
			expect(isXmlNode(undefined)).toBeFalsy();
			expect(isXmlNode('s')).toBeFalsy();
			expect(isXmlNode(1)).toBeFalsy();
			expect(isXmlNode([])).toBeFalsy();
		});
	});
});
