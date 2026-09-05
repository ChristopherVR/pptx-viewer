// @vitest-environment jsdom
import type { TextStyle } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import {
	measureNormAutofitStepHeightPx,
	resolveInlineEditNormAutofitShrink,
} from './text-autofit-shrink-measure';

describe('measureNormAutofitStepHeightPx', () => {
	it('measures via an off-screen clone and leaves the live node untouched', () => {
		const el = document.createElement('div');
		el.style.fontSize = '20px';
		el.style.width = '100px';
		el.setAttribute('contenteditable', 'true');
		document.body.appendChild(el);
		try {
			Object.defineProperty(el, 'scrollHeight', { value: 40, configurable: true });
			const height = measureNormAutofitStepHeightPx(
				el,
				100,
				{ fontScale: 1, lnSpcReduction: 0 },
				{ fontScale: 0.92, lnSpcReduction: 0 },
			);
			expect(height).toBeTypeOf('number');
			// The live node is untouched: still in the document, still one child.
			expect(document.body.contains(el)).toBeTruthy();
			expect(document.body.children).toHaveLength(1);
			expect(el.style.fontSize).toBe('20px');
		} finally {
			document.body.removeChild(el);
		}
	});

	it('copies a live textarea .value onto the clone (cloneNode only copies the default value)', () => {
		const el = document.createElement('textarea');
		el.value = 'seeded';
		el.value = 'typed content, longer than the seed';
		document.body.appendChild(el);
		let capturedClone: HTMLTextAreaElement | undefined;
		const originalAppend = document.body.appendChild.bind(document.body);
		document.body.appendChild = ((node: Node) => {
			capturedClone = node as HTMLTextAreaElement;
			return originalAppend(node);
		}) as typeof document.body.appendChild;
		try {
			measureNormAutofitStepHeightPx(
				el,
				200,
				{ fontScale: 1, lnSpcReduction: 0 },
				{ fontScale: 0.5, lnSpcReduction: 0.2 },
			);
			expect(capturedClone?.value).toBe('typed content, longer than the seed');
		} finally {
			document.body.appendChild = originalAppend;
			document.body.removeChild(el);
		}
	});

	it('returns 0 outside a DOM environment (no ownerDocument)', () => {
		const el = { ownerDocument: undefined } as unknown as HTMLElement;
		const height = measureNormAutofitStepHeightPx(
			el,
			100,
			{ fontScale: 1, lnSpcReduction: 0 },
			{ fontScale: 0.5, lnSpcReduction: 0 },
		);
		expect(height).toBe(0);
	});
});

describe('resolveInlineEditNormAutofitShrink', () => {
	let originalDescriptor: PropertyDescriptor | undefined;

	function stubScrollHeight(value: number): void {
		originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
		Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
			configurable: true,
			get: () => value,
		});
	}

	afterEach(() => {
		if (originalDescriptor) {
			Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalDescriptor);
			originalDescriptor = undefined;
		}
	});

	it('returns unchanged without measuring when there is no editor DOM node', () => {
		const result = resolveInlineEditNormAutofitShrink(
			{ autoFitMode: 'normal' } as TextStyle,
			100,
			null,
		);
		expect(result).toBe('unchanged');
	});

	it('never shrinks for spAutoFit (shape-resize mode)', () => {
		stubScrollHeight(400);
		const el = document.createElement('div');
		const result = resolveInlineEditNormAutofitShrink(
			{ autoFitMode: 'shrink' } as TextStyle,
			100,
			el,
		);
		expect(result).toBe('unchanged');
	});

	it('returns unchanged when the stubbed measurement already fits the box at every step', () => {
		stubScrollHeight(10);
		const el = document.createElement('div');
		const result = resolveInlineEditNormAutofitShrink(
			{ autoFitMode: 'normal' } as TextStyle,
			100,
			el,
		);
		expect(result).toBe('unchanged');
	});
});
