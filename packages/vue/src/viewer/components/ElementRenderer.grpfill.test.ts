import { mount } from '@vue/test-utils';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.vue';

/**
 * `a:grpFill` resolves against the nearest ANCESTOR group that has a fill, not
 * the immediate parent. Every binding handed its children the immediate group's
 * fill only, so once a `p:grpSp` inside a `p:grpSp` loaded as a real nested
 * group (instead of being flattened away), a shape two levels down painted
 * transparent. PowerPoint paints it with the outer group's fill.
 */

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

/** The inline background colour painted on the deepest `a:grpFill` shape. */
function leafBackground(): string {
	const leaf = document.querySelector<HTMLElement>('[data-element-id="leaf-1"]');
	return leaf?.style.backgroundColor ?? '';
}

/** Both spellings a DOM implementation may echo back for the same colour. */
function expectRed(value: string): void {
	expect(value === '#ff0000' || value === 'rgb(255, 0, 0)').toBeTruthy();
}

describe('a:grpFill inheritance through nested groups', () => {
	it('paints a grpFill leaf inside a fill-less nested group', () => {
		const wrapper = mount(ElementRenderer, {
			props: { element: nestedGroup({ fillColor: '#ff0000' }, undefined), zIndex: 0 },
			attachTo: document.body,
		});
		expectRed(leafBackground());
		wrapper.unmount();
	});

	it('paints a grpFill leaf inside a nested group that is itself grpFill', () => {
		const wrapper = mount(ElementRenderer, {
			props: {
				element: nestedGroup({ fillColor: '#ff0000' }, { fillMode: 'group' }),
				zIndex: 0,
			},
			attachTo: document.body,
		});
		expectRed(leafBackground());
		wrapper.unmount();
	});
});
