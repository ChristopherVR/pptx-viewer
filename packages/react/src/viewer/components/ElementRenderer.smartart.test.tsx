// @vitest-environment happy-dom
import type { PptxElement, SmartArtPptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
/**
 * Regression test for inline (on-canvas) SmartArt node editing wiring.
 *
 * The bug: inline SmartArt editing was implemented in the leaf components but
 * the `onUpdateSmartArtElement` handler (and the `canEditSmartArt` gate) were
 * never passed from {@link ElementRenderer} down to `renderBody`, so double-
 * clicking a node did nothing. These tests render THROUGH ElementRenderer (not
 * the leaf) and assert that editing commits when the handler is provided and is
 * inert when it is not.
 */
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

function makeSmartArtElement(): SmartArtPptxElement {
	return {
		id: 'sa_1',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: {
			resolvedLayoutType: 'list',
			nodes: [
				{ id: 'n1', text: 'Alpha' },
				{ id: 'n2', text: 'Beta' },
			],
		},
	} as SmartArtPptxElement;
}

function makeProps(overrides: Partial<ElementRendererProps>): ElementRendererProps {
	return {
		element: makeSmartArtElement(),
		isSelected: false,
		isInlineEditing: false,
		inlineEditingText: '',
		canInteract: true,
		spellCheckEnabled: false,
		mediaDataUrls: new Map(),
		selectionColorClass: 'blue-500',
		showHoverBorder: true,
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

function mount(props: ElementRendererProps): void {
	act(() => {
		root.render(<ElementRenderer {...props} />);
	});
}

function doubleClickNode(nodeId: string): void {
	const nodeEl = container.querySelector(`[data-smartart-node-id="${nodeId}"]`);
	if (!nodeEl) {
		throw new Error(`node ${nodeId} not rendered`);
	}
	act(() => {
		nodeEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
	});
}

function typeValue(el: HTMLTextAreaElement, text: string): void {
	const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
	act(() => {
		setter?.call(el, text);
		el.dispatchEvent(new Event('input', { bubbles: true }));
	});
}

function pressEnter(el: HTMLElement): void {
	act(() => {
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	});
}

describe('elementRenderer - inline SmartArt editing wiring', () => {
	it('commits a node text edit through onUpdateSmartArtElement when the handler is provided', () => {
		const onUpdateSmartArtElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount(makeProps({ onUpdateSmartArtElement }));

		doubleClickNode('n1');
		const ta = container.querySelector('textarea');
		expect(ta).not.toBeNull();

		typeValue(ta as HTMLTextAreaElement, 'Edited');
		pressEnter(ta as HTMLTextAreaElement);

		expect(onUpdateSmartArtElement).toHaveBeenCalledOnce();
		const [id, updates] = onUpdateSmartArtElement.mock.calls[0];
		expect(id).toBe('sa_1');
		expect(updates).toHaveProperty('smartArtData');
	});

	it('is inert (no editor opens) when no update handler is provided', () => {
		mount(makeProps({ onUpdateSmartArtElement: undefined }));

		doubleClickNode('n1');
		expect(container.querySelector('textarea')).toBeNull();
	});

	it('does not enable editing while the element is presentation-passive', () => {
		const onUpdateSmartArtElement = vi.fn<(id: string, updates: Partial<PptxElement>) => void>();
		mount(makeProps({ canInteract: false, onUpdateSmartArtElement }));

		doubleClickNode('n1');
		expect(container.querySelector('textarea')).toBeNull();
	});
});
