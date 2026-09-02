import { describe, expect, it } from 'vitest';

import { escapeTextArgument } from './omml-to-latex-helpers';

describe('escapeTextArgument', () => {
	it('escapes braces so they cannot close the \\text{} argument', () => {
		expect(escapeTextArgument('a{b}c')).toBe('a\\{b\\}c');
	});

	it('spells a literal backslash as \\backslash', () => {
		expect(escapeTextArgument('a\\b')).toBe('a\\backslash b');
	});

	it('does not re-escape the backslash introduced for a brace', () => {
		// A chained "backslash first, then braces" implementation gets this
		// right too, but a chain in the other order would turn `\{` into
		// `\backslash {`; a single pass makes the order irrelevant.
		expect(escapeTextArgument('\\{')).toBe('\\backslash \\{');
		expect(escapeTextArgument('{\\}')).toBe('\\{\\backslash \\}');
	});

	it('leaves plain text alone', () => {
		expect(escapeTextArgument('speed of light')).toBe('speed of light');
	});
});
