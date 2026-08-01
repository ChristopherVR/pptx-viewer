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

describe('static surfaces and the native media transport', () => {
	// A still of a slide (presenter console pane, thumbnail, transition layer) is
	// not in presentation mode, so the `controls={!isPresentationMode}` rule alone
	// would paint Chrome's scrubber across it. React only escaped that by accident
	// - its previews are handed no media map, so the video falls back to a poster
	// image - and the other four bindings, which do thread the map, drew a control
	// bar over a slide the speaker cannot play. The surface now says what it is.
	const video: PptxElement = {
		id: 'media-1',
		type: 'media',
		x: 0,
		y: 0,
		width: 320,
		height: 180,
		mediaType: 'video',
		mediaData: 'data:video/mp4;base64,AAAA',
	};

	it('renders a video with no transport', () => {
		const html = renderToStaticMarkup(
			<StaticElementRenderer element={video} activeSlide={slide} allSlides={[slide]} zIndex={0} />,
		);
		expect(html).toContain('<video');
		expect(html).not.toContain('controls');
	});
});
