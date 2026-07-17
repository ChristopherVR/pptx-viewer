/**
 * Unit tests for zoom-renderer pure helpers.
 *
 * All assertions target functions exported from `zoom-renderer-helpers.ts`
 * (the Angular-free layer). No TestBed or DOM involved, following the same
 * pattern as `connector-renderer.component.test.ts`.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildZoomViewModel,
	isZoomActivationKey,
	zoomTargetSlideIndex,
} from './zoom-renderer-helpers';
import { ZoomTargetService } from './zoom-target.service';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function zoom(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'zoom',
		id: 'zm 1',
		x: 10,
		y: 20,
		width: 200,
		height: 120,
		zoomType: 'slide',
		targetSlideIndex: 4,
		...overrides,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// buildZoomViewModel
// ---------------------------------------------------------------------------

describe('buildZoomViewModel', () => {
	it('populates zoom and derived fields from a slide zoom element', () => {
		const vm = buildZoomViewModel(zoom());
		expect(vm.zoom).toBeDefined();
		expect(vm.zoomType).toBe('slide');
		expect(vm.targetSlideIndex).toBe(4);
		expect(vm.badgeText).toBe('Slide Zoom');
		expect(vm.slideLabel).toBe('Slide 5');
		expect(vm.previewSrc).toBeUndefined();
		expect(vm.targetSectionId).toBeUndefined();
	});

	it('falls back to grey background, index label, and section GUID without target info', () => {
		const vm = buildZoomViewModel(
			zoom({ zoomType: 'section', targetSectionId: '{GUID-123}', targetSlideIndex: 2 }),
		);
		expect(vm.thumbnailBackground).toBe('#f0f0f0');
		expect(vm.slideLabel).toBe('Slide 3');
		expect(vm.sectionCaption).toBe('{GUID-123}');
	});

	it('uses the target slide background, number, and section name when target info is supplied', () => {
		const vm = buildZoomViewModel(zoom({ targetSlideIndex: 4, targetSectionId: '{GUID-123}' }), {
			backgroundColor: '#112233',
			slideNumber: 7,
			sectionName: 'Chapter Two',
		});
		expect(vm.thumbnailBackground).toBe('#112233');
		expect(vm.slideLabel).toBe('Slide 7');
		expect(vm.sectionCaption).toBe('Chapter Two');
	});

	it('keeps the grey fallback when target info lacks a background colour', () => {
		const vm = buildZoomViewModel(zoom(), { slideNumber: 3 });
		expect(vm.thumbnailBackground).toBe('#f0f0f0');
		expect(vm.slideLabel).toBe('Slide 3');
	});

	it('returns "Section Zoom" badge text for section zoom type', () => {
		const vm = buildZoomViewModel(zoom({ zoomType: 'section', targetSectionId: 'Intro' }));
		expect(vm.badgeText).toBe('Section Zoom');
		expect(vm.zoomType).toBe('section');
		expect(vm.targetSectionId).toBe('Intro');
	});

	it('returns "Summary Zoom" badge text for summary zoom type', () => {
		const vm = buildZoomViewModel(zoom({ zoomType: 'summary' }));
		expect(vm.badgeText).toBe('Summary Zoom');
		expect(vm.zoomType).toBe('summary');
	});

	it('includes section id in ariaLabel when section zoom has a targetSectionId', () => {
		const vm = buildZoomViewModel(zoom({ zoomType: 'section', targetSectionId: 'Intro' }));
		expect(vm.ariaLabel).toContain('section: Intro');
	});

	it('does not include section clause in ariaLabel for slide zooms', () => {
		const vm = buildZoomViewModel(zoom());
		expect(vm.ariaLabel).not.toContain('section:');
	});

	it('resolves previewSrc from imageData', () => {
		const src = 'data:image/png;base64,ZTHUMB';
		const vm = buildZoomViewModel(zoom({ imageData: src }));
		expect(vm.previewSrc).toBe(src);
	});

	it('slideLabel is 1-based ("Slide 1" when targetSlideIndex is 0)', () => {
		const vm = buildZoomViewModel(zoom({ targetSlideIndex: 0 }));
		expect(vm.slideLabel).toBe('Slide 1');
	});

	it('returns sensible defaults for a non-zoom element', () => {
		const shape: PptxElement = {
			type: 'shape',
			id: 's1',
			name: '',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as PptxElement;
		const vm = buildZoomViewModel(shape);
		expect(vm.zoom).toBeUndefined();
		expect(vm.targetSlideIndex).toBe(0);
		expect(vm.zoomType).toBe('slide');
		expect(vm.previewSrc).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// zoomTargetSlideIndex
// ---------------------------------------------------------------------------

describe('zoomTargetSlideIndex', () => {
	it('returns the zoom element target index', () => {
		expect(zoomTargetSlideIndex(zoom({ targetSlideIndex: 6 }))).toBe(6);
	});

	it('returns 0 for a non-zoom element', () => {
		const shape: PptxElement = {
			type: 'shape',
			id: 's1',
			name: '',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as PptxElement;
		expect(zoomTargetSlideIndex(shape)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// ZoomTargetService.lookup
// ---------------------------------------------------------------------------

describe('zoomTargetService lookup', () => {
	function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
		return {
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [],
			...overrides,
		} as PptxSlide;
	}

	it('maps a target index to the slide background, number, and section name', () => {
		const svc = new ZoomTargetService();
		svc.setSlides([
			slide(),
			slide({
				id: 's2',
				slideNumber: 9,
				backgroundColor: '#abcdef',
				sectionName: 'Appendix',
			}),
		]);
		expect(svc.lookup(1)).toStrictEqual({
			backgroundColor: '#abcdef',
			slideNumber: 9,
			sectionName: 'Appendix',
		});
	});

	it('returns undefined for an out-of-range index', () => {
		const svc = new ZoomTargetService();
		svc.setSlides([slide()]);
		expect(svc.lookup(5)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// isZoomActivationKey
// ---------------------------------------------------------------------------

describe('isZoomActivationKey', () => {
	it('activates on Enter and Space', () => {
		expect(isZoomActivationKey('Enter')).toBeTruthy();
		expect(isZoomActivationKey(' ')).toBeTruthy();
	});

	it('ignores other keys', () => {
		for (const key of ['ArrowRight', 'ArrowLeft', 'a', 'Escape', 'Tab', 'Spacebar']) {
			expect(isZoomActivationKey(key)).toBeFalsy();
		}
	});
});
