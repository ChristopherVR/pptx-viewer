/**
 * `ensureXmlChildOrCreate` / `ensureXmlChildren`: the WRITE-side accessors.
 *
 * Every case here is driven through a real `XMLParser` rather than a
 * hand-written object literal, because the whole point of these helpers is a
 * shape only the parser produces: an element with no attributes, no children
 * and no text becomes the empty STRING, not `{}`. A literal `{ 'a:xfrm': {} }`
 * cannot reproduce the bug, which is how it survived so long.
 */
import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types/common';
import { ensureXmlChildOrCreate, ensureXmlChildren } from './xml-access';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
});

function parse(xml: string): XmlObject {
	return (parser.parse(xml) as Record<string, XmlObject>)['root'];
}

describe('the parser shape these helpers exist for', () => {
	it('materialises a bare element as the empty string, not an object', () => {
		expect(parse('<root><p:spPr/></root>')['p:spPr']).toBe('');
	});
});

describe('ensureXmlChildOrCreate', () => {
	it('heals a bare element into a writable node held by the parent', () => {
		const shape = parse('<root><p:spPr/></root>');
		const spPr = ensureXmlChildOrCreate(shape, 'p:spPr');
		spPr['a:xfrm'] = { '@_rot': '0' };
		expect(shape['p:spPr']).toBe(spPr);
		expect(shape).toStrictEqual({ 'p:spPr': { 'a:xfrm': { '@_rot': '0' } } });
	});

	it('does not throw where `??= {}` did', () => {
		const shape = parse('<root><p:spPr/></root>');
		expect(() => {
			// The shape the old code had: `''` is not nullish, so `??=` left the
			// string in place and the next assignment threw.
			const legacy = (shape['p:spPr'] ??= {}) as XmlObject;
			legacy['a:xfrm'] = {};
		}).toThrow(TypeError);
		expect(() => {
			ensureXmlChildOrCreate(parse('<root><p:spPr/></root>'), 'p:spPr')['a:xfrm'] = {};
		}).not.toThrow();
	});

	it('returns an existing node untouched', () => {
		const shape = parse('<root><p:spPr><a:xfrm rot="60000"/></p:spPr></root>');
		const existing = shape['p:spPr'];
		expect(ensureXmlChildOrCreate(shape, 'p:spPr')).toBe(existing);
		expect(shape['p:spPr']).toStrictEqual({ 'a:xfrm': { '@_rot': '60000' } });
	});

	it('appends a created element by default', () => {
		const run = parse('<root><a:t>hi</a:t></root>');
		ensureXmlChildOrCreate(run, 'a:rPr')['@_b'] = '1';
		expect(Object.keys(run)).toStrictEqual(['a:t', 'a:rPr']);
	});

	it('prepends a created element when the schema sequence demands it', () => {
		const run = parse('<root><a:t>hi</a:t></root>');
		ensureXmlChildOrCreate(run, 'a:rPr', 'first')['@_b'] = '1';
		expect(Object.keys(run)).toStrictEqual(['a:rPr', 'a:t']);
		expect(run['a:t']).toBe('hi');
	});

	it('leaves an existing element where it already sits', () => {
		const run = parse('<root><a:rPr lang="en"/><a:t>hi</a:t></root>');
		ensureXmlChildOrCreate(run, 'a:rPr', 'first');
		expect(Object.keys(run)).toStrictEqual(['a:rPr', 'a:t']);
	});
});

describe('ensureXmlChildren', () => {
	it('keeps a lone empty paragraph instead of dropping it', () => {
		const body = parse('<root><a:p/></root>');
		const paragraphs = ensureXmlChildren(body, 'a:p');
		expect(paragraphs).toHaveLength(1);
		paragraphs[0]['a:pPr'] = { '@_algn': 'ctr' };
		expect(body['a:p']).toStrictEqual({ 'a:pPr': { '@_algn': 'ctr' } });
	});

	it('heals empty entries inside a repeated element, in place', () => {
		const body = parse('<root><a:p/><a:p><a:r><a:t>x</a:t></a:r></a:p></root>');
		const paragraphs = ensureXmlChildren(body, 'a:p');
		expect(paragraphs).toHaveLength(2);
		paragraphs[0]['a:pPr'] = {};
		expect((body['a:p'] as XmlObject[])[0]).toBe(paragraphs[0]);
		expect((body['a:p'] as XmlObject[])[1]).toBe(paragraphs[1]);
	});

	it('leaves an absent element absent', () => {
		expect(ensureXmlChildren(parse('<root><a:bodyPr/></root>'), 'a:p')).toStrictEqual([]);
	});
});
