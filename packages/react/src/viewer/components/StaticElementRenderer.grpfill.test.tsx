// @vitest-environment happy-dom
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import React, { act } from 'react';
/**
 * Regression test for `a:grpFill` (group fill) inheritance in the React group
 * renderer. A child shape declaring `fillMode === 'group'` must paint with the
 * enclosing group's own fill (`GroupPptxElement.groupFill`), which
 * `getShapeVisualStyle` alone does not resolve. The fix threads the group fill
 * down through `StaticElementRenderer` and merges the shared resolver's output.
 */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StaticElementRenderer } from './StaticElementRenderer';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function grpFillChild(id: string): PptxElement {
	return {
		type: 'shape',
		id,
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
		children: [grpFillChild('child-1')],
		groupFill,
	} as PptxElement;
}

/** Reads the rendered background colour of the group's grpFill child. */
function childBackground(): string {
	const child = container.querySelector<HTMLElement>('[data-static-element-type="shape"]');
	return child?.style.backgroundColor ?? '';
}

describe('a:grpFill inheritance in StaticElementRenderer', () => {
	it('paints a grpFill child with the parent group solid fill', () => {
		act(() => {
			root.render(<StaticElementRenderer element={group({ fillColor: '#abcdef' })} />);
		});
		const bg = childBackground();
		expect(bg === '#abcdef' || bg === 'rgb(171, 205, 239)').toBeTruthy();
	});

	it('leaves a grpFill child transparent when the group carries no fill', () => {
		act(() => {
			root.render(<StaticElementRenderer element={group(undefined)} />);
		});
		// No parent fill to inherit: the base visual style keeps it transparent.
		expect(childBackground()).toBe('transparent');
	});
});
