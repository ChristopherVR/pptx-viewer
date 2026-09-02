// @vitest-environment happy-dom
/**
 * An empty inherited placeholder's greyed-out authoring hint ("Click to add
 * title", shared `placeholderPromptDescriptor`) must render only on the
 * editing canvas, never while presenting, in a read-only viewer, or on a still
 * (thumbnail / presenter pane / export), so the hint never leaks onto the
 * audience screen or a printed handout.
 *
 * React used to paint the hint whenever `promptText` was set, regardless of
 * surface; the other four bindings already gate it through shared.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElementRenderer } from './ElementRenderer';
import type { ElementRendererProps } from './elements/element-renderer-types';
import { StaticElementRenderer } from './StaticElementRenderer';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => translationsEn[key] ?? key }),
}));

const PROMPT = 'Click to add title';

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

function emptyPlaceholder(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'title-1',
		type: 'text',
		x: 10,
		y: 10,
		width: 400,
		height: 80,
		text: '',
		textSegments: [],
		promptText: PROMPT,
		...overrides,
	} as unknown as PptxElement;
}

function makeProps(
	element: PptxElement,
	overrides: Partial<ElementRendererProps>,
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

function renderCanvas(element: PptxElement, overrides: Partial<ElementRendererProps>): string {
	act(() => {
		root.render(<ElementRenderer {...makeProps(element, overrides)} />);
	});
	return container.textContent ?? '';
}

describe('placeholder prompt on the interactive canvas', () => {
	it('shows the hint on the editable canvas', () => {
		expect(renderCanvas(emptyPlaceholder(), { canInteract: true })).toContain(PROMPT);
	});

	it('never shows the hint on the show stage', () => {
		expect(
			renderCanvas(emptyPlaceholder(), { canInteract: false, presenting: true }),
		).not.toContain(PROMPT);
	});

	it('never shows the hint in a read-only viewer', () => {
		expect(renderCanvas(emptyPlaceholder(), { canInteract: false })).not.toContain(PROMPT);
	});

	it('never shows the hint once the placeholder has real text', () => {
		const text = renderCanvas(
			emptyPlaceholder({
				text: 'My Title',
				textSegments: [{ text: 'My Title', style: {} }],
			} as Partial<PptxElement>),
			{ canInteract: true },
		);
		expect(text).not.toContain(PROMPT);
		expect(text).toContain('My Title');
	});
});

describe('placeholder prompt on the static renderer (thumbnails, previews, export)', () => {
	it('never shows the hint on a still', () => {
		act(() => {
			root.render(<StaticElementRenderer element={emptyPlaceholder()} positioned />);
		});
		expect(container.textContent ?? '').not.toContain(PROMPT);
	});
});
