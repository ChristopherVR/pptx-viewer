/**
 * Tests for the editTemplateMode gate on master/layout (template) elements.
 *
 * Template elements (ids prefixed `layout-` / `master-`) are merged into
 * `slide.elements` by the core loader and rendered by the main element layer.
 * They must be interaction-locked unless edit-template mode is on, must show an
 * amber affordance only while on, and must leave normal slide elements
 * unaffected. Edits route through `slide.elements` (the same path as any
 * element), not a separate template record.
 *
 * Rendering uses react-dom/server renderToStaticMarkup, matching the codebase
 * pattern (see StatusBar.test.tsx, ShareDialog.test.tsx). The package's test
 * environment is node, so string-markup rendering is the available surface.
 *
 * @module template-editing-gate.test
 */
import type { PptxElement } from 'pptx-viewer-core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { isElementInteractive, isTemplateEditingHighlight } from '../utils';
import { ElementRenderer } from './ElementRenderer';
import type { ElementRendererProps } from './elements/element-renderer-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'el-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hello',
		...overrides,
	} as PptxElement;
}

const noop = (): void => {};

function makeProps(overrides: Partial<ElementRendererProps>): ElementRendererProps {
	return {
		element: makeElement(),
		isSelected: false,
		isInlineEditing: false,
		inlineEditingText: '',
		canInteract: true,
		spellCheckEnabled: false,
		mediaDataUrls: new Map<string, string>(),
		selectionColorClass: 'blue-500',
		showHoverBorder: true,
		imageAltText: 'Slide element',
		showResizeHandles: false,
		renderInk: true,
		renderGroups: true,
		adjustmentHandleDescriptor: null,
		onResizePointerDown: noop,
		onAdjustmentPointerDown: noop,
		onInlineEditChange: noop,
		onInlineEditCommit: noop,
		onInlineEditCancel: noop,
		...overrides,
	};
}

function renderElement(props: Partial<ElementRendererProps>): string {
	return renderToStaticMarkup(React.createElement(ElementRenderer, makeProps(props)));
}

/**
 * Class list of the outermost element container (`data-pptx-element="true"`).
 * Asserting on the container (not the inner text body, which always carries
 * `pointer-events-none`) isolates the interactivity gate this feature controls.
 */
function containerClass(html: string): string {
	const match = /data-pptx-element="true"[^>]*?\sclass="(?<cls>[^"]*)"/u.exec(html);
	return match?.groups?.cls ?? '';
}

// ---------------------------------------------------------------------------
// Pure gating predicates
// ---------------------------------------------------------------------------

describe('isElementInteractive', () => {
	const templateEl = makeElement({ id: 'layout-1' });
	const normalEl = makeElement({ id: 'el-9' });

	it('locks template elements when edit-template mode is off', () => {
		expect(isElementInteractive(templateEl, true, false)).toBeFalsy();
	});

	it('unlocks template elements when edit-template mode is on', () => {
		expect(isElementInteractive(templateEl, true, true)).toBeTruthy();
	});

	it('leaves normal slide elements interactive regardless of the toggle', () => {
		expect(isElementInteractive(normalEl, true, false)).toBeTruthy();
		expect(isElementInteractive(normalEl, true, true)).toBeTruthy();
	});

	it('gates everything off when the canvas itself is not interactive', () => {
		expect(isElementInteractive(normalEl, false, true)).toBeFalsy();
		expect(isElementInteractive(templateEl, false, true)).toBeFalsy();
	});

	it('recognises master-prefixed ids as template elements', () => {
		const masterEl = makeElement({ id: 'master-3' });
		expect(isElementInteractive(masterEl, true, false)).toBeFalsy();
		expect(isElementInteractive(masterEl, true, true)).toBeTruthy();
	});
});

describe('isTemplateEditingHighlight', () => {
	it('highlights template elements only while edit-template mode is on', () => {
		const templateEl = makeElement({ id: 'layout-1' });
		expect(isTemplateEditingHighlight(templateEl, false)).toBeFalsy();
		expect(isTemplateEditingHighlight(templateEl, true)).toBeTruthy();
	});

	it('never highlights normal slide elements', () => {
		const normalEl = makeElement({ id: 'el-9' });
		expect(isTemplateEditingHighlight(normalEl, false)).toBeFalsy();
		expect(isTemplateEditingHighlight(normalEl, true)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Rendered gate (main element layer)
// ---------------------------------------------------------------------------

describe('template element gate in the rendered main layer', () => {
	const editableCanvas = true;

	it('renders a layout element as non-interactive when the mode is off', () => {
		const element = makeElement({ id: 'layout-1' });
		const canInteract = isElementInteractive(element, editableCanvas, false);
		const html = renderElement({
			element,
			canInteract,
			templateEditing: isTemplateEditingHighlight(element, false),
		});
		expect(canInteract).toBeFalsy();
		expect(containerClass(html)).toContain('pointer-events-none');
		expect(html).not.toContain('dashed rgb(217, 119, 6)');
	});

	it('renders a layout element as interactive with the amber affordance when on', () => {
		const element = makeElement({ id: 'layout-1' });
		const canInteract = isElementInteractive(element, editableCanvas, true);
		const html = renderElement({
			element,
			canInteract,
			templateEditing: isTemplateEditingHighlight(element, true),
		});
		expect(canInteract).toBeTruthy();
		expect(containerClass(html)).not.toContain('pointer-events-none');
		expect(html).toContain('dashed rgb(217, 119, 6)');
	});

	it('leaves a normal element interactive and unhinted regardless of the toggle', () => {
		const element = makeElement({ id: 'el-9' });
		for (const editTemplateMode of [false, true]) {
			const html = renderElement({
				element,
				canInteract: isElementInteractive(element, editableCanvas, editTemplateMode),
				templateEditing: isTemplateEditingHighlight(element, editTemplateMode),
			});
			expect(containerClass(html)).not.toContain('pointer-events-none');
			expect(html).not.toContain('dashed rgb(217, 119, 6)');
		}
	});
});

// ---------------------------------------------------------------------------
// Edit persistence: template edits flow through slide.elements
// ---------------------------------------------------------------------------

describe('template element edits persist into slide.elements', () => {
	// Mirrors the production `updateElementById` reducer: every element, template
	// or not, updates in place within `slides[].elements`. There is no separate
	// template record. This proves a `layout-` edit is not routed to (and lost
	// in) a dead per-slide template map.
	function applyUpdate(
		slides: Array<{ id: string; elements: PptxElement[] }>,
		activeSlideIndex: number,
		elementId: string,
		updates: Partial<PptxElement>,
	): Array<{ id: string; elements: PptxElement[] }> {
		return slides.map((s, i) =>
			i !== activeSlideIndex
				? s
				: {
						...s,
						elements: s.elements.map((el) =>
							el.id === elementId ? ({ ...el, ...updates } as PptxElement) : el,
						),
					},
		);
	}

	it('updates a layout element inside slide.elements', () => {
		const templateEl = makeElement({ id: 'layout-1', x: 10 });
		const normalEl = makeElement({ id: 'el-9', x: 20 });
		const slides = [{ id: 'slide-1', elements: [templateEl, normalEl] }];

		const next = applyUpdate(slides, 0, 'layout-1', { x: 99 });

		const updated = next[0].elements.find((el) => el.id === 'layout-1');
		expect(updated?.x).toBe(99);
		// The template element stays in slide.elements; nothing is dropped.
		expect(next[0].elements).toHaveLength(2);
		expect(next[0].elements.find((el) => el.id === 'el-9')?.x).toBe(20);
	});
});
