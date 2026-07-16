import type { ZoomPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildSummaryZoomView, resolveSummaryZoomNavigation } from './summary-zoom';

const summary: ZoomPptxElement = {
	id: 'summary',
	type: 'zoom',
	zoomType: 'summary',
	targetSlideIndex: 0,
	x: 100,
	y: 50,
	width: 400,
	height: 200,
	summaryLayout: 'fixed',
	summaryTargets: [
		{
			sectionId: 'intro',
			targetSlideIndex: 0,
			x: 100,
			y: 50,
			width: 180,
			height: 200,
			title: 'Welcome',
		},
		{
			sectionId: 'details',
			targetSlideIndex: 3,
			x: 320,
			y: 50,
			width: 180,
			height: 200,
		},
	],
};

describe('summary zoom view model', () => {
	it('preserves tile order, fixed geometry, labels, and targets', () => {
		const view = buildSummaryZoomView(summary, (index) => ({
			slideNumber: index + 10,
			sectionName: index === 3 ? 'Deep dive' : undefined,
			backgroundColor: '#123456',
		}));
		expect(view).toMatchObject({ layout: 'fixed', ariaLabel: 'Summary Zoom with 2 sections' });
		expect(view?.tiles).toMatchObject([
			{ label: 'Welcome', targetSlideIndex: 0, slideLabel: 'Slide 10', style: { left: '0%' } },
			{
				label: 'Deep dive',
				targetSlideIndex: 3,
				slideLabel: 'Slide 13',
				style: { left: '55%' },
			},
		]);
		expect(resolveSummaryZoomNavigation(view, 1)).toBe(3);
	});

	it('builds a grid and rejects invalid navigation indexes', () => {
		const view = buildSummaryZoomView({ ...summary, summaryLayout: 'grid' });
		expect(view?.containerStyle.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
		expect(resolveSummaryZoomNavigation(view, -1)).toBeUndefined();
		expect(resolveSummaryZoomNavigation(view, 3)).toBeUndefined();
	});
});
