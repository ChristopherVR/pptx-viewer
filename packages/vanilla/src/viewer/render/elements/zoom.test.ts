import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderZoomElement } from './zoom';

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function makeContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
	};
	return context;
}

function zoomElement(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'zoom',
		id: 'zm-1',
		x: 300,
		y: 200,
		width: 200,
		height: 120,
		zoomType: 'slide',
		targetSlideIndex: 5,
		...overrides,
	} as PptxElement;
}

describe('renderZoomElement', () => {
	it('returns null for non-zoom elements', () => {
		const el = { type: 'text', id: 't1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(renderZoomElement(el, 0, makeContext())).toBeNull();
	});

	it('renders the preview thumbnail with a Slide Zoom badge', () => {
		const node = renderZoomElement(
			zoomElement({ imageData: PNG_DATA_URL }),
			4,
			makeContext(),
		) as HTMLElement;
		expect(node.dataset.elementId).toBe('zm-1');
		expect(node.dataset.zoomType).toBe('slide');
		expect(node.dataset.zoomTarget).toBe('5');
		expect(node.style.left).toBe('300px');
		expect(node.style.zIndex).toBe('4');
		expect(node.getAttribute('aria-label')).toBe('Zoom to slide 6');

		const img = node.querySelector<HTMLImageElement>('img.pptxv-zoom-img');
		expect(img?.getAttribute('src')).toBe(PNG_DATA_URL);
		expect(img?.alt).toBe('Preview of slide 6');
		expect(node.querySelector('.pptxv-zoom-thumbnail')).toBeNull();
		expect(node.querySelector('.pptxv-zoom-badge')?.textContent).toBe('Slide Zoom');
	});

	it('renders the fallback tile with the target slide number when no preview exists', () => {
		const node = renderZoomElement(zoomElement(), 0, makeContext()) as HTMLElement;
		expect(node.querySelector('img')).toBeNull();
		const tile = node.querySelector<HTMLElement>('.pptxv-zoom-thumbnail');
		expect(tile).toBeTruthy();
		expect(tile?.querySelector('.pptxv-zoom-slide-label')?.textContent).toBe('Slide 6');
		expect(tile?.querySelector('.pptxv-zoom-section-label')).toBeNull();
	});

	it('renders section zooms with the section id and a Section Zoom badge', () => {
		const node = renderZoomElement(
			zoomElement({ zoomType: 'section', targetSectionId: '{ABC-123}' }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.dataset.zoomType).toBe('section');
		expect(node.getAttribute('aria-label')).toBe('Zoom to slide 6 (section: {ABC-123})');
		expect(node.querySelector('.pptxv-zoom-section-label')?.textContent).toBe('{ABC-123}');
		expect(node.querySelector('.pptxv-zoom-badge')?.textContent).toBe('Section Zoom');
	});
});
