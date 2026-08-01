/**
 * On-canvas action affordances, Svelte side.
 *
 * Painted at the stage boundary (alongside the shared accessibility pass)
 * rather than inside `ElementRenderer`, which dispatches every non-shape type
 * straight to a per-type view whose root IS the element node. These pin that
 * the badge and the tooltip appear on the editing canvas, on every element
 * type, and never during a running show.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	ACTION_INDICATOR_CLASS,
	LINK_TOOLTIP_CLASS,
	LINK_TOOLTIP_HOST_CLASS,
} from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import SlideStage from './SlideStage.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function slideWith(elements: PptxElement[]): PptxSlide {
	return { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements } as PptxSlide;
}

function element(overrides: Partial<PptxElement>): PptxElement {
	return {
		type: 'shape',
		id: 'sp-1',
		x: 0,
		y: 0,
		width: 120,
		height: 60,
		...overrides,
	} as PptxElement;
}

/**
 * Mount and let the post-render pass run: it is queued as a microtask so the
 * DOM has settled before it decorates.
 */
async function mountStage(
	elements: PptxElement[],
	props: Record<string, unknown> = {},
): Promise<HTMLElement> {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SlideStage, {
		target,
		props: {
			slide: slideWith(elements),
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map<string, string>(),
			...props,
		},
	});
	flushSync();
	await Promise.resolve();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('slideStage action affordances', () => {
	it('badges an action shape and offers its destination tooltip', async () => {
		const target = await mountStage([element({ actionClick: { url: 'https://example.test' } })], {
			interactive: true,
		});
		const node = target.querySelector('[data-element-id="sp-1"]');
		expect(node?.querySelector(`.${ACTION_INDICATOR_CLASS}`)).not.toBeNull();
		expect(node?.querySelector(`.${LINK_TOOLTIP_CLASS}`)?.textContent).toContain(
			'https://example.test',
		);
		expect(node?.classList.contains(LINK_TOOLTIP_HOST_CLASS)).toBeTruthy();
	});

	it('badges a picture too, not only the shape branch', async () => {
		const target = await mountStage(
			[element({ id: 'pic-1', type: 'picture', actionClick: { url: 'https://example.test' } })],
			{ interactive: true },
		);
		expect(
			target
				.querySelector('[data-element-id="pic-1"]')
				?.querySelector(`.${ACTION_INDICATOR_CLASS}`),
		).not.toBeNull();
	});

	it('draws nothing on a thumbnail stage', async () => {
		const target = await mountStage([element({ actionClick: { url: 'https://example.test' } })], {
			scale: 0.15,
		});
		expect(target.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
	});

	it('draws nothing while a show is running', async () => {
		const target = await mountStage([element({ actionClick: { url: 'https://example.test' } })], {
			interactive: true,
			presenting: true,
		});
		expect(target.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
		expect(target.querySelector(`.${LINK_TOOLTIP_CLASS}`)).toBeNull();
	});

	it('draws nothing for an element with no action', async () => {
		const target = await mountStage([element({})], { interactive: true });
		expect(target.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
	});
});
