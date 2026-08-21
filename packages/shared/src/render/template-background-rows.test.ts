import type { PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveTemplateBackgroundRows } from './template-background-rows';

function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return { id: 's1', rId: 's1', slideNumber: 1, elements: [], ...overrides } as PptxSlide;
}

describe('resolveTemplateBackgroundRows', () => {
	it('returns neither row when the slide has no layout', () => {
		const rows = resolveTemplateBackgroundRows(slide(), [], 'Layout', 'Master');
		expect(rows.layout).toBeUndefined();
		expect(rows.master).toBeUndefined();
	});

	it('returns a layout row using the layout name, falling back to the generic label', () => {
		const withName = resolveTemplateBackgroundRows(
			slide({ layoutPath: 'layout1.xml', layoutName: 'Title Slide' }),
			[],
			'Layout',
			'Master',
		);
		expect(withName.layout).toStrictEqual({
			path: 'layout1.xml',
			label: 'Title Slide',
			title: 'Title Slide',
		});

		const withoutName = resolveTemplateBackgroundRows(
			slide({ layoutPath: 'layout1.xml' }),
			[],
			'Layout',
			'Master',
		);
		expect(withoutName.layout).toStrictEqual({
			path: 'layout1.xml',
			label: 'Layout',
			title: 'layout1.xml',
		});
	});

	it('returns the master row whose layoutPaths includes the slide layout', () => {
		const masters: PptxSlideMaster[] = [
			{ path: 'master1.xml', name: 'Office Theme', layoutPaths: ['layout1.xml'] },
			{ path: 'master2.xml', layoutPaths: ['layout2.xml'] },
		];
		const rows = resolveTemplateBackgroundRows(
			slide({ layoutPath: 'layout1.xml' }),
			masters,
			'Layout',
			'Master',
		);
		expect(rows.master).toStrictEqual({
			path: 'master1.xml',
			label: 'Office Theme',
			title: 'Office Theme',
		});
	});

	it('omits the master row when no master references the slide layout', () => {
		const masters: PptxSlideMaster[] = [{ path: 'master2.xml', layoutPaths: ['layout2.xml'] }];
		const rows = resolveTemplateBackgroundRows(
			slide({ layoutPath: 'layout1.xml' }),
			masters,
			'Layout',
			'Master',
		);
		expect(rows.master).toBeUndefined();
	});
});
