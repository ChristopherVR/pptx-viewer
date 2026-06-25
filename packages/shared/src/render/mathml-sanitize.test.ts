import { describe, expect, it } from 'vitest';

import { sanitizeMathMl } from './mathml-sanitize';

describe('sanitizeMathMl', () => {
	it('returns the raw markup when no dom sanitize is available', () => {
		// In the node/vitest environment DOMPurify has no `sanitize` until handed
		// a window, so the helper falls back to the untouched input.
		const markup = '<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>';
		expect(sanitizeMathMl(markup)).toBe(markup);
	});

	it('passes an empty string through unchanged', () => {
		expect(sanitizeMathMl('')).toBe('');
	});

	it('preserves plain mathml content through the fallback path', () => {
		const markup = '<math><msqrt><mi>x</mi></msqrt></math>';
		expect(sanitizeMathMl(markup)).toContain('msqrt');
	});
});
