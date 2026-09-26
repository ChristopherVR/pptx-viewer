import type { Font } from 'opentype.js';
import { describe, expect, it, vi } from 'vitest';

import { parseOpenTypeFont } from './text-warp-opentype-parser';

describe('parseOpenTypeFont module interop', () => {
	it('uses the ESM named parser when available', () => {
		const font = {} as Font;
		const parse = vi.fn(() => font);
		expect(parseOpenTypeFont(new ArrayBuffer(0), { parse })).toBe(font);
		expect(parse).toHaveBeenCalledOnce();
	});

	it('falls back to the CommonJS default object parser', () => {
		const font = {} as Font;
		const parse = vi.fn(() => font);
		expect(parseOpenTypeFont(new ArrayBuffer(0), { default: { parse } })).toBe(font);
		expect(parse).toHaveBeenCalledOnce();
	});

	it('fails clearly when neither module shape exposes a parser', () => {
		expect(() => parseOpenTypeFont(new ArrayBuffer(0), {})).toThrow(
			'opentype.js does not expose a font parser',
		);
	});
});
