import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { SlideThumbnailProps } from './SlideThumbnail';
import { slideThumbnailPropsEqual } from './SlideThumbnail';

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'ppt/slides/slide1.xml',
		slideNumber: 1,
		elements: [],
		showMasterShapes: true,
		...overrides,
	} as unknown as PptxSlide;
}

function makeProps(overrides: Partial<SlideThumbnailProps> = {}): SlideThumbnailProps {
	return {
		slide: makeSlide(),
		templateElements: [],
		canvasSize: { width: 960, height: 540 },
		...overrides,
	};
}

describe('slideThumbnailPropsEqual', () => {
	it('treats identical props as equal', () => {
		const props = makeProps();
		expect(slideThumbnailPropsEqual(props, props)).toBeTruthy();
	});

	it('is unequal when showMasterShapes flips, even with the same elements/templateElements references', () => {
		// buildPreviewElements -> visibleTemplateElements drops inherited
		// layout/master artwork entirely when showMasterShapes is false, so the
		// memo must not skip a re-render just because `elements` and
		// `templateElements` themselves are unchanged.
		const templateElements = [{ id: 'layout-1' }] as SlideThumbnailProps['templateElements'];
		const prev = makeProps({
			slide: makeSlide({ showMasterShapes: true }),
			templateElements,
		});
		const next = makeProps({
			slide: makeSlide({ showMasterShapes: false }),
			templateElements,
		});
		expect(slideThumbnailPropsEqual(prev, next)).toBeFalsy();
	});

	it('is unequal when the slide id, dirty flag or hidden flag changes', () => {
		const base = makeProps();
		expect(
			slideThumbnailPropsEqual(base, makeProps({ slide: makeSlide({ id: 'other' }) })),
		).toBeFalsy();
		expect(
			slideThumbnailPropsEqual(base, makeProps({ slide: makeSlide({ isDirty: true }) })),
		).toBeFalsy();
		expect(
			slideThumbnailPropsEqual(base, makeProps({ slide: makeSlide({ hidden: true }) })),
		).toBeFalsy();
	});

	it('is unequal when canvasSize changes', () => {
		const base = makeProps();
		expect(
			slideThumbnailPropsEqual(base, makeProps({ canvasSize: { width: 1280, height: 720 } })),
		).toBeFalsy();
	});
});
