import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import { createDefaultRegistry } from './elements';
import { renderSlideStage } from './slide-stage';

/**
 * The Selection Pane's hide toggle must actually hide the shape.
 *
 * `renderElement` is the single choke point every vanilla surface goes through
 * (canvas, group children, thumbnails, the master rail and the offscreen export
 * raster), so hidden elements are dropped there and no node reaches any of
 * them. The Selection Pane keeps listing them: it reads the slide model.
 */

function buildSlide(): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [
			{ type: 'shape', id: 'el-visible', x: 0, y: 0, width: 100, height: 50 },
			{ type: 'shape', id: 'el-hidden', x: 0, y: 60, width: 100, height: 50, hidden: true },
			{
				type: 'group',
				id: 'el-group',
				x: 200,
				y: 0,
				width: 200,
				height: 100,
				children: [
					{ type: 'shape', id: 'child-visible', x: 0, y: 0, width: 50, height: 50 },
					{ type: 'shape', id: 'child-hidden', x: 60, y: 0, width: 50, height: 50, hidden: true },
				],
			},
		],
	} as unknown as PptxSlide;
}

function renderStage(slide: PptxSlide): HTMLElement {
	return renderSlideStage({
		document,
		slide,
		canvasSize: { width: 1280, height: 720 },
		mediaDataUrls: new Map(),
		registry: createDefaultRegistry(),
		t: createTranslator(),
		interactive: true,
	});
}

describe('hidden elements never reach the stage', () => {
	it('renders visible elements and skips hidden ones', () => {
		const stage = renderStage(buildSlide());
		expect(stage.querySelector('[data-element-id="el-visible"]')).not.toBeNull();
		expect(stage.querySelector('[data-element-id="el-hidden"]')).toBeNull();
	});

	it('skips hidden group children without dropping their siblings', () => {
		const stage = renderStage(buildSlide());
		expect(stage.querySelector('[data-element-id="child-visible"]')).not.toBeNull();
		expect(stage.querySelector('[data-element-id="child-hidden"]')).toBeNull();
	});

	it('leaves no hit-testable node behind for a hidden element', () => {
		const stage = renderStage(buildSlide());
		const marked = [...stage.querySelectorAll('[data-pptx-element="true"]')].map(
			(node) => (node as HTMLElement).dataset.elementId,
		);
		expect(marked).not.toContain('el-hidden');
		expect(marked).not.toContain('child-hidden');
	});

	it('renders the element again once it is un-hidden', () => {
		const slide = buildSlide();
		(slide.elements[1] as { hidden?: boolean }).hidden = false;
		const stage = renderStage(slide);
		expect(stage.querySelector('[data-element-id="el-hidden"]')).not.toBeNull();
	});
});
