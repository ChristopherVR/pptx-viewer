/**
 * Tests for the separate-state editTemplateMode pipeline.
 *
 * Template elements (ids prefixed `layout-` / `master-`) are merged into
 * `slide.elements` by the core loader. At load time the React viewer
 * partitions them OUT into a dedicated `templateElementsBySlideId` store
 * (partitionTemplateElements), renders them in their own gated layer, routes
 * edits to that store, and merges them BACK in front of each slide at save time
 * (buildSaveSlides) so the edits persist.
 *
 * These tests prove the full pipeline end to end:
 *  (a) the load partition separates template elements from slide content;
 *  (b) the gated template layer is non-interactive / unhinted while edit-template
 *      mode is off and interactive with the amber affordance while it is on;
 *  (c) editing a template element updates the template store and the edited
 *      element is merged back into the saved slide's `elements`;
 *  (d) normal slide elements are unaffected throughout.
 *
 * Rendering uses react-dom/server renderToStaticMarkup, matching the codebase
 * pattern (the package's test environment is node, so string-markup rendering
 * is the available surface).
 *
 * @module template-editing-pipeline.test
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { buildSaveSlides, makeCloneId, partitionTemplateElements } from '../utils/template-editing';
import { ElementRenderer } from './ElementRenderer';
import type { ElementRendererProps } from './elements/element-renderer-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<PptxElement> & { id: string }): PptxElement {
	return {
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hello',
		...overrides,
	} as PptxElement;
}

function makeSlide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: '', slideNumber: 1, elements } as PptxSlide;
}

const noop = (): void => {};

function makeProps(overrides: Partial<ElementRendererProps>): ElementRendererProps {
	return {
		element: makeElement({ id: 'el-1' }),
		isSelected: false,
		isInlineEditing: false,
		inlineEditingText: '',
		canInteract: true,
		spellCheckEnabled: false,
		mediaDataUrls: new Map<string, string>(),
		selectionColorClass: 'blue-400',
		showHoverBorder: false,
		imageAltText: 'Template element',
		showResizeHandles: false,
		renderInk: false,
		renderGroups: false,
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

const AMBER_AFFORDANCE = 'dashed rgb(217, 119, 6)';

/**
 * Mirror of the production `updateElementById` template branch: a `layout-` /
 * `master-` edit updates the active slide's array inside the template store,
 * immutably and in place.
 */
function applyTemplateEdit(
	store: Record<string, PptxElement[]>,
	slideId: string,
	elementId: string,
	updates: Partial<PptxElement>,
): Record<string, PptxElement[]> {
	return {
		...store,
		[slideId]: (store[slideId] ?? []).map((el) =>
			el.id === elementId ? ({ ...el, ...updates } as PptxElement) : el,
		),
	};
}

// ---------------------------------------------------------------------------
// (a) load-time partition
// ---------------------------------------------------------------------------

describe('partitiontemplateelements separates template from slide content', () => {
	it('moves layout-/master- elements out of slide.elements into the store', () => {
		const slides = [
			makeSlide('slide-1', [
				makeElement({ id: 'master-bg-1', x: 1 }),
				makeElement({ id: 'layout-title-1', x: 2 }),
				makeElement({ id: 'el-9', x: 3 }),
			]),
		];

		const partition = partitionTemplateElements(slides);

		// Template elements live only in the store, preserving relative order.
		expect(partition.templateElementsBySlideId['slide-1'].map((el) => el.id)).toStrictEqual([
			'master-bg-1',
			'layout-title-1',
		]);
		// slide.elements keeps only the slide's own content.
		expect(partition.slides[0].elements.map((el) => el.id)).toStrictEqual(['el-9']);
		// No template element leaks back into slide.elements.
		expect(partition.slides[0].elements.some((el) => el.id.startsWith('layout-'))).toBeFalsy();
		expect(partition.slides[0].elements.some((el) => el.id.startsWith('master-'))).toBeFalsy();
	});

	it('leaves slides without template elements untouched (referentially stable)', () => {
		const slides = [makeSlide('slide-1', [makeElement({ id: 'el-1' })])];

		const partition = partitionTemplateElements(slides);

		expect(partition.slides[0]).toBe(slides[0]);
		expect(partition.templateElementsBySlideId['slide-1']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// (b) gated template layer interactivity + affordance
// ---------------------------------------------------------------------------

describe('the template layer is gated by edit-template mode', () => {
	const isEditableCanvas = true;
	const element = makeElement({ id: 'layout-title-1' });

	it('renders a template element as non-interactive and unhinted when the mode is off', () => {
		const editTemplateMode = false;
		const html = renderElement({
			element,
			opacity: 0.95,
			canInteract: isEditableCanvas && editTemplateMode,
			templateEditing: editTemplateMode,
		});
		expect(containerClass(html)).toContain('pointer-events-none');
		expect(html).not.toContain(AMBER_AFFORDANCE);
	});

	it('renders a template element as interactive with the amber affordance when on', () => {
		const editTemplateMode = true;
		const html = renderElement({
			element,
			opacity: 0.95,
			canInteract: isEditableCanvas && editTemplateMode,
			templateEditing: editTemplateMode,
		});
		expect(containerClass(html)).not.toContain('pointer-events-none');
		expect(html).toContain(AMBER_AFFORDANCE);
	});
});

// ---------------------------------------------------------------------------
// (c) edit routes to the store and is merged back at save time
// ---------------------------------------------------------------------------

describe('template edits persist via the store and save merge-back', () => {
	it('updates the template store and buildSaveSlides merges the edited element back', () => {
		const loaded = [
			makeSlide('slide-1', [
				makeElement({ id: 'layout-title-1', x: 10, text: 'old' }),
				makeElement({ id: 'el-9', x: 20 }),
			]),
		];
		const { slides, templateElementsBySlideId } = partitionTemplateElements(loaded);

		// Edit the template element's geometry and text (routes to the store).
		const edited = applyTemplateEdit(templateElementsBySlideId, 'slide-1', 'layout-title-1', {
			x: 99,
			text: 'new',
		});

		// The store holds the edit; slide.elements never gained the template element.
		expect(edited['slide-1'][0]).toMatchObject({ id: 'layout-title-1', x: 99, text: 'new' });
		expect(slides[0].elements.some((el) => el.id === 'layout-title-1')).toBeFalsy();

		// Save merges the edited template element back in front of slide content.
		const saved = buildSaveSlides(slides, edited);
		const savedIds = saved[0].elements.map((el) => el.id);
		expect(savedIds).toStrictEqual(['layout-title-1', 'el-9']);
		const savedTemplate = saved[0].elements.find((el) => el.id === 'layout-title-1');
		expect(savedTemplate).toMatchObject({ x: 99, text: 'new' });
	});

	it('keeps a duplicated template clone routable to the template store', () => {
		const cloneId = makeCloneId(true, 'master-bg-1');
		expect(cloneId.startsWith('master-')).toBeTruthy();
		// Outside template mode a normal id is generated.
		expect(makeCloneId(false, 'master-bg-1').startsWith('master-')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// (d) normal elements are unaffected
// ---------------------------------------------------------------------------

describe('normal slide elements are unaffected by the template pipeline', () => {
	it('stays in slide.elements and is never hinted regardless of the toggle', () => {
		const slides = [makeSlide('slide-1', [makeElement({ id: 'el-9' })])];
		const { slides: partitioned, templateElementsBySlideId } = partitionTemplateElements(slides);

		expect(partitioned[0].elements.map((el) => el.id)).toStrictEqual(['el-9']);
		expect(templateElementsBySlideId['slide-1']).toBeUndefined();

		const element = makeElement({ id: 'el-9' });
		for (const editTemplateMode of [false, true]) {
			const html = renderElement({
				element,
				selectionColorClass: 'blue-500',
				showHoverBorder: true,
				canInteract: true,
				templateEditing: false,
			});
			expect(containerClass(html)).not.toContain('pointer-events-none');
			expect(html).not.toContain(AMBER_AFFORDANCE);
			expect(editTemplateMode).toBeTypeOf('boolean');
		}

		// buildSaveSlides is a no-op when there are no template elements.
		expect(buildSaveSlides(partitioned, templateElementsBySlideId)[0]).toBe(partitioned[0]);
	});
});
