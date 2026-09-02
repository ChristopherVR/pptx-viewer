import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderTextShapeElement } from './text-shape';

function makeContext(overrides: Partial<ElementRenderContext> = {}): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'r1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting: false,
		interactive: false,
		registry,
		renderElement: (element, zIndex) => registry.resolve(element.type)(element, zIndex, context),
		...overrides,
	};
	return context;
}

function emptyPlaceholder(): PptxElement {
	return {
		type: 'text',
		id: 'ph-1',
		x: 0,
		y: 0,
		width: 200,
		height: 40,
		promptText: 'Click to add title',
	} as PptxElement;
}

describe('renderTextShapeElement placeholder prompt', () => {
	it('shows the greyed-out hint on the interactive editor stage', () => {
		const node = renderTextShapeElement(
			emptyPlaceholder(),
			0,
			makeContext({ interactive: true, presenting: false }),
		) as HTMLElement;
		const hint = node.querySelector('.pptxv-placeholder-prompt');
		expect(hint?.textContent).toBe('Click to add title');
	});

	it('hides the hint while presenting', () => {
		const node = renderTextShapeElement(
			emptyPlaceholder(),
			0,
			makeContext({ interactive: true, presenting: true }),
		) as HTMLElement;
		expect(node.querySelector('.pptxv-placeholder-prompt')).toBeNull();
	});

	it('hides the hint on a non-interactive surface (thumbnail/export)', () => {
		const node = renderTextShapeElement(
			emptyPlaceholder(),
			0,
			makeContext({ interactive: false, presenting: false }),
		) as HTMLElement;
		expect(node.querySelector('.pptxv-placeholder-prompt')).toBeNull();
	});

	it('never shows the hint once the element has real text', () => {
		const element = {
			...emptyPlaceholder(),
			text: 'Hello',
			textSegments: [{ text: 'Hello', style: {} }],
		};
		const node = renderTextShapeElement(
			element as PptxElement,
			0,
			makeContext({ interactive: true, presenting: false }),
		) as HTMLElement;
		expect(node.querySelector('.pptxv-placeholder-prompt')).toBeNull();
	});
});
