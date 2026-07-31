import { mount } from '@vue/test-utils';
import type { PptxElement, PptxElementWithText, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import ElementRenderer from './ElementRenderer.vue';
import SlideStage from './SlideStage.vue';

/**
 * `a:linkedTxbx` overflow: a text box in a linked chain paints only the slice of
 * the chain's text that the boxes before it could not hold.
 *
 * These mount through `SlideStage`, not `ElementRenderer` alone, because the
 * sibling list a chain resolves against is published by the stage. Mounting the
 * renderer bare is therefore also a test: it pins the documented fallback (a box
 * with no sibling list keeps its own authored text) rather than crashing.
 */

const canvasSize: CanvasSize = { width: 960, height: 540 };

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

/** Head holds the chain's whole text; the tail is authored empty, as PowerPoint writes it. */
function chainElements(): PptxElement[] {
	return [linkedBox('head', 0, [{ text: 'ABCDEFGHIJ', style: {} }]), linkedBox('tail', 1)];
}

function mountChain() {
	return mount(SlideStage, {
		props: {
			slide: { id: 's1', elements: chainElements() } as unknown as PptxSlide,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			// A static stage has its `data-element-id` markers stripped post-render,
			// so the interactive canvas is the surface these assertions can address.
			interactive: true,
		},
	});
}

function boxText(wrapper: ReturnType<typeof mountChain>, id: string): string {
	return wrapper.find(`[data-element-id="${id}"]`).text();
}

describe('elementRenderer - linked text box overflow', () => {
	it('renders only the head box slice in the head box', () => {
		const wrapper = mountChain();
		expect(boxText(wrapper, 'head')).toBe('ABC');
	});

	it('flows the overflow into the successor box', () => {
		const wrapper = mountChain();
		// The tail authors no text of its own; everything it shows comes from the
		// chain. Before this wiring the tail rendered nothing at all.
		expect(boxText(wrapper, 'tail')).toBe('DEFGHIJ');
	});

	it('never paints the same run in two boxes of the chain', () => {
		const wrapper = mountChain();
		expect(boxText(wrapper, 'head') + boxText(wrapper, 'tail')).toBe('ABCDEFGHIJ');
	});

	it('clips a chain member so its overflow cannot spill on top of the next box', () => {
		const wrapper = mountChain();
		const body = wrapper.find('[data-element-id="head"] .pptx-vue-text');
		expect(body.attributes('style')).toContain('overflow: hidden');
	});

	it('leaves an ordinary text box unclipped and untouched', () => {
		const wrapper = mount(SlideStage, {
			props: {
				slide: {
					id: 's1',
					elements: [
						{
							type: 'text',
							id: 'plain',
							x: 0,
							y: 0,
							width: 300,
							height: 200,
							textSegments: [{ text: 'Hello world', style: {} }],
						} as PptxElementWithText as PptxElement,
					],
				} as unknown as PptxSlide,
				canvasSize,
				mediaDataUrls: new Map<string, string>(),
				interactive: true,
			},
		});
		expect(wrapper.find('[data-element-id="plain"]').text()).toBe('Hello world');
		expect(wrapper.find('[data-element-id="plain"] .pptx-vue-text').attributes('style')).toContain(
			'overflow: visible',
		);
	});

	it('falls back to the authored text when no stage publishes a sibling list', () => {
		const wrapper = mount(ElementRenderer, {
			props: {
				element: linkedBox('head', 0, [{ text: 'ABCDEFGHIJ', style: {} }]),
				mediaDataUrls: new Map<string, string>(),
				zIndex: 0,
			},
		});
		expect(wrapper.text()).toBe('ABCDEFGHIJ');
	});
});
