import { describe, it, expect } from 'vitest';

import { decodeXmlEntities, encodeXmlAttributeValue, encodeXmlTextValue } from './xml-entities';

describe('decodeXmlEntities', () => {
	it('decodes the five predefined XML entities', () => {
		expect(decodeXmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
		expect(decodeXmlEntities('a &lt; b &gt; c')).toBe('a < b > c');
		expect(decodeXmlEntities('say &quot;hi&quot;')).toBe('say "hi"');
		expect(decodeXmlEntities('it&apos;s')).toBe("it's");
	});

	it('decodes decimal and hexadecimal numeric character references', () => {
		expect(decodeXmlEntities('&#160;')).toBe(' ');
		expect(decodeXmlEntities('&#x41;&#x42;')).toBe('AB');
		expect(decodeXmlEntities('(&#169;)')).toBe('(©)');
	});

	it('decodes &amp; last so escaped entity sequences survive', () => {
		// `&amp;lt;` is the encoding of the literal text `&lt;`, not of `<`.
		expect(decodeXmlEntities('&amp;lt;')).toBe('&lt;');
		expect(decodeXmlEntities('a&amp;b&amp;c')).toBe('a&b&c');
	});

	it('returns strings without an ampersand unchanged (fast path)', () => {
		expect(decodeXmlEntities('plain text')).toBe('plain text');
		expect(decodeXmlEntities('')).toBe('');
	});

	it('passes non-string values through untouched', () => {
		expect(decodeXmlEntities(undefined)).toBeUndefined();
		expect(decodeXmlEntities(42)).toBe(42);
		const obj = { a: 1 };
		expect(decodeXmlEntities(obj)).toBe(obj);
	});

	it('drops out-of-range numeric references rather than throwing', () => {
		expect(decodeXmlEntities('&#x110000;')).toBe('');
	});
});

describe('encodeXmlTextValue', () => {
	it('escapes exactly the characters fast-xml-parser escaped by default', () => {
		expect(encodeXmlTextValue('Tom & Jerry')).toBe('Tom &amp; Jerry');
		expect(encodeXmlTextValue('a < b > c')).toBe('a &lt; b &gt; c');
		expect(encodeXmlTextValue(`it's "so"`)).toBe('it&apos;s &quot;so&quot;');
	});

	it('escapes an ampersand once, not twice', () => {
		expect(encodeXmlTextValue('a&b')).toBe('a&amp;b');
		expect(decodeXmlEntities(encodeXmlTextValue('a&b'))).toBe('a&b');
	});

	it('writes a carriage return as a numeric reference', () => {
		// XML line-ending normalisation rewrites a literal `\r` to `\n` before the
		// parser ever sees it, so only `&#xD;` survives a round trip.
		expect(encodeXmlTextValue('a\r\nb')).toBe('a&#xD;\nb');
	});
});

describe('encodeXmlAttributeValue', () => {
	it('escapes the markup characters but leaves the quote delimiters alone', () => {
		// fast-xml-parser escapes `"` and `'` itself, immediately after this
		// processor runs; doing it here too would emit `&amp;quot;`.
		expect(encodeXmlAttributeValue('R&D <x>')).toBe('R&amp;D &lt;x&gt;');
		expect(encodeXmlAttributeValue(`say "hi" it's`)).toBe(`say "hi" it's`);
	});

	it('writes tab, line feed and carriage return as numeric references', () => {
		// Attribute-value normalisation (XML 1.0 3.3.3) turns a literal one into a
		// space on read-back, which silently flattens multi-line alt text.
		expect(encodeXmlAttributeValue('one\ntwo')).toBe('one&#xA;two');
		expect(encodeXmlAttributeValue('a\tb')).toBe('a&#x9;b');
		expect(encodeXmlAttributeValue('a\rb')).toBe('a&#xD;b');
	});

	it('is the exact inverse of decodeXmlEntities for a query string', () => {
		const url = 'https://example.com/search?a=1&b=2&c=3';
		expect(decodeXmlEntities(encodeXmlAttributeValue(url))).toBe(url);
	});
});
