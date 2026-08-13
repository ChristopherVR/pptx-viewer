import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { ElementRenderContext } from '../types';
import { renderGroupElement } from './group';
import { renderTextShapeElement } from './text-shape';

/**
 * The vanilla registry's `renderElement` signature is fixed, so the group
 * renderer cannot thread the parent fill down as an argument. Instead the
 * OUTERMOST group patches each `a:grpFill` node in its subtree with the fill
 * resolved for it. These tests exercise that wiring end to end (group renderer
 * + the real text/shape child renderer), nesting included.
 */
function context(): ElementRenderContext {
	const ctx = {
		document,
		mediaDataUrls: new Map(),
		renderElement: (element: PptxElement, zIndex: number) =>
			element.type === 'group'
				? renderGroupElement(element, zIndex, ctx)
				: renderTextShapeElement(element, zIndex, ctx),
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

/** An outer group holding an inner group whose only child uses `a:grpFill`. */
function nestedGroup(
	outerFill: ShapeStyle | undefined,
	innerFill: ShapeStyle | undefined,
): PptxElement {
	return {
		type: 'group',
		id: 'outer',
		x: 0,
		y: 0,
		width: 200,
		height: 200,
		groupFill: outerFill,
		children: [
			{
				type: 'group',
				id: 'inner',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				groupFill: innerFill,
				children: [
					{
						type: 'shape',
						id: 'leaf-1',
						x: 0,
						y: 0,
						width: 50,
						height: 50,
						shapeStyle: { fillMode: 'group' },
					},
				],
			},
		],
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

	// `a:grpFill` resolves against the nearest ANCESTOR group that has a fill.
	// A `p:grpSp` inside a `p:grpSp` now loads as a nested group, and the group
	// renderer asked the IMMEDIATE group only, so a shape two levels down came
	// out transparent. PowerPoint paints it with the outer group's fill.
	it('paints a grpFill leaf inside a fill-less nested group', () => {
		const node = renderGroupElement(
			nestedGroup({ fillColor: '#ff0000' }, undefined),
			0,
			context(),
		) as HTMLElement;
		const leaf = node.querySelector('[data-element-id="leaf-1"]') as HTMLElement;
		expect(leaf.style.backgroundColor).toBe('#ff0000');
	});

	it('paints a grpFill leaf inside a nested group that is itself grpFill', () => {
		const node = renderGroupElement(
			nestedGroup({ fillColor: '#ff0000' }, { fillMode: 'group' }),
			0,
			context(),
		) as HTMLElement;
		const leaf = node.querySelector('[data-element-id="leaf-1"]') as HTMLElement;
		expect(leaf.style.backgroundColor).toBe('#ff0000');
	});
});
