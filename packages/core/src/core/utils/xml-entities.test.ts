import { describe, it, expect } from 'vitest';

import { decodeXmlEntities } from './xml-entities';

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
