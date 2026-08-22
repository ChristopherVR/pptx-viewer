// @vitest-environment jsdom
import type { TextStyle } from 'pptx-viewer-core';
import { describe, it, expect, afterEach } from 'vitest';

import {
	computeAutoFitShapeHeightPx,
	measureAutoFitContentHeightPx,
	resolveInlineEditAutoFitHeight,
	AUTOFIT_MIN_SHAPE_HEIGHT_PX,
} from './shape-autofit-resize';

describe('computeAutoFitShapeHeightPx', () => {
	it('returns undefined for normAutofit (font-shrink mode)', () => {
		expect(
			computeAutoFitShapeHeightPx({
				autoFitMode: 'normal',
				measuredContentHeightPx: 400,
				currentHeightPx: 100,
			}),
		).toBeUndefined();
	});

	it('returns undefined when autofit is off (noAutofit / undefined)', () => {
		expect(
			computeAutoFitShapeHeightPx({
				autoFitMode: 'none',
				measuredContentHeightPx: 400,
				currentHeightPx: 100,
			}),
		).toBeUndefined();
		expect(
			computeAutoFitShapeHeightPx({
				autoFitMode: undefined,
				measuredContentHeightPx: 400,
				currentHeightPx: 100,
			}),
		).toBeUndefined();
	});

	it('grows the shape when the measured content is taller than the box', () => {
		const result = computeAutoFitShapeHeightPx({
			autoFitMode: 'shrink',
			measuredContentHeightPx: 250,
			currentHeightPx: 100,
		});
		expect(result).toBe(250);
	});

	it('shrinks the shape when the measured content is shorter than the box', () => {
		const result = computeAutoFitShapeHeightPx({
			autoFitMode: 'shrink',
			measuredContentHeightPx: 40,
			currentHeightPx: 200,
		});
		expect(result).toBe(40);
	});

	it('never shrinks below the shared minimum element size', () => {
		const result = computeAutoFitShapeHeightPx({
			autoFitMode: 'shrink',
			measuredContentHeightPx: 2,
			currentHeightPx: 200,
		});
		expect(result).toBe(AUTOFIT_MIN_SHAPE_HEIGHT_PX);
	});

	it('ignores a zero or negative measurement (no usable DOM read)', () => {
		expect(
			computeAutoFitShapeHeightPx({
				autoFitMode: 'shrink',
				measuredContentHeightPx: 0,
				currentHeightPx: 100,
			}),
		).toBeUndefined();
		expect(
			computeAutoFitShapeHeightPx({
				autoFitMode: 'shrink',
				measuredContentHeightPx: -5,
				currentHeightPx: 100,
			}),
		).toBeUndefined();
	});

	it('ignores a sub-pixel difference that would not meaningfully change the shape', () => {
		const result = computeAutoFitShapeHeightPx({
			autoFitMode: 'shrink',
			measuredContentHeightPx: 100.4,
			currentHeightPx: 100,
		});
		expect(result).toBeUndefined();
	});

	it('rounds the measured height to the nearest px', () => {
		const result = computeAutoFitShapeHeightPx({
			autoFitMode: 'shrink',
			measuredContentHeightPx: 123.6,
			currentHeightPx: 100,
		});
		expect(result).toBe(124);
	});
});

describe('measureAutoFitContentHeightPx', () => {
	it('measures a taller-than-box content height via an off-screen height:auto clone', () => {
		const el = document.createElement('div');
		el.style.height = '20px';
		el.style.width = '100px';
		el.style.overflow = 'hidden';
		el.setAttribute('contenteditable', 'true');
		document.body.appendChild(el);
		try {
			// jsdom does not compute real layout, but scrollHeight is settable on
			// the underlying element and cloneNode carries inline styles/content,
			// so this exercises the clone-append-measure-remove lifecycle without
			// mutating (or leaving behind) the live node.
			Object.defineProperty(el, 'scrollHeight', { value: 20, configurable: true });
			const height = measureAutoFitContentHeightPx(el, 100);
			expect(height).toBeTypeOf('number');
			// The clone is appended/removed from the document, not the live node.
			expect(document.body.contains(el)).toBeTruthy();
			expect(document.body.children).toHaveLength(1);
		} finally {
			document.body.removeChild(el);
		}
	});

	it('removes contenteditable from the clone so it never becomes independently focusable/editable', () => {
		const el = document.createElement('div');
		el.setAttribute('contenteditable', 'true');
		document.body.appendChild(el);
		let capturedClone: HTMLElement | undefined;
		const originalAppend = document.body.appendChild.bind(document.body);
		document.body.appendChild = ((node: Node) => {
			capturedClone = node as HTMLElement;
			return originalAppend(node);
		}) as typeof document.body.appendChild;
		try {
			measureAutoFitContentHeightPx(el, 50);
			expect(capturedClone?.hasAttribute('contenteditable')).toBeFalsy();
		} finally {
			document.body.appendChild = originalAppend;
			document.body.removeChild(el);
		}
	});

	it('copies a textarea live .value onto the clone (cloneNode only copies the default value)', () => {
		// Angular's inline editor is a plain <textarea>. cloneNode() on a
		// textarea reproduces its default value (the original `value`
		// attribute / text content), never the live `.value` the user has
		// typed into since - if that were measured as-is, autofit would always
		// see the text the box was SEEDED with, one edit behind.
		const el = document.createElement('textarea');
		el.value = 'seeded text';
		el.value = 'text the user just typed, longer than the seed';
		document.body.appendChild(el);
		let capturedClone: HTMLTextAreaElement | undefined;
		const originalAppend = document.body.appendChild.bind(document.body);
		document.body.appendChild = ((node: Node) => {
			capturedClone = node as HTMLTextAreaElement;
			return originalAppend(node);
		}) as typeof document.body.appendChild;
		try {
			measureAutoFitContentHeightPx(el, 200);
			expect(capturedClone?.value).toBe('text the user just typed, longer than the seed');
		} finally {
			document.body.appendChild = originalAppend;
			document.body.removeChild(el);
		}
	});
});

describe('resolveInlineEditAutoFitHeight', () => {
	// `scrollHeight` set via `Object.defineProperty` on an instance does not
	// survive `cloneNode` (see `measureAutoFitContentHeightPx`'s own test
	// above), so a per-element stub cannot drive this composed function's
	// clone-then-measure path. Stubbing the PROTOTYPE getter instead applies to
	// both the live node and its clone (they share the prototype chain),
	// exercising the real measure-then-decide path end to end rather than
	// mocking either half away.
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

	it('returns undefined without measuring when there is no editor DOM node', () => {
		const result = resolveInlineEditAutoFitHeight(
			{ autoFitMode: 'shrink' } as TextStyle,
			100,
			null,
		);
		expect(result).toBeUndefined();
	});

	it('grows the shape to the measured content height for spAutoFit', () => {
		stubScrollHeight(250);
		const el = document.createElement('div');
		const result = resolveInlineEditAutoFitHeight({ autoFitMode: 'shrink' } as TextStyle, 100, el);
		expect(result).toBe(250);
	});

	it('never resizes for normAutofit (font-shrink mode)', () => {
		stubScrollHeight(400);
		const el = document.createElement('div');
		const result = resolveInlineEditAutoFitHeight({ autoFitMode: 'normal' } as TextStyle, 100, el);
		expect(result).toBeUndefined();
	});

	it('leaves the shape alone when the measured height has not meaningfully changed', () => {
		stubScrollHeight(100);
		const el = document.createElement('div');
		const result = resolveInlineEditAutoFitHeight({ autoFitMode: 'shrink' } as TextStyle, 100, el);
		expect(result).toBeUndefined();
	});
});
