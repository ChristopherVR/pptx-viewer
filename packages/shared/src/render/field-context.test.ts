import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildFieldSubstitutionContext,
	deriveSlideFieldContext,
	resolveSlideTitle,
} from './field-context';

function slideWith(slideNumber: number, title?: string): PptxSlide {
	return {
		slideNumber,
		elements: title
			? [
					{
						id: 't1',
						type: 'text',
						x: 0,
						y: 0,
						width: 10,
						height: 10,
						text: title,
						placeholderType: 'title',
					},
				]
			: [],
	} as unknown as PptxSlide;
}

describe('resolveSlideTitle', () => {
	it('returns the first title placeholder text', () => {
		expect(resolveSlideTitle(slideWith(1, 'Agenda'))).toBe('Agenda');
	});

	it('returns undefined without a slide or a title placeholder', () => {
		expect(resolveSlideTitle(undefined)).toBeUndefined();
		expect(resolveSlideTitle(slideWith(1))).toBeUndefined();
	});

	it('accepts a centre-title placeholder', () => {
		const slide = slideWith(1, 'Cover');
		(slide.elements[0] as unknown as { placeholderType: string }).placeholderType = 'ctrTitle';
		expect(resolveSlideTitle(slide)).toBe('Cover');
	});

	// A parsed deck carries no `placeholderType` property at all: the placeholder
	// type is only in the preserved raw XML, and the text is in `textSegments`.
	// Scanning for the property alone resolved nothing on a real .pptx, so every
	// binding printed the authored field literal instead of the slide title.
	it('resolves a real parsed slide from its raw XML placeholder and text segments', () => {
		const slide = {
			slideNumber: 1,
			elements: [
				{
					id: 't1',
					type: 'text',
					x: 0,
					y: 0,
					width: 10,
					height: 10,
					textSegments: [{ text: 'Quarterly ' }, { text: 'Review' }],
					rawXml: { 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': 'title' } } } },
				},
			],
		} as unknown as PptxSlide;
		expect(resolveSlideTitle(slide)).toBe('Quarterly Review');
	});
});

describe('buildFieldSubstitutionContext', () => {
	it('folds deck settings and the slide into one context', () => {
		const ctx = buildFieldSubstitutionContext({
			headerFooter: {
				dateTimeText: '1/1/2026',
				dateFormat: 'M/d/yyyy',
				footerText: 'Confidential',
				headerText: 'Draft',
			},
			customProperties: [{ name: 'Project', value: 'Beta', type: 'lpwstr' }],
			slide: slideWith(3, 'Agenda'),
		});
		expect(ctx).toStrictEqual({
			slideNumber: 3,
			dateTimeText: '1/1/2026',
			dateFormat: 'M/d/yyyy',
			footerText: 'Confidential',
			headerText: 'Draft',
			slideTitle: 'Agenda',
			customProperties: [{ name: 'Project', value: 'Beta' }],
		});
	});

	it('omits the locale key entirely when none is supplied', () => {
		const ctx = buildFieldSubstitutionContext({});
		expect('locale' in ctx).toBeFalsy();
		expect(ctx.customProperties).toStrictEqual([]);
	});

	it('keeps an explicit locale for current-date fields', () => {
		expect(buildFieldSubstitutionContext({ locale: 'de-DE' }).locale).toBe('de-DE');
	});
});

describe('deriveSlideFieldContext', () => {
	it('re-points the per-slide fields at the given slide', () => {
		const base = buildFieldSubstitutionContext({
			headerFooter: { footerText: 'Confidential' },
			slide: slideWith(1, 'Cover'),
		});
		const derived = deriveSlideFieldContext(base, slideWith(4, 'Results'));
		expect(derived?.slideNumber).toBe(4);
		expect(derived?.slideTitle).toBe('Results');
		// Deck-wide fields survive the re-point.
		expect(derived?.footerText).toBe('Confidential');
	});

	it('stays undefined without a base context', () => {
		expect(deriveSlideFieldContext(undefined, slideWith(2))).toBeUndefined();
	});
});
