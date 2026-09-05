// @vitest-environment happy-dom
/**
 * A picture marked "decorative" (`adec:decorative`) must be skipped by
 * assistive tech: `aria-hidden="true"`, no role, empty name.
 *
 * The other four bindings stamp this in `applyRenderedElementAccessibility`;
 * React maps the same shared descriptor (`resolveElementAriaAttributes`) onto
 * its wrapper, so the e2e accessibility parity spec sees one answer.
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

function picture(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'pic_1',
		type: 'image',
		x: 0,
		y: 0,
		width: 200,
		height: 80,
		src: 'data:image/png;base64,',
		altText: 'A described picture',
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

function wrapperOf(props: ElementRendererProps): HTMLElement | null {
	act(() => {
		root.render(<ElementRenderer {...props} />);
	});
	return container.querySelector<HTMLElement>('[data-pptx-element="true"]');
}

describe('elementRenderer decorative pictures', () => {
	it('announces a described picture', () => {
		const wrapper = wrapperOf(makeProps(picture()));
		expect(wrapper?.getAttribute('aria-hidden')).toBeNull();
		expect(wrapper?.getAttribute('role')).toBe('img');
		expect(wrapper?.getAttribute('aria-label')).toBe('A described picture');
	});

	it('hides a decorative picture from assistive tech', () => {
		const wrapper = wrapperOf(makeProps(picture({ isDecorative: true } as Partial<PptxElement>)));
		expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
		expect(wrapper?.getAttribute('role')).toBeNull();
		expect(wrapper?.getAttribute('aria-label')).toBe('');
	});

	it('keeps a decorative picture announced once it carries an action', () => {
		const wrapper = wrapperOf(
			makeProps(
				picture({
					isDecorative: true,
					actionClick: { action: 'ppaction://hlinkshowjump?jump=nextslide' },
				} as Partial<PptxElement>),
				{ onActionClick: vi.fn<() => void>() },
			),
		);
		expect(wrapper?.getAttribute('aria-hidden')).toBeNull();
		expect(wrapper?.getAttribute('role')).toBe('button');
	});
});
