/**
 * `ImageRendererComponent`'s hit-target overlay for a degenerate
 * (sub-`MIN_ELEMENT_SIZE`) picture.
 *
 * `ElementRendererComponent` never threaded `editable`/`presenting` into this
 * component at all before this change, so a thin authored picture (a hairline
 * image strip, say) had no way to become draggable/clickable on the editing
 * canvas even though issue #285's fix correctly stopped padding its painted
 * box out to a minimum.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly with a stub `DomSanitizer` (its one injected dependency, unused by
 * `hitTargetStyle`), matching `equation-renderer.component.test.ts`'s stub
 * pattern and `activex-controls-overlay.component.test.ts`'s signal-stubbed
 * inputs.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { SafeHtml } from '@angular/platform-browser';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { ImageRendererComponent } from './image-renderer.component';

/** Minimal stub: `hitTargetStyle` never calls the sanitizer, so this is unused. */
const stubSanitizer = {
	bypassSecurityTrustHtml(value: string): SafeHtml {
		return value as unknown as SafeHtml;
	},
};

function imageElement(width: number, height: number): PptxElement {
	return {
		type: 'image',
		id: 'img-1',
		name: '',
		x: 0,
		y: 0,
		width,
		height,
	} as unknown as PptxElement;
}

function createImageRenderer(
	element: PptxElement,
	editable: boolean,
	presenting: boolean,
): ImageRendererComponent {
	const component = runInInjectionContext(
		Injector.create({ providers: [{ provide: DomSanitizer, useValue: stubSanitizer }] }),
		() => new ImageRendererComponent(),
	);
	Object.assign(component, {
		element: signal(element) as unknown as InputSignal<PptxElement>,
		editable: signal(editable) as unknown as InputSignal<boolean>,
		presenting: signal(presenting) as unknown as InputSignal<boolean>,
	});
	return component;
}

describe('imageRendererComponent hitTargetStyle', () => {
	// Sub-MIN_ELEMENT_SIZE in height: the painted box stays thin (issue #285),
	// so the overlay is the only thing keeping it draggable/clickable.
	const degenerate = imageElement(400, 1);

	it('renders the overlay when editable and not presenting', () => {
		const component = createImageRenderer(degenerate, true, false);
		expect(component.hitTargetStyle()).toBeDefined();
		expect(component.hitTargetStyle()?.['position']).toBe('absolute');
	});

	it('omits the overlay on a read-only (non-editable) surface', () => {
		const component = createImageRenderer(degenerate, false, false);
		expect(component.hitTargetStyle()).toBeUndefined();
	});

	it('omits the overlay while presenting, even though editable', () => {
		const component = createImageRenderer(degenerate, true, true);
		expect(component.hitTargetStyle()).toBeUndefined();
	});

	it('omits the overlay for a picture already at or above the minimum size', () => {
		const roomy = imageElement(400, 300);
		const component = createImageRenderer(roomy, true, false);
		expect(component.hitTargetStyle()).toBeUndefined();
	});
});
