/**
 * The animation panel's timing-curve select (Angular binding): an animation
 * with no `timingCurve` is saved as `accel=0 decel=0`, which PowerPoint plays
 * linearly, so the select must show `linear` rather than `ease`.
 *
 * No Angular TestBed (see `vitest.config.ts`): the panel is constructed in a
 * plain `Injector`, its inputs are stubbed as signals, and the template is
 * checked from source.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, Signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxAnimationTimingCurve, PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { AnimationAuthorPanelComponent } from './animation-author-panel.component';
import { componentSource } from './component-source.test-support';

const TEMPLATE = componentSource(__dirname, 'animation-author-panel.component.html');
const SHAPE = { id: 'shape-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;

function currentTimingCurve(animations: PptxElementAnimation[]): Signal<PptxAnimationTimingCurve> {
	const panel = runInInjectionContext(
		Injector.create({
			providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
		}),
		() => new AnimationAuthorPanelComponent(),
	);
	Object.assign(panel, {
		element: signal(SHAPE) as unknown as InputSignal<PptxElement>,
		animations: signal(animations) as unknown as InputSignal<readonly PptxElementAnimation[]>,
		slideElements: signal([SHAPE]) as unknown as InputSignal<readonly PptxElement[]>,
		canEdit: signal(true) as unknown as InputSignal<boolean>,
	});
	return (panel as unknown as { currentTimingCurve: Signal<PptxAnimationTimingCurve> })
		.currentTimingCurve;
}

describe('angular animation panel: timing curve', () => {
	it('shows an unset curve as linear', () => {
		expect(currentTimingCurve([{ elementId: SHAPE.id, entrance: 'fadeIn' }])()).toBe('linear');
	});

	it('keeps an explicit curve', () => {
		expect(
			currentTimingCurve([{ elementId: SHAPE.id, entrance: 'fadeIn', timingCurve: 'ease' }])(),
		).toBe('ease');
	});

	it('binds the select and its options to the effective curve, not a hard-coded ease', () => {
		expect(TEMPLATE).toContain('[value]="currentTimingCurve()"');
		expect(TEMPLATE).toContain('[selected]="opt.value === currentTimingCurve()"');
		expect(TEMPLATE).not.toContain("timingCurve ?? 'ease'");
	});
});
