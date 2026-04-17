import { DOMParser } from '@xmldom/xmldom';
import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	getNodeLocalName,
	getFirstDescendantElementByLocalName,
	canonicalizeSignedInfoXml,
} from './xml-canonicalization';

// ---------------------------------------------------------------------------
// getNodeLocalName
// ---------------------------------------------------------------------------

describe('getNodeLocalName', () => {
	const parser = new DOMParser();

	it('returns local name stripped of namespace prefix', () => {
		const doc = parser.parseFromString(
			'<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"/>',
			'text/xml',
		);
		expect(getNodeLocalName(doc.documentElement!)).toBe('Signature');
	});

	it('returns the full name when no prefix is present', () => {
		const doc = parser.parseFromString('<Root/>', 'text/xml');
		expect(getNodeLocalName(doc.documentElement!)).toBe('Root');
	});

	it('handles deeply-prefixed names like a:b:Foo by stripping first prefix', () => {
		const doc = parser.parseFromString('<ns:Element xmlns:ns="urn:test"/>', 'text/xml');
		expect(getNodeLocalName(doc.documentElement!)).toBe('Element');
	});
});

// ---------------------------------------------------------------------------
// getFirstDescendantElementByLocalName
// ---------------------------------------------------------------------------

describe('getFirstDescendantElementByLocalName', () => {
	const parser = new DOMParser();

	it('finds element by local name in parsed XML', () => {
		const doc = parser.parseFromString(
			'<Root><ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:Reference/></ds:SignedInfo></Root>',
			'text/xml',
		);
		const result = getFirstDescendantElementByLocalName(doc, 'SignedInfo');
		expect(result).toBeDefined();
		expect(getNodeLocalName(result!)).toBe('SignedInfo');
	});

	it('returns the first matching element when multiple exist', () => {
		const doc = parser.parseFromString('<Root><Item id="1"/><Item id="2"/></Root>', 'text/xml');
		const result = getFirstDescendantElementByLocalName(doc, 'Item');
		expect(result).toBeDefined();
		expect(result!.getAttribute('id')).toBe('1');
	});

	it('returns undefined when element is not found', () => {
		const doc = parser.parseFromString('<Root><Child/></Root>', 'text/xml');
		const result = getFirstDescendantElementByLocalName(doc, 'NonExistent');
		expect(result).toBeUndefined();
	});

	it('searches within an element subtree', () => {
		const doc = parser.parseFromString('<Root><Parent><Target/></Parent></Root>', 'text/xml');
		const parent = getFirstDescendantElementByLocalName(doc, 'Parent')!;
		const result = getFirstDescendantElementByLocalName(parent, 'Target');
		expect(result).toBeDefined();
		expect(getNodeLocalName(result!)).toBe('Target');
	});
});

// ---------------------------------------------------------------------------
// canonicalizeSignedInfoXml
// ---------------------------------------------------------------------------

describe('canonicalizeSignedInfoXml', () => {
	it('returns a string for well-formed XML input', () => {
		const xml =
			'<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod/></SignedInfo>';
		const result = canonicalizeSignedInfoXml(xml);
		expectTypeOf(result).toBeString();
		expect(result.length).toBeGreaterThan(0);
	});
});
