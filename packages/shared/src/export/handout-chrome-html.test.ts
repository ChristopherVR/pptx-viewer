import { describe, expect, it } from 'vitest';

import {
	handoutBackgroundStyle,
	handoutChromeBoxesHtml,
	handoutSlideRectCellsHtml,
	hasHandoutChrome,
} from './handout-chrome-html';
import type { HandoutMasterChrome } from './handout-master-chrome';

describe('handoutBackgroundStyle', () => {
	it('returns an empty string when there is no background', () => {
		expect(handoutBackgroundStyle({})).toBe('');
	});

	it('emits a background-color declaration', () => {
		expect(handoutBackgroundStyle({ background: { color: '#112233' } })).toBe(
			'background-color: #112233;',
		);
	});

	it('emits a cover/center background-image declaration', () => {
		const style = handoutBackgroundStyle({
			background: { imageDataUrl: 'data:image/png;base64,AAAA' },
		});
		expect(style).toContain('background-image: url(data:image/png;base64,AAAA)');
		expect(style).toContain('background-size: cover');
	});
});

describe('handoutChromeBoxesHtml', () => {
	it('returns an empty string when the chrome has no boxes', () => {
		expect(handoutChromeBoxesHtml({})).toBe('');
	});

	it('renders a positioned, escaped box per resolved part', () => {
		const chrome: HandoutMasterChrome = {
			header: { text: 'Q&A <Session>', rect: { x: 0, y: 0, w: 0.4, h: 0.04 } },
			footer: { text: 'Footer', rect: { x: 0, y: 0.96, w: 0.4, h: 0.04 } },
			date: { text: 'January 2026', rect: { x: 0.6, y: 0, w: 0.4, h: 0.04 } },
			pageNumber: { text: '1', rect: { x: 0.6, y: 0.96, w: 0.4, h: 0.04 } },
		};
		const html = handoutChromeBoxesHtml(chrome);
		expect(html).toContain('handout-chrome-box--header');
		expect(html).toContain('Q&amp;A &lt;Session&gt;');
		expect(html).toContain('handout-chrome-box--footer');
		expect(html).toContain('handout-chrome-box--date');
		expect(html).toContain('handout-chrome-box--page-number');
		expect(html).toContain('left: 0.000%; top: 0.000%; width: 40.000%; height: 4.000%;');
	});
});

describe('handoutSlideRectCellsHtml', () => {
	it('renders one positioned cell per rect, with an image when the page has one', () => {
		const rects = [
			{ x: 0.05, y: 0.1, w: 0.4, h: 0.3 },
			{ x: 0.55, y: 0.1, w: 0.4, h: 0.3 },
		];
		const html = handoutSlideRectCellsHtml(
			['data:image/png;base64,AAAA', undefined],
			rects,
			[0, 1],
			0,
		);
		expect(html.match(/handout-cell--positioned/gu)).toHaveLength(2);
		expect(html).toContain('<img src="data:image/png;base64,AAAA" alt="Slide 1" />');
		// Second cell has no image (page ran out of slides).
		expect(html).toContain(
			'<div class="handout-cell handout-cell--positioned" style="left: 55.000%; top: 10.000%; width: 40.000%; height: 30.000%;"></div>',
		);
	});
});

describe('hasHandoutChrome', () => {
	it('is false for an empty descriptor', () => {
		expect(hasHandoutChrome({})).toBeFalsy();
	});

	it('is false when only slideRects is set (grid geometry only, no text/background)', () => {
		expect(hasHandoutChrome({ slideRects: [{ x: 0, y: 0, w: 1, h: 1 }] })).toBeFalsy();
	});

	it('is true when any text box or background is set', () => {
		expect(hasHandoutChrome({ background: { color: '#fff' } })).toBeTruthy();
		expect(
			hasHandoutChrome({ pageNumber: { text: '1', rect: { x: 0, y: 0, w: 1, h: 1 } } }),
		).toBeTruthy();
	});
});
