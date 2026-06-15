/**
 * Unit tests for zoom-renderer pure helpers.
 *
 * All assertions target functions exported from `zoom-renderer-helpers.ts`
 * (the Angular-free layer). No TestBed or DOM involved, following the same
 * pattern as `connector-renderer.component.test.ts`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildZoomViewModel } from './zoom-renderer-helpers';

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

	it('returns "Section Zoom" badge text for section zoom type', () => {
		const vm = buildZoomViewModel(zoom({ zoomType: 'section', targetSectionId: 'Intro' }));
		expect(vm.badgeText).toBe('Section Zoom');
		expect(vm.zoomType).toBe('section');
		expect(vm.targetSectionId).toBe('Intro');
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
