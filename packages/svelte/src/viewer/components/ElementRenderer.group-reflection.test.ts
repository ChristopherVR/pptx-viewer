import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * Regression: a group has no `shapeStyle` of its own, so `ElementRenderer`'s
 * group branch never mounted `ShapeEffectOverlay` at all. `p:grpSpPr/a:effectLst/a:reflection`
 * lands on `groupFill` (the same extractor a regular shape's `spPr` uses), so
 * a group-level reflection is real, authorable OOXML that rendered nothing
 * whatsoever before this fix.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
	});
	flushSync();
	return target;
}

describe('elementRenderer group-level a:reflection', () => {
	it('mirrors a reflected group by recursing into its children', () => {
		const target = render({
			type: 'group',
			id: 'g-refl',
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			groupEffectStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
			children: [{ type: 'text', id: 'c1', x: 0, y: 0, width: 50, height: 20, text: 'child' }],
		} as unknown as PptxElement);
		const layer = target.querySelector<HTMLElement>('.pptx-svelte-reflection');
		expect(layer?.textContent).toContain('child');
	});

	it('renders nothing extra for a group with no groupFill reflection', () => {
		const target = render({
			type: 'group',
			id: 'g-plain',
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			children: [{ type: 'text', id: 'c1', x: 0, y: 0, width: 50, height: 20, text: 'child' }],
		} as unknown as PptxElement);
		expect(target.querySelector('.pptx-svelte-reflection')).toBeNull();
	});

	it('paints a group-level shadow/glow as a CSS filter on the group container', () => {
		const target = render({
			type: 'group',
			id: 'g-shadow',
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			groupEffectStyle: {
				shadowColor: '#000000',
				shadowAngle: 0,
				shadowDistance: 4,
				shadowBlur: 6,
			},
			children: [{ type: 'text', id: 'c1', x: 0, y: 0, width: 50, height: 20, text: 'child' }],
		} as unknown as PptxElement);
		const group = target.querySelector<HTMLElement>('.pptx-svelte-group');
		expect(group?.style.filter).toContain('drop-shadow');
		expect(group?.style.boxShadow).toBe('');
	});

	it('double-mirrors a child that carries its own reflection inside a reflected group', () => {
		const target = render({
			type: 'group',
			id: 'g-nested',
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			groupEffectStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
			children: [
				{
					type: 'shape',
					id: 'child-own-reflection',
					x: 0,
					y: 0,
					width: 50,
					height: 20,
					shapeStyle: {
						fillColor: '#00ff00',
						reflectionStartOpacity: 0.5,
						reflectionDistance: 2,
					},
				},
			],
		} as unknown as PptxElement);
		// Three wrappers: the child's own LIVE reflection (rendered normally as
		// part of the group, unrelated to the group's mirror), the group's own
		// mirror, and - nested inside that mirror - the child's reflection AGAIN
		// (the group's mirror composites the group's fully-rendered content,
		// which already includes the child's own reflection).
		expect(target.querySelectorAll('.pptx-svelte-reflection')).toHaveLength(3);
	});
});
