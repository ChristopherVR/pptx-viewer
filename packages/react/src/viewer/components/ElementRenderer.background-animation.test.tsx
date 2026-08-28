/** @vitest-environment happy-dom */
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
	act(() => root.unmount());
	container.remove();
});

function shape(): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 200,
		height: 80,
		shapeType: 'rect',
		fillColor: '#ff0000',
		text: 'Text remains visible',
		textSegments: [{ text: 'Text remains visible' }],
	} as PptxElement;
}

function props(): ElementRendererProps {
	return {
		element: shape(),
		isSelected: false,
		isInlineEditing: false,
		inlineEditingText: '',
		canInteract: false,
		presenting: true,
		spellCheckEnabled: false,
		mediaDataUrls: new Map(),
		selectionColorClass: 'blue-500',
		showHoverBorder: false,
		imageAltText: 'Shape',
		showResizeHandles: false,
		renderInk: true,
		renderGroups: true,
		adjustmentHandles: [],
		onResizePointerDown: vi.fn(),
		onAdjustmentPointerDown: vi.fn(),
		onInlineEditChange: vi.fn(),
		onInlineEditCommit: vi.fn(),
		onInlineEditCancel: vi.fn(),
		presentationElementStates: new Map([
			[
				'shape-1::pptx-bg',
				{ visible: false, cssAnimation: 'pptx-fade-in 500ms ease 0ms 1 normal both' },
			],
		]),
	};
}

describe('background-only presentation animation', () => {
	it('animates a separate paint layer without hiding the shape text', () => {
		act(() => root.render(<ElementRenderer {...props()} />));

		const outer = container.querySelector<HTMLElement>('[data-element-id="shape-1"]');
		const background = container.querySelector<HTMLElement>(
			'[data-pptx-animation-layer="background"]',
		);
		expect(outer).not.toBeNull();
		expect(outer?.style.visibility).not.toBe('hidden');
		expect(background?.style.visibility).toBe('hidden');
		expect(background?.style.animation).toContain('pptx-fade-in');
		expect(container.textContent).toContain('Text remains visible');
	});
});
