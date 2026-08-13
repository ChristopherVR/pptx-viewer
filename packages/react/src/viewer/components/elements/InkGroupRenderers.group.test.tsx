// @vitest-environment happy-dom
/**
 * `renderGroup` is the fallback painter `renderBody` uses when a caller passes
 * no `renderGroupChild` dispatcher. It builds its own boxes instead of
 * delegating to `ElementRenderer`, so it has to restate every rule the main
 * path gets for free - including recursion. A `p:grpSp` inside a `p:grpSp` now
 * loads as a nested group rather than being flattened into its parent's child
 * list, and the flat painter drew such a child as an empty box, dropping the
 * whole sub-group.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderGroup } from './InkGroupRenderers';

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

function grpFillLeaf(): PptxElement {
	return {
		type: 'shape',
		id: 'leaf-1',
		x: 0,
		y: 0,
		width: 50,
		height: 50,
		shapeStyle: { fillMode: 'group' },
	} as PptxElement;
}

function innerGroup(groupFill: ShapeStyle | undefined): PptxElement {
	return {
		type: 'group',
		id: 'inner',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		groupFill,
		children: [grpFillLeaf()],
	} as PptxElement;
}

function leaf(): HTMLElement | null {
	return container.querySelector<HTMLElement>('[data-element-id="leaf-1"]');
}

describe('renderGroup with a nested group child', () => {
	it('renders the shapes inside a nested group instead of an empty box', () => {
		act(() => {
			root.render(renderGroup([innerGroup(undefined)]));
		});
		expect(container.querySelector('[data-element-id="inner"]')).not.toBeNull();
		expect(leaf()).not.toBeNull();
	});

	it('chains the enclosing fill to a grpFill shape inside a fill-less nested group', () => {
		act(() => {
			root.render(renderGroup([innerGroup(undefined)], { fillColor: '#ff0000' }));
		});
		const background = leaf()?.style.backgroundColor ?? '';
		expect(background === '#ff0000' || background === 'rgb(255, 0, 0)').toBeTruthy();
	});
});
