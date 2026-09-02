/**
 * EffectsPanelComponent's outer-shadow "Rotate with Shape" toggle, Angular
 * binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals. Pins the parity fix: Angular's
 * outer-shadow section had no control for `a:outerShdw@rotWithShape`, even
 * though shared's `OuterShadowState`/`updateOuterShadowPatch` already
 * supported it.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { EffectsPanelComponent } from './effects-panel.component';

function shapeElement(shapeStyle: ShapeStyle): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		name: 'Shape 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle,
	} as PptxElement;
}

function createPanel(shapeStyle: ShapeStyle): EffectsPanelComponent {
	const panel = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new EffectsPanelComponent(),
	);
	Object.assign(panel, {
		element: signal(shapeElement(shapeStyle)) as unknown as InputSignal<PptxElement>,
	});
	return panel;
}

function checkboxChange(checked: boolean): Event {
	const input = document.createElement('input');
	input.type = 'checkbox';
	input.checked = checked;
	return { target: input } as unknown as Event;
}

describe('effectsPanelComponent outer shadow rotateWithShape', () => {
	it('defaults to true, matching PowerPoint, when the attribute is absent', () => {
		const panel = createPanel({ shadowColor: '#000000' } as ShapeStyle);
		expect(panel['state']().outerShadow.rotateWithShape).toBeTruthy();
	});

	it('reads an authored shadowRotateWithShape: false', () => {
		const panel = createPanel({
			shadowColor: '#000000',
			shadowRotateWithShape: false,
		} as ShapeStyle);
		expect(panel['state']().outerShadow.rotateWithShape).toBeFalsy();
	});

	it('emits a patch turning rotateWithShape off', () => {
		const panel = createPanel({ shadowColor: '#000000' } as ShapeStyle);
		let emitted: Partial<PptxElement> | undefined;
		vi.spyOn(panel.patch as OutputEmitterRef<Partial<PptxElement>>, 'emit').mockImplementation(
			(value) => {
				emitted = value;
			},
		);
		panel['onOuterShadowRotateWithShapeToggle'](checkboxChange(false));
		expect((emitted?.shapeStyle as ShapeStyle | undefined)?.shadowRotateWithShape).toBeFalsy();
	});
});
