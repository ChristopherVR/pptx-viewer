import { describe, expect, it } from 'vitest';

import { mergeTextStyleOnStart, resolveTextStyleOnCleanup } from './animation-text-style-state';

describe('mergeTextStyleOnStart', () => {
	it('passes the carried style through when the step carries none', () => {
		expect(mergeTextStyleOnStart({ bold: true }, undefined)).toStrictEqual({ bold: true });
	});

	it('merges the step style over the carried style, step fields winning', () => {
		expect(mergeTextStyleOnStart({ bold: true, underline: true }, { bold: false })).toStrictEqual({
			bold: false,
			underline: true,
		});
	});

	it('returns just the step style when nothing was carried', () => {
		expect(mergeTextStyleOnStart(undefined, { italic: true })).toStrictEqual({ italic: true });
	});
});

describe('resolveTextStyleOnCleanup', () => {
	it('passes the carried style through when the step carried none', () => {
		expect(resolveTextStyleOnCleanup({ bold: true }, undefined, false)).toStrictEqual({
			bold: true,
		});
	});

	it('keeps the merged style when the effect holds its end state (Bold Reveal)', () => {
		expect(resolveTextStyleOnCleanup({ underline: true }, { bold: true }, true)).toStrictEqual({
			underline: true,
			bold: true,
		});
	});

	it('reverts only the keys this step set when the effect does not hold (Bold Flash)', () => {
		expect(
			resolveTextStyleOnCleanup({ bold: true, underline: true }, { bold: true }, false),
		).toStrictEqual({ underline: true });
	});

	it('returns undefined once every carried key has been reverted', () => {
		expect(resolveTextStyleOnCleanup({ bold: true }, { bold: true }, false)).toBeUndefined();
	});

	it('returns undefined reverting from an empty carried state', () => {
		expect(resolveTextStyleOnCleanup(undefined, { bold: true }, false)).toBeUndefined();
	});
});
