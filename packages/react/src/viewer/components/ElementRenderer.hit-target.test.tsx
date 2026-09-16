// @vitest-environment happy-dom
/**
 * Issue #285: the element wrapper used to clamp width/height to
 * `MIN_ELEMENT_SIZE` (12px), so a degenerate shape (a 1-pt horizontal rule
 * authored ~1.25px tall) painted as a solid bar instead of a hairline once its
 * fill rode on the wrapper's own `background-color`.
 *
 * The painted box must now stay at the element's authored size always, and
 * grabbability for a degenerate shape is a separate, interaction-only
 * `[data-pptx-hit-target]` overlay rendered only while `canInteract` is true
 * and the element is not on the presentation stage.
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

/** A 1-pt horizontal rule: solid-filled rect, ~1.25px authored height. */
function thinRule(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'rule-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 400,
		height: 1.25,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#000000', fillMode: 'solid' },
		...overrides,
	} as PptxElement;
}

function makeProps(
	element: PptxElement,
	overrides: Partial<ElementRendererProps> = {},
): ElementRendererProps {
	return {
		element,
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

function renderEl(props: ElementRendererProps): HTMLElement | null {
	act(() => {
		root.render(<ElementRenderer {...props} />);
	});
	return container.querySelector<HTMLElement>('[data-pptx-element="true"]');
}

describe('elementRenderer degenerate shape (issue #285)', () => {
	it('paints the wrapper at the authored height, never padded to a solid bar', () => {
		const wrapper = renderEl(makeProps(thinRule(), { canInteract: false }));
		expect(wrapper?.style.height).toBe('1.25px');
	});

	it('adds an invisible, bigger hit target only when interactive', () => {
		const wrapper = renderEl(makeProps(thinRule(), { canInteract: true, presenting: false }));
		const hitTarget = wrapper?.querySelector<HTMLElement>('[data-pptx-hit-target]');
		expect(hitTarget).toBeTruthy();
		expect(hitTarget?.style.height).toBe('12px');
		expect(hitTarget?.style.pointerEvents).toBe('auto');
		// The wrapper's own painted box stays at the authored (unpadded) size.
		expect(wrapper?.style.height).toBe('1.25px');
	});

	it('never adds the hit target on a read-only (non-interactive) render', () => {
		const wrapper = renderEl(makeProps(thinRule(), { canInteract: false }));
		expect(wrapper?.querySelector('[data-pptx-hit-target]')).toBeNull();
	});

	it('never adds the hit target while presenting', () => {
		const wrapper = renderEl(makeProps(thinRule(), { canInteract: true, presenting: true }));
		expect(wrapper?.querySelector('[data-pptx-hit-target]')).toBeNull();
	});

	it('adds no hit target for a normally sized shape', () => {
		const wrapper = renderEl(
			makeProps(thinRule({ width: 200, height: 100 }), { canInteract: true }),
		);
		expect(wrapper?.querySelector('[data-pptx-hit-target]')).toBeNull();
	});
});
