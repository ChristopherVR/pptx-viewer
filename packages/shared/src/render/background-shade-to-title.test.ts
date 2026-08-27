import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveTitleColorForShading, shadeGradientTowardTitle } from './background-shade-to-title';

function slide(overrides: Partial<PptxSlide>): PptxSlide {
	return { id: 'slide1', rId: 'rId1', slideNumber: 1, elements: [], ...overrides };
}

function titleElement(color: string): PptxElement {
	return {
		id: 'title1',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'My Title',
		textSegments: [{ text: 'My Title', style: { color } }],
		rawXml: {
			'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': 'title' } } },
		},
	} as unknown as PptxElement;
}

describe('resolveTitleColorForShading', () => {
	it('returns the resolved colour of the title placeholder', () => {
		const color = resolveTitleColorForShading(slide({ elements: [titleElement('#FF8800')] }));
		expect(color).toBe('#FF8800');
	});

	it('returns undefined when the slide has no text at all', () => {
		expect(resolveTitleColorForShading(slide({ elements: [] }))).toBeUndefined();
	});

	it('returns undefined for a slide with no title colour information', () => {
		const bare: PptxElement = {
			id: 'title1',
			type: 'text',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			text: 'My Title',
			rawXml: { 'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': 'title' } } } },
		} as unknown as PptxElement;
		expect(resolveTitleColorForShading(slide({ elements: [bare] }))).toBeUndefined();
	});
});

describe('shadeGradientTowardTitle', () => {
	it('recolours the last stop of a linear gradient toward the title colour', () => {
		const result = shadeGradientTowardTitle(
			'linear-gradient(90.00deg, #000000 0%, #FFFFFF 100%)',
			'#FF0000',
		);
		expect(result).toBe('linear-gradient(90.00deg, #000000 0%, #FF0000 100%)');
	});

	it('recolours the last stop of a radial gradient toward the title colour', () => {
		const result = shadeGradientTowardTitle(
			'radial-gradient(circle at 50% 50%, #000000 0%, #FFFFFF 100%)',
			'#00FF00',
		);
		expect(result).toBe('radial-gradient(circle at 50% 50%, #000000 0%, #00FF00 100%)');
	});

	it('handles a headerless gradient (no explicit angle/position)', () => {
		const result = shadeGradientTowardTitle('linear-gradient(#000000, #FFFFFF)', '#123456');
		expect(result).toBe('linear-gradient(#000000, #123456)');
	});

	it('preserves alpha on an rgba() stop', () => {
		const result = shadeGradientTowardTitle(
			'linear-gradient(90.00deg, #000000 0%, rgba(255, 255, 255, 0.5) 100%)',
			'#112233',
		);
		expect(result).toBe('linear-gradient(90.00deg, #000000 0%, rgba(17, 34, 51, 0.5) 100%)');
	});

	it('returns the gradient unchanged when there is no title colour', () => {
		const gradient = 'linear-gradient(90.00deg, #000000 0%, #FFFFFF 100%)';
		expect(shadeGradientTowardTitle(gradient, undefined)).toBe(gradient);
	});

	it('returns the input unchanged when it is not a recognised gradient', () => {
		expect(shadeGradientTowardTitle('#FF0000', '#00FF00')).toBe('#FF0000');
	});

	it('returns undefined unchanged when the gradient is undefined', () => {
		expect(shadeGradientTowardTitle(undefined, '#00FF00')).toBeUndefined();
	});
});
