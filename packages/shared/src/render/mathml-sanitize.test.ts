import { describe, expect, it } from 'vitest';

import { sanitizeMathMl } from './mathml-sanitize';

describe('sanitizeMathMl', () => {
	it('fails closed to an empty string when no dom sanitize is available', () => {
		// In the node/vitest environment DOMPurify has no `sanitize` until handed
		// a window, so the helper fails closed rather than passing raw,
		// unsanitised markup through.
		const markup = '<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>';
		expect(sanitizeMathMl(markup)).toBe('');
	});

	it('passes an empty string through unchanged', () => {
		expect(sanitizeMathMl('')).toBe('');
	});
});
