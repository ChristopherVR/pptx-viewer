// @vitest-environment happy-dom
/**
 * React's handles must agree with the table the other four bindings read.
 *
 * React cannot import `RESIZE_HANDLE_GEOMETRY` into its markup the way Vue,
 * Svelte, Vanilla and Angular now do: it styles handles with Tailwind classes,
 * and Tailwind extracts class names statically, so a `cursor-${geometry.cursor}`
 * template is purged at build time and the handle ends up showing the default
 * arrow. The literals stay, and this spec is what stops them drifting from the
 * shared contract, which is the failure the extraction was meant to prevent
 * (a cursor pointing along the wrong diagonal looks fine in a screenshot and
 * wrong under the hand).
 */
import {
	attachRotateHandlePlacement,
	RESIZE_HANDLE_GEOMETRY,
	RESIZE_HANDLES,
} from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ignoreExportOverlayElements } from '../../utils/export-helpers';
import { CORNER_HANDLES, EDGE_HANDLES, ResizeHandles } from './ResizeHandles';

vi.mock(import('pptx-viewer-shared'), async (original) => ({
	...(await original()),
	attachRotateHandlePlacement: vi.fn(() => vi.fn()),
}));

vi.mock(import('react-i18next'), () => ({
	useTranslation: vi.fn().mockReturnValue({ t: (key: string) => key }),
}));

const ALL = [...CORNER_HANDLES, ...EDGE_HANDLES];

describe('resize handles', () => {
	it('attaches placement to the mounted Rotate button and cleans up when it disappears', async () => {
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);
		const cleanup = vi.fn();
		vi.mocked(attachRotateHandlePlacement).mockReturnValue(cleanup);
		const props = {
			elementId: 'one',
			adjustmentHandles: [],
			onResizePointerDown: vi.fn(),
			onAdjustmentPointerDown: vi.fn(),
			onRotate: vi.fn(),
		};
		await act(() => root.render(<ResizeHandles {...props} />));
		expect(attachRotateHandlePlacement).toHaveBeenLastCalledWith(
			container.querySelector('[data-pptx-handle-kind="rotate"]'),
			{ stem: container.querySelector('[data-pptx-rotate-stem]') },
		);
		await act(() => root.render(<ResizeHandles {...props} onRotate={undefined} />));
		expect(cleanup).toHaveBeenCalledOnce();
		await act(() => root.unmount());
		expect(cleanup).toHaveBeenCalledOnce();
		container.remove();
	});

	it('inverse-scales resize, rotation and adjustment controls about their anchors', () => {
		const container = document.createElement('div');
		container.innerHTML = renderToStaticMarkup(
			<ResizeHandles
				elementId='shape-1'
				adjustmentHandles={[{ key: 'adj', left: 20, top: 10, value: 10000, cursor: 'ew-resize' }]}
				onResizePointerDown={vi.fn()}
				onAdjustmentPointerDown={vi.fn()}
				onRotate={vi.fn()}
			/>,
		);
		const buttons = [...container.querySelectorAll('button')];
		expect(buttons).toHaveLength(10);
		for (const button of buttons) {
			expect(button.style.scale).toBe('var(--pptx-handle-inverse-scale, 1)');
			expect(ignoreExportOverlayElements(button)).toBeTruthy();
		}
		// The handle-only marker must not hide the parent connector or shape.
		expect(ignoreExportOverlayElements(container)).toBeFalsy();
	});

	it('keeps the theme button-size floor off handles with their own expanded hit areas', () => {
		const container = document.createElement('div');
		container.innerHTML = renderToStaticMarkup(
			<ResizeHandles
				elementId='shape-1'
				adjustmentHandles={[]}
				onResizePointerDown={vi.fn()}
				onAdjustmentPointerDown={vi.fn()}
			/>,
		);
		const buttons = [...container.querySelectorAll('button')];
		expect(buttons).toHaveLength(8);
		for (const button of buttons) {
			expect(button.hasAttribute('data-pptx-compact')).toBeTruthy();
			expect(button.style.touchAction).toBe('none');
			expect(button.lastElementChild?.className).toContain('-inset-');
		}
	});

	it('renders every handle the shared contract defines, exactly once', () => {
		expect(ALL.map((entry) => entry.handle).sort()).toStrictEqual([...RESIZE_HANDLES].sort());
	});

	it('lets bounded hit areas own resize presses without making the buttons unfocusable', () => {
		const container = document.createElement('div');
		container.innerHTML = renderToStaticMarkup(
			<ResizeHandles
				elementId='shape-1'
				adjustmentHandles={[]}
				onResizePointerDown={vi.fn()}
				onAdjustmentPointerDown={vi.fn()}
				forcePointerEvents
			/>,
		);
		for (const [index, button] of [...container.querySelectorAll('button')].entries()) {
			const { fx, fy } = RESIZE_HANDLE_GEOMETRY[ALL[index].handle];
			const hitArea = button.lastElementChild as HTMLElement;
			expect(button.style.pointerEvents).toBe('none');
			expect(button.tabIndex).toBe(0);
			expect(hitArea.className).toContain('pointer-events-auto');
			for (const [side, limited] of [
				['left', fx > 0],
				['right', fx < 1],
				['top', fy > 0],
				['bottom', fy < 1],
			] as const) {
				// happy-dom does not retain this valid CSS math in CSSStyleDeclaration.
				expect(hitArea.getAttribute('style')?.includes(`${side}:max(`)).toBe(limited);
			}
		}
	});

	it.each(ALL)('gives $handle the shared cursor', ({ handle, cursor }) => {
		expect(cursor).toBe(`cursor-${RESIZE_HANDLE_GEOMETRY[handle].cursor}`);
	});

	it.each(ALL)('anchors $handle to the side its compass name names', ({ handle, posClass }) => {
		const { fx, fy } = RESIZE_HANDLE_GEOMETRY[handle];
		// Corners pin to a named edge pair; edge midpoints pin one axis and centre
		// the other, which Tailwind spells `left-1/2` / `top-1/2`.
		if (fx === 0) {
			expect(posClass).toMatch(/(^|\s|-)left-/u);
		} else if (fx === 1) {
			expect(posClass).toMatch(/(^|\s|-)right-/u);
		} else {
			expect(posClass).toContain('left-1/2');
		}

		if (fy === 0) {
			expect(posClass).toMatch(/(^|\s|-)top-/u);
		} else if (fy === 1) {
			expect(posClass).toMatch(/(^|\s|-)bottom-/u);
		} else {
			expect(posClass).toContain('top-1/2');
		}
	});
});
