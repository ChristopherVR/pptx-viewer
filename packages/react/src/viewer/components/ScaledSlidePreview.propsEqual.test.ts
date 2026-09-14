import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { ScaledSlidePreviewProps } from './ScaledSlidePreview';
import { scaledSlidePreviewPropsEqual } from './ScaledSlidePreview';

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'ppt/slides/slide1.xml',
		slideNumber: 1,
		elements: [],
		showMasterShapes: true,
		...overrides,
	} as unknown as PptxSlide;
}

function makeProps(overrides: Partial<ScaledSlidePreviewProps> = {}): ScaledSlidePreviewProps {
	return {
		slide: makeSlide(),
		templateElements: [],
		canvasSize: { width: 960, height: 540 },
		...overrides,
	};
}

describe('scaledSlidePreviewPropsEqual', () => {
	it('treats identical props as equal', () => {
		const props = makeProps();
		expect(scaledSlidePreviewPropsEqual(props, props)).toBeTruthy();
	});

	it('is unequal when showMasterShapes flips, even with the same elements/templateElements references', () => {
		// visibleTemplateElements drops inherited layout/master artwork
		// entirely when showMasterShapes is false, so the presenter-view
		// current/next-slide preview must not skip a re-render just because
		// `elements`/`templateElements` themselves are unchanged.
		const templateElements = [{ id: 'layout-1' }] as ScaledSlidePreviewProps['templateElements'];
		const prev = makeProps({
			slide: makeSlide({ showMasterShapes: true }),
			templateElements,
		});
		const next = makeProps({
			slide: makeSlide({ showMasterShapes: false }),
			templateElements,
		});
		expect(scaledSlidePreviewPropsEqual(prev, next)).toBeFalsy();
	});

	it('is unequal when the slide id, dirty flag, hidden flag or className changes', () => {
		const base = makeProps();
		expect(
			scaledSlidePreviewPropsEqual(base, makeProps({ slide: makeSlide({ id: 'other' }) })),
		).toBeFalsy();
		expect(
			scaledSlidePreviewPropsEqual(base, makeProps({ slide: makeSlide({ isDirty: true }) })),
		).toBeFalsy();
		expect(
			scaledSlidePreviewPropsEqual(base, makeProps({ slide: makeSlide({ hidden: true }) })),
		).toBeFalsy();
		expect(scaledSlidePreviewPropsEqual(base, makeProps({ className: 'x' }))).toBeFalsy();
	});
});
