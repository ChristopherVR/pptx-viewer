import type { PptxLayoutOption, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { scopeLayoutOptionsToActiveSlide } from './useScopedLayoutOptions';

function makeOption(path: string, name: string, masterPath?: string): PptxLayoutOption {
	return { path, name, ...(masterPath ? { masterPath } : {}) };
}

function makeSlide(layoutPath?: string): PptxSlide {
	return {
		id: 's',
		rId: '',
		slideNumber: 1,
		elements: [],
		...(layoutPath ? { layoutPath } : {}),
	};
}

describe('scopeLayoutOptionsToActiveSlide', () => {
	const m1Layouts = [
		makeOption(
			'ppt/slideLayouts/slideLayout1.xml',
			'Title Slide',
			'ppt/slideMasters/slideMaster1.xml',
		),
		makeOption(
			'ppt/slideLayouts/slideLayout2.xml',
			'Title and Content',
			'ppt/slideMasters/slideMaster1.xml',
		),
	];
	const m2Layouts = [
		makeOption(
			'ppt/slideLayouts/slideLayout10.xml',
			'Title Slide',
			'ppt/slideMasters/slideMaster2.xml',
		),
		makeOption('ppt/slideLayouts/slideLayout11.xml', 'Blank', 'ppt/slideMasters/slideMaster2.xml'),
	];
	const allOptions = [...m1Layouts, ...m2Layouts];

	it("returns only layouts sharing the active slide's master", () => {
		const slide = makeSlide('ppt/slideLayouts/slideLayout2.xml');
		const result = scopeLayoutOptionsToActiveSlide(allOptions, slide);
		expect(result.map((o) => o.path)).toStrictEqual(m1Layouts.map((o) => o.path));
	});

	it('returns all options when the active slide has no layoutPath', () => {
		const slide = makeSlide();
		const result = scopeLayoutOptionsToActiveSlide(allOptions, slide);
		expect(result).toBe(allOptions);
	});

	it('returns all options when the active slide is undefined', () => {
		const result = scopeLayoutOptionsToActiveSlide(allOptions, undefined);
		expect(result).toBe(allOptions);
	});

	it("returns all options when no option matches the active slide's layoutPath", () => {
		const slide = makeSlide('ppt/slideLayouts/unknown.xml');
		const result = scopeLayoutOptionsToActiveSlide(allOptions, slide);
		expect(result).toBe(allOptions);
	});

	it('returns all options when options lack masterPath metadata', () => {
		const optionsWithoutMaster = [
			makeOption('ppt/slideLayouts/slideLayout1.xml', 'Title Slide'),
			makeOption('ppt/slideLayouts/slideLayout10.xml', 'Title Slide'),
		];
		const slide = makeSlide('ppt/slideLayouts/slideLayout1.xml');
		const result = scopeLayoutOptionsToActiveSlide(optionsWithoutMaster, slide);
		expect(result).toBe(optionsWithoutMaster);
	});

	it("dedupes layouts within the master by display name, preferring the active slide's own layout", () => {
		const layouts = [
			makeOption(
				'ppt/slideLayouts/slideLayout1.xml',
				'Title Slide',
				'ppt/slideMasters/slideMaster1.xml',
			),
			makeOption(
				'ppt/slideLayouts/slideLayout2.xml',
				'Title Slide',
				'ppt/slideMasters/slideMaster1.xml',
			),
			makeOption(
				'ppt/slideLayouts/slideLayout3.xml',
				'Two Content',
				'ppt/slideMasters/slideMaster1.xml',
			),
		];
		const slide = makeSlide('ppt/slideLayouts/slideLayout2.xml');
		const result = scopeLayoutOptionsToActiveSlide(layouts, slide);
		// One 'Title Slide' entry (the active slide's own layout) plus 'Two Content'
		expect(result.map((o) => o.name)).toStrictEqual(['Title Slide', 'Two Content']);
		expect(result.find((o) => o.name === 'Title Slide')?.path).toBe(
			'ppt/slideLayouts/slideLayout2.xml',
		);
	});
});
