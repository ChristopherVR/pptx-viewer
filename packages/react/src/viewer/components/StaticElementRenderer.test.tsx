import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PresentationTransitionOverlay } from './PresentationTransitionOverlay';
import { ScaledSlidePreview } from './ScaledSlidePreview';
import { SlideThumbnail } from './SlideThumbnail';
import { StaticElementRenderer } from './StaticElementRenderer';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

const chart: PptxElement = {
	id: 'chart-1',
	type: 'chart',
	x: 20,
	y: 30,
	width: 400,
	height: 240,
	chartData: {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'Revenue', values: [12, 18] }],
	},
};

const table: PptxElement = {
	id: 'table-1',
	type: 'table',
	x: 10,
	y: 10,
	width: 200,
	height: 80,
	tableData: {
		rows: [{ cells: [{ text: 'Evidence cell' }] }],
		columnWidths: [1],
	},
};

const effectedImage: PptxElement = {
	id: 'image-1',
	type: 'image',
	x: 440,
	y: 30,
	width: 120,
	height: 80,
	imageData: 'data:image/png;base64,AA==',
	imageEffects: {
		biLevel: 25,
		alphaModFix: 50,
		colorWash: { color: '#112233', opacity: 135 },
	},
};

const slide: PptxSlide = {
	id: 'slide-1',
	rId: 'rId1',
	slideNumber: 1,
	elements: [chart, effectedImage],
};

describe('static rich element rendering', () => {
	it('dispatches rich group children to their chart and table renderers', () => {
		const group: PptxElement = {
			id: 'group-1',
			type: 'group',
			x: 0,
			y: 0,
			width: 500,
			height: 300,
			children: [chart, table],
		};
		const html = renderToStaticMarkup(<StaticElementRenderer element={group} />);

		expect(html).toContain('data-static-element-type="chart"');
		expect(html).toContain('data-static-element-type="table"');
		expect(html).toContain('<svg');
		expect(html).toContain('<table');
		expect(html).toContain('Evidence cell');
	});

	it('uses the shared chart renderer on every alternate slide surface', () => {
		const preview = renderToStaticMarkup(
			<ScaledSlidePreview
				slide={slide}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
			/>,
		);
		const thumbnail = renderToStaticMarkup(
			<SlideThumbnail
				slide={slide}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
			/>,
		);
		const transition = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={slide}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={{ type: 'fade' }}
				durationMs={300}
				onComplete={vi.fn()}
			/>,
		);

		for (const html of [preview, thumbnail, transition]) {
			expect(html).toContain('data-static-element-type="chart"');
			expect(html).toContain('data-chart-part="dataPoint"');
			expect(html).toContain('data-static-element-type="image"');
			expect(html).toContain('imgalpha-image-1');
			expect(html).toContain('opacity:0.5');
			expect(html).toContain('background-color:#112233;opacity:1');
		}
	});
});
