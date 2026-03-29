import { describe, it, expect } from 'vitest';

import {
	escapeXmlAttr,
	extractTagAttribute,
	extractFirstTagText,
	extractAllTagText,
} from './signature-xml-utils';

describe('escapeXmlAttr', () => {
	it('escapes ampersands', () => {
		expect(escapeXmlAttr('a&b')).toBe('a&amp;b');
	});

	it('escapes double quotes', () => {
		expect(escapeXmlAttr('a"b')).toBe('a&quot;b');
	});

	it('escapes less-than signs', () => {
		expect(escapeXmlAttr('a<b')).toBe('a&lt;b');
	});

	it('escapes greater-than signs', () => {
		expect(escapeXmlAttr('a>b')).toBe('a&gt;b');
	});

	it('escapes all special characters in one string', () => {
		expect(escapeXmlAttr('&"<>')).toBe('&amp;&quot;&lt;&gt;');
	});

	it('returns the same string when no escaping is needed', () => {
		expect(escapeXmlAttr('hello world')).toBe('hello world');
	});

	it('handles an empty string', () => {
		expect(escapeXmlAttr('')).toBe('');
	});

	it('escapes multiple occurrences of the same character', () => {
		expect(escapeXmlAttr('a&&b')).toBe('a&amp;&amp;b');
	});
});

describe('extractTagAttribute', () => {
	it('extracts an attribute value from a simple tag', () => {
		const xml = '<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>';
		expect(extractTagAttribute(xml, 'DigestMethod', 'Algorithm')).toBe(
			'http://www.w3.org/2001/04/xmlenc#sha256',
		);
	});

	it('extracts an attribute from a namespaced tag', () => {
		const xml = '<ds:SignatureMethod Algorithm="rsa-sha256" Id="sig1"/>';
		expect(extractTagAttribute(xml, 'ds:SignatureMethod', 'Algorithm')).toBe('rsa-sha256');
	});

	it('returns undefined for a missing attribute', () => {
		const xml = '<DigestMethod Algorithm="sha256"/>';
		expect(extractTagAttribute(xml, 'DigestMethod', 'MissingAttr')).toBeUndefined();
	});

	it('returns undefined when the tag is not found', () => {
		const xml = '<OtherTag value="123"/>';
		expect(extractTagAttribute(xml, 'DigestMethod', 'value')).toBeUndefined();
	});

	it('extracts the first match when multiple tags exist', () => {
		const xml = '<Ref URI="first"/><Ref URI="second"/>';
		expect(extractTagAttribute(xml, 'Ref', 'URI')).toBe('first');
	});

	it('handles attributes with surrounding whitespace in tags', () => {
		const xml = '<Tag  attr1="foo"  attr2="bar" />';
		expect(extractTagAttribute(xml, 'Tag', 'attr2')).toBe('bar');
	});
});

describe('extractFirstTagText', () => {
	it('extracts text content from a simple tag', () => {
		const xml = '<DigestValue>abc123==</DigestValue>';
		expect(extractFirstTagText(xml, 'DigestValue')).toBe('abc123==');
	});

	it('handles namespace prefixes on the tag', () => {
		const xml = '<ds:DigestValue>abc123==</ds:DigestValue>';
		expect(extractFirstTagText(xml, 'DigestValue')).toBe('abc123==');
	});

	it('collapses whitespace within the text content', () => {
		const xml = '<Value>abc\n  123\n  ==</Value>';
		expect(extractFirstTagText(xml, 'Value')).toBe('abc123==');
	});

	it('returns undefined when the tag is not found', () => {
		const xml = '<OtherTag>text</OtherTag>';
		expect(extractFirstTagText(xml, 'MissingTag')).toBeUndefined();
	});

	it('returns undefined for an empty tag', () => {
		const xml = '<Value></Value>';
		expect(extractFirstTagText(xml, 'Value')).toBeUndefined();
	});

	it('returns the first match when multiple tags exist', () => {
		const xml = '<Val>first</Val><Val>second</Val>';
		expect(extractFirstTagText(xml, 'Val')).toBe('first');
	});

	it('handles tags with attributes', () => {
		const xml = '<Value algo="sha256">content</Value>';
		expect(extractFirstTagText(xml, 'Value')).toBe('content');
	});
});

describe('extractAllTagText', () => {
	it('extracts text from all matching tags', () => {
		const xml = '<Item>one</Item><Item>two</Item><Item>three</Item>';
		expect(extractAllTagText(xml, 'Item')).toStrictEqual(['one', 'two', 'three']);
	});

	it('returns an empty array when no tags match', () => {
		const xml = '<Other>text</Other>';
		expect(extractAllTagText(xml, 'Missing')).toStrictEqual([]);
	});

	it('handles namespace prefixes', () => {
		const xml = '<ds:Ref>a</ds:Ref><mso:Ref>b</mso:Ref>';
		expect(extractAllTagText(xml, 'Ref')).toStrictEqual(['a', 'b']);
	});

	it('collapses whitespace within each match', () => {
		const xml = '<V>a b\nc</V><V>d  e</V>';
		expect(extractAllTagText(xml, 'V')).toStrictEqual(['abc', 'de']);
	});

	it('skips empty tags', () => {
		const xml = '<V>value</V><V></V><V>other</V>';
		expect(extractAllTagText(xml, 'V')).toStrictEqual(['value', 'other']);
	});

	it('returns an empty array for empty input', () => {
		expect(extractAllTagText('', 'Tag')).toStrictEqual([]);
	});
});
