import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * ElementRenderer hit-testing tests: what the element's own box is allowed to
 * write for `pointer-events`.
 *
 * A running show decides hit-testing with the stylesheet in
 * `render/presentation-hit-test` (scenery transparent, then whatever owns its own
 * click re-enabled), so ANY inline value here outranks it and breaks the rule.
 * This branch used to write `auto` whenever the element was interactive, and the
 * show stage renders interactive, so every piece of scenery stayed clickable and
 * could swallow a click meant for an Action Setting underneath it.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function shape(id: string): PptxElement {
	return {
		type: 'shape',
		id,
		x: 10,
		y: 10,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#336699' },
	} as unknown as PptxElement;
}

function box(element: PptxElement, props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1, ...props },
	});
	flushSync();
	const node = target.querySelector<HTMLElement>(`[data-element-id="${element.id}"]`);
	expect(node).not.toBeNull();
	return node as HTMLElement;
}

describe('elementRenderer inline pointer-events', () => {
	it('writes nothing during a show, so the hit-test stylesheet decides', () => {
		const node = box(shape('shape-show'), { presenting: true, interactive: true });
		expect(node.style.pointerEvents).toBe('');
	});

	it('still locks an interaction-locked template element off-stage', () => {
		// `layout-` marks an inherited layout shape; with template editing off
		// nothing but this inline value tells the DOM node it is locked.
		const node = box(shape('layout-shape-1'), { presenting: false, interactive: true });
		expect(node.style.pointerEvents).toBe('none');
	});

	it('leaves an ordinary editable element unlocked off-stage', () => {
		const node = box(shape('shape-edit'), { presenting: false, interactive: true });
		expect(node.style.pointerEvents).toBe('');
	});
});
