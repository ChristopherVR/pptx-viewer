// @vitest-environment happy-dom
import type { PptxElement, PptxElementWithText, PptxSlide, TextSegment } from 'pptx-viewer-core';
import React, { act } from 'react';
/**
 * `a:linkedTxbx` overflow rendered THROUGH `ElementRenderer`.
 *
 * React was the only binding that shipped this, and it did so by calling
 * `pptx-viewer-core` directly from `TextElementBody`. That call now goes through
 * `pptx-viewer-shared` so all five bindings distribute a chain identically, and
 * React's output must be byte-for-byte what it was: these tests pin the visible
 * result (which slice each box paints, and the clip that stops the successor's
 * text being drawn twice) rather than the call it makes, so the refactor is only
 * green if nothing on screen moved.
 */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ElementRenderer } from './ElementRenderer';

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

function renderBox(element: PptxElement, elements: PptxElement[] | undefined): HTMLElement {
	act(() => {
		root.render(
			<ElementRenderer
				element={element}
				zIndex={0}
				mediaDataUrls={new Map<string, string>()}
				activeSlide={elements ? ({ id: 's1', elements } as unknown as PptxSlide) : undefined}
			/>,
		);
	});
	return container;
}

describe('elementRenderer - linked text box overflow', () => {
	it('renders only the head box slice in the head box', () => {
		const [head] = chainElements();
		expect(renderBox(head, chainElements()).textContent).toBe('ABC');
	});

	it('flows the overflow into the successor box', () => {
		const [, tail] = chainElements();
		expect(renderBox(tail, chainElements()).textContent).toBe('DEFGHIJ');
	});

	it('never paints the same run in two boxes of the chain', () => {
		const [head] = chainElements();
		const headText = renderBox(head, chainElements()).textContent ?? '';
		const [, tail] = chainElements();
		const tailText = renderBox(tail, chainElements()).textContent ?? '';
		expect(headText + tailText).toBe('ABCDEFGHIJ');
	});

	it('clips a chain member so its overflow cannot spill on top of the next box', () => {
		const [head] = chainElements();
		const body = renderBox(head, chainElements()).querySelector<HTMLElement>(
			'[data-element-id="head"] div',
		);
		expect(body?.style.overflow).toBe('hidden');
	});

	it('falls back to the authored text when no slide is supplied', () => {
		const [head] = chainElements();
		expect(renderBox(head, undefined).textContent).toBe('ABCDEFGHIJ');
	});
});
