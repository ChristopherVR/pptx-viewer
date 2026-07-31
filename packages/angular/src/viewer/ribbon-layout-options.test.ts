import type { PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { layoutOptionsFrom } from './ribbon-layout-options';

function master(partial: Partial<PptxSlideMaster>): PptxSlideMaster {
	return { path: 'ppt/slideMasters/slideMaster1.xml', ...partial } as PptxSlideMaster;
}

describe('layoutOptionsFrom', () => {
	it('flattens every master into one menu, in document order', () => {
		expect(
			layoutOptionsFrom([
				master({
					layouts: [
						{ path: 'ppt/slideLayouts/slideLayout1.xml', name: 'Title Slide' },
						{ path: 'ppt/slideLayouts/slideLayout2.xml', name: 'Title and Content' },
					],
				}),
				master({
					path: 'ppt/slideMasters/slideMaster2.xml',
					layouts: [{ path: 'ppt/slideLayouts/slideLayout9.xml', name: 'Blank' }],
				}),
			]),
		).toStrictEqual([
			{ path: 'ppt/slideLayouts/slideLayout1.xml', name: 'Title Slide' },
			{ path: 'ppt/slideLayouts/slideLayout2.xml', name: 'Title and Content' },
			{ path: 'ppt/slideLayouts/slideLayout9.xml', name: 'Blank' },
		]);
	});

	// `name` is optional in OOXML, and a menu of blank rows is unusable.
	it('names an unnamed layout after its file', () => {
		expect(
			layoutOptionsFrom([master({ layouts: [{ path: 'ppt/slideLayouts/slideLayout4.xml' }] })]),
		).toStrictEqual([{ path: 'ppt/slideLayouts/slideLayout4.xml', name: 'slideLayout4' }]);
	});

	it('reports no options for a deck with no masters or no layouts', () => {
		expect(layoutOptionsFrom([])).toStrictEqual([]);
		expect(layoutOptionsFrom([master({})])).toStrictEqual([]);
	});
});
