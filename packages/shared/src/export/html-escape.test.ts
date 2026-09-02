import { describe, expect, it } from 'vitest';

import { escapeHtml, safeDataImageSrc } from './html-escape';

describe('escapeHtml', () => {
	it('escapes ampersands, angle brackets, and quotes', () => {
		expect(escapeHtml(`A & B <tag> "q" 'q'`)).toBe(
			'A &amp; B &lt;tag&gt; &quot;q&quot; &#39;q&#39;',
		);
	});

	it('does not double-escape', () => {
		expect(escapeHtml('&amp;')).toBe('&amp;amp;');
	});
});

describe('safeDataImageSrc', () => {
	it('passes a data:image/... URL through, escaped', () => {
		expect(safeDataImageSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
	});

	it('falls back to a transparent PNG for a non-data-image source', () => {
		expect(safeDataImageSrc('https://example.com/x.png')).toContain('data:image/png;base64,');
	});
});
