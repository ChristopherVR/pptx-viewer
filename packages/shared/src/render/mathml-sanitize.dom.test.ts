// @vitest-environment jsdom
/**
 * The DOM half of the `sanitizeMathMl` suite. Its sibling
 * (`mathml-sanitize.test.ts`) runs in the node environment and can therefore
 * only prove the fail-closed path; the actual stripping needs a window for
 * DOMPurify to attach to.
 *
 * Kept as its own file because a vitest environment is per file, and the
 * fail-closed case is meaningless once a DOM exists.
 *
 * Note the environment matters beyond "some DOM": DOMPurify under happy-dom
 * lets a `<script>` inside `<mtext>` through, while jsdom (and every real
 * browser) removes it. Assert this behaviour here, not in the bindings' suites,
 * several of which run on happy-dom.
 */
import { describe, expect, it } from 'vitest';

import { sanitizeMathMl } from './mathml-sanitize';

describe('sanitizeMathMl with a dom available', () => {
	it('keeps MathML structure intact', () => {
		const cleaned = sanitizeMathMl('<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>');
		expect(cleaned).toContain('<math');
		expect(cleaned).toContain('<mfrac>');
		expect(cleaned).toContain('<mn>1</mn>');
	});

	it('strips a script element smuggled inside MathML text', () => {
		const cleaned = sanitizeMathMl('<math><mtext><script>alert(1)</script></mtext></math>');
		expect(cleaned).not.toContain('<script');
		expect(cleaned).toContain('<mtext>');
	});

	it('strips an event-handler attribute', () => {
		const cleaned = sanitizeMathMl('<math><mtext><img src=x onerror=alert(1)></mtext></math>');
		expect(cleaned).not.toContain('onerror');
	});

	it('restores the namespace-bearing <math> wrapper DOMPurify can drop', () => {
		// The generated wrapper is constant, so re-adding it cannot reintroduce
		// anything the sanitiser removed; without it the fragment would render as
		// HTML rather than MathML.
		expect(sanitizeMathMl('<math><mi>x</mi></math>')).toMatch(/<math(?:\s|>)/u);
	});
});
