/**
 * OleRendererComponent's placeholder icon primitives, Angular binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly and inputs are stubbed as signals. This pins that the component's
 * `iconShapes` computed reaches the shared, data-driven `getOleIconShapes`
 * catalogue (`pptx-viewer-shared`'s `render/ole-icon-primitives.ts`) rather
 * than a hand-rolled per-type SVG block.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getOleIconShapes } from '../internal/shared';
import { OleRendererComponent } from './ole-renderer.component';

function oleElement(overrides: Partial<OlePptxElement> = {}): PptxElement {
	return {
		type: 'ole',
		id: 'ole-1',
		name: 'Object 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

function createRenderer(element: PptxElement): OleRendererComponent {
	const renderer = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new OleRendererComponent(),
	);
	Object.assign(renderer, {
		element: signal(element) as unknown as InputSignal<PptxElement>,
	});
	return renderer;
}

describe('oleRendererComponent iconShapes', () => {
	it('resolves the excel icon primitives from the shared catalogue', () => {
		const renderer = createRenderer(oleElement({ oleProgId: 'Excel.Sheet.12' }));
		expect(renderer.oleType()).toBe('excel');
		expect(renderer.iconShapes()).toStrictEqual(getOleIconShapes('excel'));
	});

	it('falls back to the unknown icon primitives for an unrecognised progId', () => {
		const renderer = createRenderer(oleElement({ oleProgId: 'SomeApp.Object' }));
		expect(renderer.oleType()).toBe('unknown');
		expect(renderer.iconShapes()).toStrictEqual(getOleIconShapes('unknown'));
	});

	it('carries rect/line/text primitives with the expected shape', () => {
		const renderer = createRenderer(oleElement({ oleProgId: 'MathType.Equation' }));
		const shapes = renderer.iconShapes();
		expect(shapes.some((s) => s.tag === 'text' && s.text === 'f(x)')).toBeTruthy();
		expect(shapes.some((s) => s.tag === 'rect')).toBeTruthy();
	});
});
