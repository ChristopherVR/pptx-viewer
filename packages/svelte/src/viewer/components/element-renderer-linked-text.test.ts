import type { PptxElement, PptxElementWithText, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';
import SlideStage from './SlideStage.svelte';

/**
 * `a:linkedTxbx` overflow: a text box in a linked chain paints only the slice of
 * the chain's text that the boxes before it could not hold.
 *
 * These mount through `SlideStage`, not `ElementRenderer` alone, because the
 * sibling list a chain resolves against is published as stage context. Mounting
 * the renderer bare is therefore also a test: it pins the documented fallback (a
 * box with no context keeps its own authored text) rather than crashing.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/**
 * A box small enough that the core capacity estimate resolves to exactly 3
 * characters: 60x30px minus the default 7px insets leaves 46x16px, and an 18pt
 * (24px) font fits floor(46 / (24 * 0.6)) = 3 chars on the one line available.
 */
function linkedBox(id: string, seq: number, segments?: TextSegment[]): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 60,
		height: 30,
		textStyle: { fontSize: 18 },
		linkedTxbxId: 7,
		linkedTxbxSeq: seq,
		...(segments ? { textSegments: segments } : {}),
	} as PptxElementWithText as PptxElement;
}

function mountStage(elements: PptxElement[]): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SlideStage, {
		target,
		props: {
			slide: { id: 's1', elements } as unknown as PptxSlide,
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map<string, string>(),
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

/** Head holds the chain's whole text; the tail is authored empty, as PowerPoint writes it. */
function chainElements(): PptxElement[] {
	return [linkedBox('head', 0, [{ text: 'ABCDEFGHIJ', style: {} }]), linkedBox('tail', 1)];
}

/** Svelte's markup indentation lands in `textContent`; only the runs matter here. */
function boxText(target: HTMLElement, id: string): string {
	return (target.querySelector(`[data-element-id="${id}"]`)?.textContent ?? '').trim();
}

function bodyStyle(target: HTMLElement, id: string): string {
	return (
		target.querySelector(`[data-element-id="${id}"] .pptx-svelte-text`)?.getAttribute('style') ?? ''
	);
}

describe('elementRenderer - linked text box overflow', () => {
	it('renders only the head box slice in the head box', () => {
		expect(boxText(mountStage(chainElements()), 'head')).toBe('ABC');
	});

	it('flows the overflow into the successor box', () => {
		// The tail authors no text of its own; everything it shows comes from the
		// chain. Before this wiring the tail rendered nothing at all.
		expect(boxText(mountStage(chainElements()), 'tail')).toBe('DEFGHIJ');
	});

	it('never paints the same run in two boxes of the chain', () => {
		const target = mountStage(chainElements());
		expect(boxText(target, 'head') + boxText(target, 'tail')).toBe('ABCDEFGHIJ');
	});

	it('clips a chain member so its overflow cannot spill on top of the next box', () => {
		expect(bodyStyle(mountStage(chainElements()), 'head')).toContain('overflow: hidden');
	});

	it('leaves an ordinary text box unclipped and untouched', () => {
		const target = mountStage([
			{
				type: 'text',
				id: 'plain',
				x: 0,
				y: 0,
				width: 300,
				height: 200,
				textSegments: [{ text: 'Hello world', style: {} }],
			} as PptxElementWithText as PptxElement,
		]);
		expect(boxText(target, 'plain')).toBe('Hello world');
		expect(bodyStyle(target, 'plain')).toContain('overflow: visible');
	});

	it('falls back to the authored text when no stage publishes a sibling list', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(ElementRenderer, {
			target,
			props: {
				element: linkedBox('head', 0, [{ text: 'ABCDEFGHIJ', style: {} }]),
				mediaDataUrls: new Map<string, string>(),
				zIndex: 0,
			},
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		expect(target.textContent?.trim()).toBe('ABCDEFGHIJ');
	});
});
