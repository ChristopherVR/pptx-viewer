// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResizeHandles } from './ResizeHandles';

let container: HTMLDivElement;
let elementHost: HTMLDivElement;
let handleHost: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	elementHost = document.createElement('div');
	elementHost.setAttribute('data-element-id', 'shape-1');
	elementHost.getBoundingClientRect = () =>
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
	handleHost = document.createElement('div');
	handleHost.setAttribute('data-pptx-handle-for', 'shape-1');
	document.body.append(elementHost, handleHost, container);
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

		window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
		expect(onRotate).toHaveBeenCalledWith('shape-1', 90);
	});
});
