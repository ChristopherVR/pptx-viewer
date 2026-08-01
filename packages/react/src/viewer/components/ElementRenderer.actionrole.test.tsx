// @vitest-environment happy-dom
/**
 * An element you can activate must be announced as a button.
 *
 * React is the reference the cross-binding element-contract spec diffs the
 * other four viewers against, so this pins the behaviour React exports: the
 * rule now lives in `pptx-viewer-shared` (`isElementActionable`), and React
 * must keep feeding it the handler availability it knows about.
 */
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ElementRenderer } from './ElementRenderer';
import type { ElementRendererProps } from './elements/element-renderer-types';

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

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'sp_1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 80,
		shapeType: 'roundRect',
		...overrides,
	} as PptxElement;
}

function makeProps(overrides: Partial<ElementRendererProps>): ElementRendererProps {
	return {
		element: shape(),
		isSelected: false,
		isInlineEditing: false,
		inlineEditingText: '',
		canInteract: true,
		spellCheckEnabled: false,
		mediaDataUrls: new Map(),
		selectionColorClass: 'blue-500',
		showHoverBorder: false,
		imageAltText: 'Slide element',
		showResizeHandles: false,
		renderInk: true,
		renderGroups: true,
		adjustmentHandleDescriptor: null,
		onResizePointerDown: vi.fn<() => void>(),
		onAdjustmentPointerDown: vi.fn<() => void>(),
		onInlineEditChange: vi.fn<() => void>(),
		onInlineEditCommit: vi.fn<() => void>(),
		onInlineEditCancel: vi.fn<() => void>(),
		...overrides,
	};
}

function roleOf(props: ElementRendererProps): string | null {
	act(() => {
		root.render(<ElementRenderer {...props} />);
	});
	return container.querySelector('[data-pptx-element="true"]')?.getAttribute('role') ?? null;
}

describe('elementRenderer actionable role', () => {
	it('announces a shape with a click action as a button', () => {
		const role = roleOf(
			makeProps({
				element: shape({ actionClick: { url: 'https://example.com' } }),
				onActionClick: vi.fn<() => void>(),
			}),
		);
		expect(role).toBe('button');
	});

	it('announces a shape with a text hyperlink as a button', () => {
		const role = roleOf(
			makeProps({
				element: shape({
					text: 'Docs',
					textSegments: [{ text: 'Docs', style: { hyperlink: 'https://example.com' } }],
				}),
				onHyperlinkClick: vi.fn<() => void>(),
			}),
		);
		expect(role).toBe('button');
	});

	it('falls back to the type-derived role when nothing can be activated', () => {
		expect(roleOf(makeProps({}))).toBe('img');
	});

	it('does not claim to be a button when the canvas cannot follow the action', () => {
		const role = roleOf(
			makeProps({ element: shape({ actionClick: { url: 'https://example.com' } }) }),
		);
		expect(role).toBe('img');
	});

	// PowerPoint's "Action: None" keeps an `a:hlinkClick` on the shape (to carry
	// a highlight or a sound) but navigates nowhere, so it is not a control - and
	// in a slide show a click on it must pass through to click-to-advance.
	it('does not announce an "Action: None" shape as a button', () => {
		const role = roleOf(
			makeProps({
				element: shape({ actionClick: { action: 'ppaction://noaction', highlightClick: true } }),
				onActionClick: vi.fn<() => void>(),
			}),
		);
		expect(role).toBe('img');
	});

	// `data-pptx-action` is the neutral marker the show's click classifier keys
	// off, so an action shape never ALSO steps the slide show on.
	it('marks an actionable element so it never also advances the show', () => {
		act(() => {
			root.render(
				<ElementRenderer
					{...makeProps({
						element: shape({ actionClick: { targetSlideIndex: 4 } }),
						onActionClick: vi.fn<() => void>(),
					})}
				/>,
			);
		});
		expect(
			container.querySelector('[data-pptx-element="true"]')?.getAttribute('data-pptx-action'),
		).toBe('click');

		act(() => {
			root.render(<ElementRenderer {...makeProps({})} />);
		});
		expect(
			container.querySelector('[data-pptx-element="true"]')?.hasAttribute('data-pptx-action'),
		).toBeFalsy();
	});
});
