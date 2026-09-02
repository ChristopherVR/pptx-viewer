// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResizeHandles } from './ResizeHandles';

let container: HTMLDivElement;
let elementHost: HTMLDivElement;
let handleHost: HTMLDivElement;
/** A second viewer of the same deck on the page, which must stay untouched. */
let otherElementHost: HTMLDivElement;
let otherHandleHost: HTMLDivElement;
let root: Root;

/**
 * One viewer instance: `[data-pptx-viewport]` wrapping the element node, its
 * handle host and (for the instance under test) the React root the handles
 * render into, mirroring `SlideCanvas`'s layout.
 */
function mountViewport(): {
	viewport: HTMLDivElement;
	elementHost: HTMLDivElement;
	handleHost: HTMLDivElement;
} {
	const viewport = document.createElement('div');
	viewport.setAttribute('data-pptx-viewport', '');
	const element = document.createElement('div');
	element.setAttribute('data-element-id', 'shape-1');
	element.getBoundingClientRect = () =>
		({
			x: 0,
			y: 0,
			left: 0,
			top: 0,
			right: 100,
			bottom: 100,
			width: 100,
			height: 100,
			toJSON: () => ({}),
		}) as DOMRect;
	const handles = document.createElement('div');
	handles.setAttribute('data-pptx-handle-for', 'shape-1');
	viewport.append(element, handles);
	document.body.appendChild(viewport);
	return { viewport, elementHost: element, handleHost: handles };
}

beforeEach(() => {
	// The other instance comes FIRST in the document, so an unscoped
	// `document.querySelector` would land on it rather than on ours.
	const other = mountViewport();
	otherElementHost = other.elementHost;
	otherHandleHost = other.handleHost;
	const mine = mountViewport();
	elementHost = mine.elementHost;
	handleHost = mine.handleHost;
	container = document.createElement('div');
	mine.viewport.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	document.body.replaceChildren();
});

describe('resize handles live rotation', () => {
	it('rotates the element and detached selection handles together', () => {
		const onRotate = vi.fn();
		act(() => {
			root.render(
				<ResizeHandles
					elementId='shape-1'
					adjustmentHandles={[]}
					onResizePointerDown={vi.fn()}
					onAdjustmentPointerDown={vi.fn()}
					onRotate={onRotate}
				/>,
			);
		});

		const rotateButton = container.querySelector<HTMLButtonElement>('[data-pptx-compact]');
		expect(rotateButton).not.toBeNull();
		rotateButton!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		window.dispatchEvent(
			new PointerEvent('pointermove', { clientX: 150, clientY: 50, bubbles: true }),
		);

		expect(elementHost.style.transform).toBe('rotate(90deg)');
		expect(handleHost.style.transform).toBe('rotate(90deg)');
		expect(otherElementHost.style.transform, 'the other viewer must not spin').toBe('');
		expect(otherHandleHost.style.transform).toBe('');

		window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
		expect(onRotate).toHaveBeenCalledWith('shape-1', 90);
	});
});
