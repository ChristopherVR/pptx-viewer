import { afterEach, describe, expect, it, vi } from 'vitest';

import { elementIdSelector, escapeCssAttributeValue } from './css-escape';

describe('escapeCssAttributeValue', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('prefers CSS.escape when the platform provides it', () => {
		const escape = vi.fn((value: string) => `<${value}>`);
		vi.stubGlobal('CSS', { escape });
		expect(escapeCssAttributeValue('shape-1')).toBe('<shape-1>');
		expect(escape).toHaveBeenCalledWith('shape-1');
	});

	it('escapes the quote in the fallback', () => {
		vi.stubGlobal('CSS', undefined);
		expect(escapeCssAttributeValue('a"b')).toBe('a\\"b');
	});

	it('escapes the backslash in the fallback so it cannot swallow the closing quote', () => {
		vi.stubGlobal('CSS', undefined);
		expect(escapeCssAttributeValue('a\\')).toBe('a\\\\');
		// Escaping in one pass: the backslash added for the quote is not re-escaped.
		expect(escapeCssAttributeValue('\\"')).toBe('\\\\\\"');
	});

	it('leaves ordinary ids untouched in the fallback', () => {
		vi.stubGlobal('CSS', undefined);
		expect(escapeCssAttributeValue('ppt/slides/slide1.xml-shape-9')).toBe(
			'ppt/slides/slide1.xml-shape-9',
		);
	});

	it('builds the data-element-id selector', () => {
		vi.stubGlobal('CSS', undefined);
		expect(elementIdSelector('x"y')).toBe('[data-element-id="x\\"y"]');
	});
});
