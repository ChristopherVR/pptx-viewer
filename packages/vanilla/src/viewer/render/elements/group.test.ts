import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { ElementRenderContext } from '../types';
import { renderGroupElement } from './group';
import { renderTextShapeElement } from './text-shape';

/**
 * The vanilla registry's `renderElement` signature is fixed, so the group
 * renderer cannot thread the parent fill down as an argument. Instead it
 * patches each `a:grpFill` child's already-rendered node with the group's own
 * resolved fill. These tests exercise that wiring end to end (group renderer +
 * the real text/shape child renderer).
 */
function context(): ElementRenderContext {
	const ctx = {
		document,
		mediaDataUrls: new Map(),
		renderElement: (element: PptxElement, zIndex: number) =>
			renderTextShapeElement(element, zIndex, ctx),
	} as unknown as ElementRenderContext;
	return ctx;
}

function grpFillChild(): PptxElement {
	return {
		type: 'shape',
		id: 'child-1',
		x: 0,
		y: 0,
		width: 50,
		height: 50,
		shapeStyle: { fillMode: 'group' },
	} as PptxElement;
}

function group(groupFill: ShapeStyle | undefined): PptxElement {
	return {
		type: 'group',
		id: 'g1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		children: [grpFillChild()],
		groupFill,
	} as PptxElement;
}

describe('renderGroupElement a:grpFill inheritance', () => {
	it('paints a grpFill child with the parent group solid fill', () => {
		const node = renderGroupElement(group({ fillColor: '#abcdef' }), 0, context()) as HTMLElement;
		const child = node.querySelector('[data-element-id="child-1"]') as HTMLElement;
		expect(child.style.backgroundColor).toBe('#abcdef');
	});

	it('leaves a grpFill child unfilled when the group carries no fill', () => {
		const node = renderGroupElement(group(undefined), 0, context()) as HTMLElement;
		const child = node.querySelector('[data-element-id="child-1"]') as HTMLElement;
		expect(child.style.backgroundColor).toBe('');
	});
});
