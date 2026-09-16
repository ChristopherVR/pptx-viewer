// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncSelectionHandleOverlay } from '../../utils/selection-handle-overlay';
import { ResizeHandles } from './ResizeHandles';

vi.mock(import('react-i18next'), () => ({
	useTranslation: vi.fn().mockReturnValue({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let elementHost: HTMLDivElement;
let handleHost: HTMLDivElement;
/** A second viewer of the same deck on the page, which must stay untouched. */
let otherElementHost: HTMLDivElement;
let otherHandleHost: HTMLDivElement;
let root: Root;

/** Include compatibility mousedown, whose coordinates lose subpixel precision. */
function pressRotate(
	button: HTMLButtonElement,
	clientX: number,
	clientY: number,
	pointerType = 'mouse',
): void {
	button.dispatchEvent(
		new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType, clientX, clientY }),
	);
	if (pointerType === 'mouse') {
		button.dispatchEvent(
			new MouseEvent('mousedown', {
				bubbles: true,
				clientX: Math.floor(clientX),
				clientY: Math.floor(clientY),
			}),
		);
	}
}

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
	it('updates nested connector hit bounds without a detached overlay', () => {
		handleHost.remove();
		syncSelectionHandleOverlay(elementHost, 'shape-1', { width: 320, height: 24 });
		expect(elementHost.style.getPropertyValue('--pptx-selection-width')).toBe('320px');
		expect(elementHost.style.getPropertyValue('--pptx-selection-height')).toBe('24px');
		expect(otherElementHost.style.getPropertyValue('--pptx-selection-width')).toBe('');
	});

	it('retains touch capture and mouse dispatch through the hit area', () => {
		const onResize = vi.fn();
		act(() =>
			root.render(
				<ResizeHandles
					elementId='shape-1'
					adjustmentHandles={[]}
					onResizePointerDown={onResize}
					onAdjustmentPointerDown={vi.fn()}
					forcePointerEvents
				/>,
			),
		);
		const button = container.querySelector<HTMLButtonElement>('button')!;
		const hitArea = button.lastElementChild!;
		const capture = vi.spyOn(button, 'setPointerCapture').mockImplementation(() => {});
		hitArea.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 7 }),
		);
		expect(capture).toHaveBeenCalledWith(7);
		expect(onResize).toHaveBeenLastCalledWith('shape-1', expect.anything(), 'nw');
		onResize.mockClear();
		hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
		expect(onResize).not.toHaveBeenCalled();
		hitArea.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		expect(onResize).toHaveBeenCalledOnce();
		expect(onResize).toHaveBeenLastCalledWith('shape-1', expect.anything(), 'nw');
	});

	it('keeps relative Shift snapping and releases it during the same drag', () => {
		const onRotate = vi.fn();
		act(() =>
			root.render(
				<ResizeHandles
					elementId='shape-1'
					adjustmentHandles={[]}
					onResizePointerDown={vi.fn()}
					onAdjustmentPointerDown={vi.fn()}
					rotation={43}
					onRotate={onRotate}
				/>,
			),
		);
		const button = container.querySelector<HTMLButtonElement>(
			'[aria-label="pptx.selectionOverlay.rotate"]',
		)!;
		pressRotate(button, 60, 0);
		window.dispatchEvent(
			new PointerEvent('pointermove', { clientX: 100, clientY: 0, shiftKey: true }),
		);
		expect(elementHost.style.transform).toBe('rotate(75deg)');
		window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 0 }));
		expect(elementHost.style.transform).toBe('rotate(77deg)');
		window.dispatchEvent(new PointerEvent('pointerup'));
		expect(onRotate).toHaveBeenCalledExactlyOnceWith('shape-1', 77);
	});

	it.each([false, true])(
		'does not commit an unchanged off-center grab (radial movement: %s)',
		(move) => {
			const onRotate = vi.fn();
			act(() =>
				root.render(
					<ResizeHandles
						elementId='shape-1'
						adjustmentHandles={[]}
						onResizePointerDown={vi.fn()}
						onAdjustmentPointerDown={vi.fn()}
						rotation={43}
						onRotate={onRotate}
					/>,
				),
			);
			const button = container.querySelector<HTMLButtonElement>(
				'[aria-label="pptx.selectionOverlay.rotate"]',
			)!;
			pressRotate(button, 60, 0);
			if (move) {
				window.dispatchEvent(new PointerEvent('pointermove', { clientX: 70, clientY: -50 }));
				expect(elementHost.style.transform).toBe('rotate(43deg)');
			}
			window.dispatchEvent(new PointerEvent('pointerup'));
			expect(onRotate).not.toHaveBeenCalled();
		},
	);

	it.each(['mouse', 'touch', 'pen'])(
		'anchors an off-center %s grab without losing flips',
		(pointerType) => {
			const onRotate = vi.fn();
			act(() =>
				root.render(
					<ResizeHandles
						elementId='shape-1'
						adjustmentHandles={[]}
						onResizePointerDown={vi.fn()}
						onAdjustmentPointerDown={vi.fn()}
						rotation={43}
						nonRotationTransform='scaleX(-1)'
						onRotate={onRotate}
					/>,
				),
			);
			const button = container.querySelector<HTMLButtonElement>(
				'[aria-label="pptx.selectionOverlay.rotate"]',
			)!;
			pressRotate(button, 60.75, 0.25, pointerType);
			window.dispatchEvent(
				new PointerEvent('pointermove', { clientX: 100, clientY: 0, pointerId: 1 }),
			);
			expect(elementHost.style.transform).toBe('rotate(76deg) scaleX(-1)');
			expect(handleHost.style.transform).toBe('rotate(76deg) scaleX(-1)');
			expect(otherElementHost.style.transform).toBe('');
			window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
			expect(onRotate).toHaveBeenCalledExactlyOnceWith('shape-1', 76);
		},
	);

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

		const rotateButton = container.querySelector<HTMLButtonElement>(
			'[aria-label="pptx.selectionOverlay.rotate"]',
		);
		expect(rotateButton).not.toBeNull();
		pressRotate(rotateButton!, 50, 0);
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
