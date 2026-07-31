import type { PptxElement, PptxElementWithText, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { ElementRenderContext } from '../types';
import { renderTextShapeElement } from './text-shape';

/**
 * `a:linkedTxbx` overflow: a text box in a linked chain paints only the slice of
 * the chain's text that the boxes before it could not hold.
 *
 * Vanilla needs no plumbing for this: the slide being painted is already on the
 * render context, so these tests drive the real renderer with the real context
 * shape. The no-slide case is covered too, because several vanilla renderers are
 * legitimately invoked with a partial context (see `group.test.ts`).
 */

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

function context(elements: PptxElement[] | undefined): ElementRenderContext {
	return {
		document,
		mediaDataUrls: new Map(),
		...(elements ? { slide: { id: 's1', elements } as unknown as PptxSlide } : {}),
	} as unknown as ElementRenderContext;
}

function render(element: PptxElement, elements: PptxElement[] | undefined): HTMLElement {
	return renderTextShapeElement(element, 0, context(elements)) as HTMLElement;
}

function body(node: HTMLElement): HTMLElement | null {
	return node.querySelector<HTMLElement>('.pptxv-text');
}

describe('renderTextShapeElement linked text box overflow', () => {
	it('renders only the head box slice in the head box', () => {
		const [head] = chainElements();
		expect(render(head, chainElements()).textContent).toBe('ABC');
	});

	it('flows the overflow into the successor box', () => {
		const [, tail] = chainElements();
		// The tail authors no text of its own; everything it shows comes from the
		// chain. Before this wiring the tail rendered nothing at all.
		expect(render(tail, chainElements()).textContent).toBe('DEFGHIJ');
	});

	it('never paints the same run in two boxes of the chain', () => {
		const [head, tail] = chainElements();
		const painted =
			(render(head, chainElements()).textContent ?? '') +
			(render(tail, chainElements()).textContent ?? '');
		expect(painted).toBe('ABCDEFGHIJ');
	});

	it('clips a chain member so its overflow cannot spill on top of the next box', () => {
		const [head] = chainElements();
		expect(body(render(head, chainElements()))?.style.overflow).toBe('hidden');
	});

	it('leaves an ordinary text box unclipped and untouched', () => {
		const plain = {
			type: 'text',
			id: 'plain',
			x: 0,
			y: 0,
			width: 300,
			height: 200,
			textSegments: [{ text: 'Hello world', style: {} }],
		} as PptxElementWithText as PptxElement;
		const node = render(plain, [plain]);
		expect(node.textContent).toBe('Hello world');
		expect(body(node)?.style.overflow).toBe('visible');
	});

	it('falls back to the authored text when the context carries no slide', () => {
		const [head] = chainElements();
		expect(render(head, undefined).textContent).toBe('ABCDEFGHIJ');
	});
});
