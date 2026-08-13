import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * `a:grpFill` resolves against the nearest ANCESTOR group that has a fill, not
 * the immediate parent. Every binding handed its children the immediate group's
 * fill only, so once a `p:grpSp` inside a `p:grpSp` loaded as a real nested
 * group (instead of being flattened away), a shape two levels down painted
 * transparent. PowerPoint paints it with the outer group's fill.
 */

let cleanup: (() => void) | undefined;

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
				children: [grpFillLeaf()],
			},
		],
	} as PptxElement;
}

function mountEl(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 0 },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** Both spellings a DOM implementation may echo back for the same colour. */
function expectRed(value: string): void {
	expect(value === '#ff0000' || value === 'rgb(255, 0, 0)').toBeTruthy();
}

function leafBackground(target: HTMLElement): string {
	const leaf = target.querySelector<HTMLElement>('[data-element-id="leaf-1"]');
	return leaf?.style.backgroundColor ?? '';
}

describe('a:grpFill inheritance through nested groups', () => {
	it('paints a grpFill leaf inside a fill-less nested group', () => {
		const target = mountEl(nestedGroup({ fillColor: '#ff0000' }, undefined));
		expectRed(leafBackground(target));
	});

	it('paints a grpFill leaf inside a nested group that is itself grpFill', () => {
		const target = mountEl(nestedGroup({ fillColor: '#ff0000' }, { fillMode: 'group' }));
		expectRed(leafBackground(target));
	});
});
