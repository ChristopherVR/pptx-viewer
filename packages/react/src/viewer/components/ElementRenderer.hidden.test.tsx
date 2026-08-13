// @vitest-environment happy-dom
/**
 * The Selection Pane's hide toggle must actually hide the shape.
 *
 * `element.hidden` round-tripped correctly through state (the eye icon swapped,
 * `aria-pressed` flipped) but no renderer consulted it, so the shape stayed
 * fully painted and fully clickable on the canvas. React was the one binding
 * with its own `getContainerStyle`, which never emitted the shared module's
 * `display: none`, so it was the one binding where nothing happened at all.
 *
 * These pin the contract for both React renderers: nothing in the DOM, so the
 * element cannot be hit-tested, cannot take focus and cannot be rasterised into
 * an export. The Selection Pane list is asserted separately (it reads the slide
 * model, not the rendered tree, so it is unaffected).
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ElementRenderer } from './ElementRenderer';
import type { ElementRendererProps } from './elements/element-renderer-types';
import { SelectionPane } from './SelectionPane';
import { StaticElementRenderer } from './StaticElementRenderer';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => translationsEn[key] ?? key }),
}));

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

function makeProps(element: PptxElement): ElementRendererProps {
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
	};
}

describe('hidden elements on the interactive canvas', () => {
	it('renders a visible element', () => {
		act(() => {
			root.render(<ElementRenderer {...makeProps(shape())} />);
		});
		expect(container.querySelectorAll('[data-element-id]')).toHaveLength(1);
	});

	it('renders nothing at all for a hidden element', () => {
		act(() => {
			root.render(<ElementRenderer {...makeProps(shape({ hidden: true }))} />);
		});
		expect(container.innerHTML).toBe('');
	});

	it('leaves no hit-testable node behind, so a canvas click cannot find it', () => {
		act(() => {
			root.render(<ElementRenderer {...makeProps(shape({ hidden: true }))} />);
		});
		expect(container.querySelector('[data-element-id="sp_1"]')).toBeNull();
		expect(container.querySelector('[data-pptx-element="true"]')).toBeNull();
	});

	it('drops a hidden child from a group without dropping its visible siblings', () => {
		const group = {
			id: 'grp_1',
			type: 'group',
			x: 0,
			y: 0,
			width: 400,
			height: 200,
			children: [shape({ id: 'child_visible' }), shape({ id: 'child_hidden', hidden: true })],
		} as unknown as PptxElement;
		act(() => {
			root.render(<ElementRenderer {...makeProps(group)} />);
		});
		expect(container.querySelector('[data-element-id="child_visible"]')).not.toBeNull();
		expect(container.querySelector('[data-element-id="child_hidden"]')).toBeNull();
	});

	it('shows the element again once it is un-hidden', () => {
		act(() => {
			root.render(<ElementRenderer {...makeProps(shape({ hidden: true }))} />);
		});
		expect(container.innerHTML).toBe('');
		act(() => {
			root.render(<ElementRenderer {...makeProps(shape({ hidden: false }))} />);
		});
		expect(container.querySelectorAll('[data-element-id]')).toHaveLength(1);
	});
});

describe('hidden elements on the static renderer (thumbnails, previews, export)', () => {
	it('renders a visible element', () => {
		act(() => {
			root.render(<StaticElementRenderer element={shape()} positioned />);
		});
		expect(container.innerHTML).not.toBe('');
	});

	it('renders nothing for a hidden element', () => {
		act(() => {
			root.render(<StaticElementRenderer element={shape({ hidden: true })} positioned />);
		});
		expect(container.innerHTML).toBe('');
	});
});

describe('the Selection Pane still lists and selects a hidden element', () => {
	const slide: PptxSlide = {
		id: 'ppt/slides/slide1.xml',
		slideNumber: 1,
		elements: [shape({ id: 'sp_1', text: 'Kept' }), shape({ id: 'sp_2', hidden: true })],
	} as unknown as PptxSlide;

	function renderPane(onSelect: (id: string | null) => void): void {
		act(() => {
			root.render(
				<SelectionPane
					slides={[slide]}
					activeSlideIndex={0}
					selectedElementId={null}
					selectedElementIds={[]}
					canEdit
					setSelectedElementId={onSelect}
					setSelectedElementIds={vi.fn<() => void>()}
					setSlides={vi.fn<() => void>()}
					markDirty={vi.fn<() => void>()}
					onClose={vi.fn<() => void>()}
				/>,
			);
		});
	}

	it('lists every element, hidden ones included', () => {
		renderPane(vi.fn<() => void>());
		// One eye button per element, whatever its visibility.
		expect(container.querySelectorAll('button[title="Show"], button[title="Hide"]')).toHaveLength(
			2,
		);
		expect(container.querySelectorAll('button[title="Show"]')).toHaveLength(1);
	});

	it('selects a hidden element from its row', () => {
		const onSelect = vi.fn<(id: string | null) => void>();
		renderPane(onSelect);
		// Rows are listed top-most first, so the hidden `sp_2` is the first row.
		const row = container.querySelector('button[title="Show"]')?.parentElement;
		act(() => {
			row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(onSelect).toHaveBeenCalledWith('sp_2');
	});
});
