import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { FieldSubstitutionContext } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { FieldContextKey } from '../state/field-context';
import ElementRenderer from './ElementRenderer.svelte';
import SlideStage from './SlideStage.svelte';

/**
 * OOXML field-substitution tests.
 *
 * The regression guarded here: this binding called `buildParagraphs(element)`
 * with no field context, so `text-features.pptx` rendered the raw authored
 * placeholder "Slide #" where React / Vue / Angular / Vanilla all render
 * "Slide 1" (caught by the cross-binding `slide-render-parity` e2e spec).
 */

const DECK_CONTEXT: FieldSubstitutionContext = {
	slideNumber: 1,
	footerText: 'Confidential',
	slideTitle: 'Cover',
	customProperties: [{ name: 'Project', value: 'Beta' }],
};

let cleanup: (() => void) | undefined;

function fieldElement(fieldType: string, placeholder: string): PptxElement {
	return {
		id: 'e1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 40,
		textSegments: [{ text: placeholder, fieldType }],
	} as unknown as PptxElement;
}

function mountWithContext(element: PptxElement, context?: FieldSubstitutionContext): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
		...(context ? { context: new Map<unknown, unknown>([[FieldContextKey, () => context]]) } : {}),
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('field substitution in the element renderer', () => {
	it('renders the slide number instead of the authored placeholder', () => {
		const target = mountWithContext(fieldElement('slidenum', 'Slide #'), DECK_CONTEXT);
		expect(target.textContent).toContain('1');
		expect(target.textContent).not.toContain('Slide #');
	});

	it('renders footer, slide-title and document-property fields', () => {
		expect(
			mountWithContext(fieldElement('footer', '<footer>'), DECK_CONTEXT).textContent,
		).toContain('Confidential');
		cleanup?.();
		expect(
			mountWithContext(fieldElement('slidetitle', '<title>'), DECK_CONTEXT).textContent,
		).toContain('Cover');
		cleanup?.();
		expect(
			mountWithContext(fieldElement('docproperty.Project', '<prop>'), DECK_CONTEXT).textContent,
		).toContain('Beta');
	});

	it('keeps the authored text when no context is provided (standalone render)', () => {
		const target = mountWithContext(fieldElement('slidenum', 'Slide #'));
		expect(target.textContent).toContain('Slide #');
	});

	it('substitutes inside warped WordArt text too', () => {
		const target = mountWithContext(
			{
				id: 'e1',
				type: 'shape',
				x: 0,
				y: 0,
				width: 200,
				height: 40,
				textSegments: [{ text: 'Slide #', fieldType: 'slidenum' }],
				textStyle: { textWarpPreset: 'textArchUp' },
			} as unknown as PptxElement,
			DECK_CONTEXT,
		);
		const wordArt = target.querySelector('.pptx-svelte-wordart');
		expect(wordArt?.textContent).toContain('1');
		expect(wordArt?.textContent).not.toContain('Slide #');
	});
});

describe('per-slide field substitution in the stage', () => {
	function mountStage(slide: PptxSlide): HTMLElement {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(SlideStage, {
			target,
			props: {
				slide,
				canvasSize: { width: 960, height: 540 },
				mediaDataUrls: new Map<string, string>(),
				scale: 1,
			},
			context: new Map<unknown, unknown>([[FieldContextKey, () => DECK_CONTEXT]]),
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		return target;
	}

	it('re-points the deck context at the slide it paints, not the active one', () => {
		// A thumbnail / presenter preview of slide 4 must print 4, even though the
		// deck-level context carries the active slide's number (1).
		const target = mountStage({
			id: 'slide-4',
			slideNumber: 4,
			elements: [
				fieldElement('slidenum', 'Slide #'),
				{
					id: 't1',
					type: 'text',
					x: 0,
					y: 60,
					width: 200,
					height: 40,
					text: 'Results',
					placeholderType: 'title',
				},
			],
		} as unknown as PptxSlide);
		expect(target.textContent).toContain('4');
		expect(target.textContent).not.toContain('Slide #');
	});

	it('resolves a slide-title field from the stage own slide', () => {
		const target = mountStage({
			id: 'slide-2',
			slideNumber: 2,
			elements: [
				fieldElement('slidetitle', '<title>'),
				{
					id: 't1',
					type: 'text',
					x: 0,
					y: 60,
					width: 200,
					height: 40,
					text: 'Results',
					placeholderType: 'title',
				},
			],
		} as unknown as PptxSlide);
		expect(target.textContent).toContain('Results');
	});
});
