import type { PptxSlideLayout, PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { layoutToSlide, masterToSlide, selectedMasterSlide } from './master-view';

const layout = { path: 'layout-1.xml', name: 'Title', elements: [] } as unknown as PptxSlideLayout;
const master = {
	path: 'master-1.xml',
	name: 'Primary',
	elements: [],
	layouts: [layout],
} as unknown as PptxSlideMaster;

describe('master view projection', () => {
	it('projects masters and layouts into renderable slides', () => {
		expect(masterToSlide(master)).toMatchObject({ id: 'master-1.xml', elements: [] });
		expect(layoutToSlide(layout)).toMatchObject({ id: 'layout-1.xml', elements: [] });
	});

	it('selects either the master or one of its layouts', () => {
		expect(selectedMasterSlide([master], 0, null)?.id).toBe('master-1.xml');
		expect(selectedMasterSlide([master], 0, 0)?.id).toBe('layout-1.xml');
		expect(selectedMasterSlide([], 0, null)).toBeUndefined();
	});
});
