import { XMLValidator } from 'fast-xml-parser';
import { describe, it, expect } from 'vitest';

import { esc, escAttr, escText } from './xml-utils';

describe('escAttr', () => {
	it('escapes every character that can terminate an attribute', () => {
		expect(escAttr('R&D <Team> "quoted"')).toBe('R&amp;D &lt;Team&gt; &quot;quoted&quot;');
	});

	it('escapes the apostrophe delimiter too, so a single-quoted attribute survives', () => {
		expect(escAttr("it's")).toBe('it&apos;s');
	});

	it('writes whitespace as numeric references so attribute-value normalisation cannot eat it', () => {
		// XML 1.0 3.3.3 rewrites a literal tab / LF / CR inside an attribute to a
		// space on read-back, so only the numeric form survives a round trip.
		expect(escAttr('a\nb\tc\rd')).toBe('a&#xA;b&#x9;c&#xD;d');
	});

	it('does not double-encode the ampersands it introduces', () => {
		expect(escAttr('&amp;')).toBe('&amp;amp;');
	});

	it('drops control characters XML 1.0 forbids outright', () => {
		expect(escAttr('a\u0000b\u0008c\u000Bd\u000Ce\u001Ff')).toBe('abcdef');
	});

	it('produces a well-formed attribute for a hostile value', () => {
		const xml = `<p:cSld xmlns:p="urn:x" name="${escAttr('R&D <Team> "quoted"')}"/>`;
		expect(XMLValidator.validate(xml)).toBeTruthy();
	});
});

describe('escText', () => {
	it('escapes the markup delimiters', () => {
		expect(escText('R&D <Team>')).toBe('R&amp;D &lt;Team&gt;');
	});

	it('writes a carriage return as a numeric reference so line-ending normalisation cannot eat it', () => {
		expect(escText('a\r\nb')).toBe('a&#xD;\nb');
	});

	it('drops control characters XML 1.0 forbids outright', () => {
		expect(escText('a\u0000b\u000Bc')).toBe('abc');
	});

	it('produces well-formed element text for a hostile value', () => {
		const xml = `<dc:title xmlns:dc="urn:x">${escText('R&D <Team> "quoted"')}</dc:title>`;
		expect(XMLValidator.validate(xml)).toBeTruthy();
	});
});

describe('esc', () => {
	it('still escapes all five predefined entities', () => {
		expect(esc(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
	});

	it('drops the vertical tab and form feed XML 1.0 forbids', () => {
		expect(esc('a\u000Bb\u000Cc')).toBe('abc');
	});
});
