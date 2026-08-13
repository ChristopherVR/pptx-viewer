// @vitest-environment happy-dom
/**
 * On-canvas action affordances, and who counts as an element.
 *
 * React is the reference the cross-binding parity specs diff against, so both
 * halves of the contract are pinned here:
 *
 *  - the amber "has action" badge and the hover link tooltip are drawn on the
 *    editing canvas and NOWHERE else (a badge painted over a running show would
 *    be editor furniture on the audience's screen, sitting exactly on top of
 *    the shape the presenter is trying to click);
 *  - a group CHILD carries `data-pptx-element="true"` like every other rendered
 *    element. React used to withhold only that attribute from children while
 *    still giving them the id, the role and the accessible name, which is what
 *    made it advertise five fewer elements than the other four bindings on the
 *    same slide.
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	ACTION_INDICATOR_CLASS,
	LINK_TOOLTIP_CLASS,
	LINK_TOOLTIP_HOST_CLASS,
} from 'pptx-viewer-shared';
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
		adjustmentHandles: [],
		onResizePointerDown: vi.fn<() => void>(),
		onAdjustmentPointerDown: vi.fn<() => void>(),
		onInlineEditChange: vi.fn<() => void>(),
		onInlineEditCommit: vi.fn<() => void>(),
		onInlineEditCancel: vi.fn<() => void>(),
		...overrides,
	};
}

function render(props: ElementRendererProps): void {
	act(() => {
		root.render(<ElementRenderer {...props} />);
	});
}

describe('elementRenderer action affordances', () => {
	it('badges an element with a click action and offers its tooltip', () => {
		render(
			makeProps({
				element: shape({ actionClick: { url: 'https://example.test' } }),
				onActionClick: vi.fn<() => void>(),
			}),
		);
		expect(container.querySelector(`.${ACTION_INDICATOR_CLASS}`)).not.toBeNull();
		const tooltip = container.querySelector(`.${LINK_TOOLTIP_CLASS}`);
		expect(tooltip?.textContent).toContain('https://example.test');
		expect(container.querySelector(`.${LINK_TOOLTIP_HOST_CLASS}`)).not.toBeNull();
	});

	it('badges a hover-only action without a tooltip: there is nothing to follow', () => {
		render(makeProps({ element: shape({ actionHover: { tooltip: 'Chime' } }) }));
		expect(container.querySelector(`.${ACTION_INDICATOR_CLASS}`)?.getAttribute('title')).toBe(
			'Chime',
		);
		expect(container.querySelector(`.${LINK_TOOLTIP_CLASS}`)).toBeNull();
	});

	it('draws neither affordance once the canvas is not interactive (a running show)', () => {
		render(
			makeProps({
				canInteract: false,
				element: shape({ actionClick: { url: 'https://example.test' } }),
				onActionClick: vi.fn<() => void>(),
			}),
		);
		expect(container.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
		expect(container.querySelector(`.${LINK_TOOLTIP_CLASS}`)).toBeNull();
	});

	it('draws nothing at all for an element with no action', () => {
		render(makeProps({}));
		expect(container.querySelector(`.${ACTION_INDICATOR_CLASS}`)).toBeNull();
		expect(container.querySelector(`.${LINK_TOOLTIP_CLASS}`)).toBeNull();
	});

	it('injects the shared affordance stylesheet once', () => {
		render(makeProps({ element: shape({ actionClick: { url: 'https://example.test' } }) }));
		render(makeProps({ element: shape({ id: 'sp_2', actionClick: { url: 'https://b.test' } }) }));
		expect(document.querySelectorAll('#pptx-action-affordance-styles')).toHaveLength(1);
	});
});

describe('elementRenderer group-child element contract', () => {
	const group = {
		id: 'grp_1',
		type: 'group',
		x: 0,
		y: 0,
		width: 300,
		height: 200,
		children: [
			shape({ id: 'child_1' }),
			shape({ id: 'child_2', type: 'text', textSegments: [{ text: 'hi' }] }),
		],
	} as unknown as PptxElement;

	it('marks the group AND its children as elements', () => {
		render(makeProps({ element: group }));
		const marked = [...container.querySelectorAll('[data-pptx-element="true"]')].map((node) =>
			node.getAttribute('data-element-id'),
		);
		expect(marked).toContain('grp_1');
		expect(marked).toContain('child_1');
		expect(marked).toContain('child_2');
	});

	it('marks exactly the nodes that expose an element id', () => {
		render(makeProps({ element: group }));
		const withId = container.querySelectorAll('[data-element-id]').length;
		const marked = container.querySelectorAll('[data-pptx-element="true"]').length;
		expect(marked).toBe(withId);
	});
});
