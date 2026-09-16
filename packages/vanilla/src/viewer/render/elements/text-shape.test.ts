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

describe('renderTextShapeElement degenerate (issue #285)', () => {
	/** A 1-pt horizontal rule: ~1.25px tall, solid-filled as a plain rect. */
	function thinRule(): PptxElement {
		return {
			type: 'shape',
			id: 'rule-1',
			x: 0,
			y: 0,
			width: 400,
			height: 1.25,
			shapeType: 'rect',
			shapeStyle: { fillColor: '#000000' },
		} as unknown as PptxElement;
	}

	it('paints the wrapper at the authored height, never padded to a solid bar', () => {
		const node = renderTextShapeElement(
			thinRule(),
			0,
			makeContext({ interactive: false, presenting: false }),
		) as HTMLElement;
		expect(node.style.height).toBe('1.25px');
	});

	it('adds an invisible, bigger hit target only on the interactive canvas', () => {
		const interactiveNode = renderTextShapeElement(
			thinRule(),
			0,
			makeContext({ interactive: true, presenting: false }),
		) as HTMLElement;
		const hitTarget = interactiveNode.querySelector('[data-pptx-hit-target]') as HTMLElement | null;
		expect(hitTarget).not.toBeNull();
		expect(hitTarget!.style.height).toBe('12px');
		expect(hitTarget!.style.pointerEvents).toBe('auto');
		// The wrapper's own painted box stays at the authored (unpadded) size.
		expect(interactiveNode.style.height).toBe('1.25px');
	});

	it('never adds the hit target on a read-only surface', () => {
		const node = renderTextShapeElement(
			thinRule(),
			0,
			makeContext({ interactive: false, presenting: false }),
		) as HTMLElement;
		expect(node.querySelector('[data-pptx-hit-target]')).toBeNull();
	});

	it('never adds the hit target while presenting', () => {
		const node = renderTextShapeElement(
			thinRule(),
			0,
			makeContext({ interactive: true, presenting: true }),
		) as HTMLElement;
		expect(node.querySelector('[data-pptx-hit-target]')).toBeNull();
	});
});
