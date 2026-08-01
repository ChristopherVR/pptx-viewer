/**
 * On-canvas action affordances, Vanilla side.
 *
 * Applied once the stage is assembled rather than inside each registry
 * renderer: every element type gets its own root node from the registry, so a
 * per-renderer copy would be a dozen duplicates of the same markup. These pin
 * that the badge and the tooltip appear on the editing canvas, on any element
 * type, and never during a running show.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import {
	ACTION_INDICATOR_CLASS,
	LINK_TOOLTIP_CLASS,
	LINK_TOOLTIP_HOST_CLASS,
} from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import { createDefaultRegistry } from './elements';
import { renderSlideStage } from './slide-stage';

function slideWith(elements: PptxSlide['elements']): PptxSlide {
	return { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements } as PptxSlide;
}

const actionShape = [
	{
		type: 'shape',
		id: 'el-action',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		shapeType: 'roundRect',
		actionClick: { url: 'https://example.test' },
	},
] as PptxSlide['elements'];

function render(elements: PptxSlide['elements'], extra: Record<string, unknown> = {}): HTMLElement {
	return renderSlideStage({
		document,
		slide: slideWith(elements),
		canvasSize: { width: 1280, height: 720 },
		mediaDataUrls: new Map<string, string>(),
		registry: createDefaultRegistry(),
		t: createTranslator(),
		...extra,
	});
}

describe('slide stage action affordances', () => {
	it('badges an action shape and offers its destination tooltip', () => {
		const stage = render(actionShape, { interactive: true });
		const node = stage.querySelector('[data-element-id="el-action"]');
		expect(node?.querySelector(`.${ACTION_INDICATOR_CLASS}`)).not.toBeNull();
		expect(node?.querySelector(`.${LINK_TOOLTIP_CLASS}`)?.textContent).toContain(
			'https://example.test',
		);
		expect(node?.classList.contains(LINK_TOOLTIP_HOST_CLASS)).toBeTruthy();
	});

	it('badges a picture too, not only shapes', () => {
		const stage = render(
			[
				{
					type: 'picture',
					id: 'el-pic',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					actionClick: { url: 'https://example.test' },
				},
			] as PptxSlide['elements'],
			{ interactive: true },
		);
		expect(
			stage
				.querySelector('[data-element-id="el-pic"]')
				?.querySelector(`.${ACTION_INDICATOR_CLASS}`),
		).not.toBeNull();
	});

	it('draws nothing on a thumbnail stage', () => {
		expect(render(actionShape).querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
	});

	it('draws nothing while a show is running', () => {
		const stage = render(actionShape, { interactive: true, presenting: true });
		expect(stage.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
		expect(stage.querySelector(`.${LINK_TOOLTIP_CLASS}`)).toBeNull();
	});

	it('draws nothing for an element with no action', () => {
		const stage = render(
			[
				{ type: 'shape', id: 'el-plain', x: 0, y: 0, width: 100, height: 40 },
			] as PptxSlide['elements'],
			{ interactive: true },
		);
		expect(stage.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
	});
});
