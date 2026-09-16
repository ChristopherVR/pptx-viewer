/**
 * `ElementRendererGraphicsComponent`'s hit-target overlay for a degenerate
 * (sub-`MIN_ELEMENT_SIZE`) `chart`/`table`/`smartArt`/`ole` element.
 *
 * Issue #285 fixed the painted box (never padded to a minimum any more) but
 * only wired the interaction-only overlay into the `text`/`shape` branch
 * (`ElementRendererShapeComponent`); every other element type this component
 * dispatches its own wrapper `<div>` for shipped with no overlay at all, so a
 * thin authored chart/table/smartArt/ole stayed correctly thin to LOOK at but
 * became unclickable/undraggable to interact with. This pins the fix for the
 * `chart` case (the wrapper-div kind; `ink`/`zoom`/`model3d`/etc. position
 * their own root and are pinned in their own component's test instead).
 *
 * No Angular TestBed (see `vitest.config.ts`): the component has no injected
 * services, so it is instantiated directly and inputs are stubbed as
 * signals, matching `activex-controls-overlay.component.test.ts`.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { ElementRendererGraphicsComponent } from './element-renderer-graphics.component';

function chartElement(width: number, height: number): PptxElement {
	return {
		type: 'chart',
		id: 'chart-1',
		name: '',
		x: 0,
		y: 0,
		width,
		height,
	} as unknown as PptxElement;
}

function createGraphics(
	element: PptxElement,
	editable: boolean,
	presenting: boolean,
): ElementRendererGraphicsComponent {
	const component = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new ElementRendererGraphicsComponent(),
	);
	Object.assign(component, {
		element: signal(element) as unknown as InputSignal<PptxElement>,
		editable: signal(editable) as unknown as InputSignal<boolean>,
		presenting: signal(presenting) as unknown as InputSignal<boolean>,
	});
	return component;
}

describe('elementRendererGraphicsComponent hitTargetStyle (chart wrapper)', () => {
	// Sub-MIN_ELEMENT_SIZE in height: the painted box stays thin (issue #285),
	// so the overlay is the only thing keeping it draggable/clickable.
	const degenerate = chartElement(400, 1);

	it('renders the overlay when editable and not presenting', () => {
		const component = createGraphics(degenerate, true, false);
		expect(component.hitTargetStyle()).toBeDefined();
		expect(component.hitTargetStyle()?.['position']).toBe('absolute');
	});

	it('omits the overlay on a read-only (non-editable) surface', () => {
		const component = createGraphics(degenerate, false, false);
		expect(component.hitTargetStyle()).toBeUndefined();
	});

	it('omits the overlay while presenting, even though editable', () => {
		const component = createGraphics(degenerate, true, true);
		expect(component.hitTargetStyle()).toBeUndefined();
	});

	it('omits the overlay for a chart already at or above the minimum size', () => {
		const roomy = chartElement(400, 300);
		const component = createGraphics(roomy, true, false);
		expect(component.hitTargetStyle()).toBeUndefined();
	});
});
