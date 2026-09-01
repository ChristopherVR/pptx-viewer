import { describe, expect, it } from 'vitest';

import {
	COMPOUND_LINE_OPTIONS,
	LINE_CAP_OPTIONS,
	LINE_JOIN_OPTIONS,
} from './stroke-line-style-options';

describe('cOMPOUND_LINE_OPTIONS', () => {
	it('lists all 5 a:ln@cmpd values exactly once, each with an i18n key', () => {
		const values = COMPOUND_LINE_OPTIONS.map((o) => o.value);
		expect(values).toStrictEqual(['sng', 'dbl', 'thickThin', 'thinThick', 'tri']);
		for (const option of COMPOUND_LINE_OPTIONS) {
			expect(option.i18nKey).toMatch(/^pptx\.strokeOptions\.compound/);
		}
	});
});

describe('lINE_JOIN_OPTIONS', () => {
	it('lists round/bevel/miter, each with an i18n key', () => {
		const values = LINE_JOIN_OPTIONS.map((o) => o.value);
		expect(values).toStrictEqual(['round', 'bevel', 'miter']);
		for (const option of LINE_JOIN_OPTIONS) {
			expect(option.i18nKey).toMatch(/^pptx\.strokeOptions\.join/);
		}
	});
});

describe('lINE_CAP_OPTIONS', () => {
	it('lists flat/rnd/sq, each with an i18n key', () => {
		const values = LINE_CAP_OPTIONS.map((o) => o.value);
		expect(values).toStrictEqual(['flat', 'rnd', 'sq']);
		for (const option of LINE_CAP_OPTIONS) {
			expect(option.i18nKey).toMatch(/^pptx\.strokeOptions\.cap/);
		}
	});
});
