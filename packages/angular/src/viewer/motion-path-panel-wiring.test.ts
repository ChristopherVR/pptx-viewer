/**
 * Motion-path wiring outside the gallery: the animation panel's commit path and
 * the slide-size custom properties the shared keyframes resolve against.
 *
 * These are the two joints that break silently. A panel that routed the row
 * through the preset setters would wipe the element's entrance every time a
 * path was picked; a stage that does not publish `--pptx-slide-w` / `-h` leaves
 * every parsed motion path falling back to 1280x720, so a deck authored at any
 * other size under-travels with no error anywhere.
 *
 * No Angular TestBed (see `vitest.config.ts`): the panel is constructed in a
 * plain `Injector` and the stage styles are read from the source.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { motionPathPresetById } from '../internal/shared';
import { AnimationAuthorPanelComponent } from './animation-author-panel.component';
import { componentSource } from './component-source.test-support';

const CANVAS_SOURCE = componentSource(__dirname, 'slide-canvas.component.ts');
const PRESENTATION_SOURCE = componentSource(__dirname, 'presentation-overlay.component.ts');
const PANEL_SOURCE = componentSource(__dirname, 'animation-author-panel.component.ts');

const SHAPE = { id: 'shape-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;

/** The protected handler the panel's motion-path row is bound to. */
interface PanelInternals {
	onMotionPathChange: (presetId: string) => void;
}

function createPanel(animations: PptxElementAnimation[]): {
	panel: PanelInternals;
	emitted: PptxElementAnimation[][];
} {
	const panel = runInInjectionContext(
		Injector.create({
			providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
		}),
		() => new AnimationAuthorPanelComponent(),
	);
	Object.assign(panel, {
		element: signal(SHAPE) as unknown as InputSignal<PptxElement>,
		animations: signal(animations) as unknown as InputSignal<readonly PptxElementAnimation[]>,
		canEdit: signal(true) as unknown as InputSignal<boolean>,
	});
	const emitted: PptxElementAnimation[][] = [];
	vi.spyOn(
		panel.animationsChange as OutputEmitterRef<PptxElementAnimation[]>,
		'emit',
	).mockImplementation((value) => {
		emitted.push(value);
	});
	return { panel: panel as unknown as PanelInternals, emitted };
}

describe('animation panel motion-path row wiring', () => {
	it('applies the picked catalogue path', () => {
		const { panel, emitted } = createPanel([]);
		panel.onMotionPathChange('arcDown');
		expect(emitted[0][0].motionPath).toBe(motionPathPresetById('arcDown')?.path);
	});

	it('keeps the existing entrance when a path is applied', () => {
		const { panel, emitted } = createPanel([
			{ elementId: SHAPE.id, entrance: 'fadeIn', order: 0 } as PptxElementAnimation,
		]);
		panel.onMotionPathChange('zigzag');
		expect(emitted[0]).toHaveLength(1);
		expect(emitted[0][0].entrance).toBe('fadeIn');
		expect(emitted[0][0].motionPath).toBe(motionPathPresetById('zigzag')?.path);
	});

	it('clears the path without touching the surviving preset', () => {
		const { panel, emitted } = createPanel([
			{
				elementId: SHAPE.id,
				entrance: 'fadeIn',
				motionPath: 'M 0 0 L 0.25 0',
				order: 0,
			} as PptxElementAnimation,
		]);
		panel.onMotionPathChange('none');
		expect(emitted[0]).toHaveLength(1);
		expect(emitted[0][0].entrance).toBe('fadeIn');
		expect(emitted[0][0].motionPath).toBeUndefined();
	});

	it('drops the whole entry when the path was the only effect', () => {
		const { panel, emitted } = createPanel([
			{ elementId: SHAPE.id, motionPath: 'M 0 0 L 0.25 0', order: 0 } as PptxElementAnimation,
		]);
		panel.onMotionPathChange('none');
		expect(emitted[0]).toStrictEqual([]);
	});

	it('renders the row above the effect-options gate so it shows with no preset set', () => {
		const rowIndex = PANEL_SOURCE.indexOf('<pptx-motion-path-row');
		const gateIndex = PANEL_SOURCE.indexOf('Effect options: only shown when an animation is set');
		expect(rowIndex).toBeGreaterThan(-1);
		expect(rowIndex).toBeLessThan(gateIndex);
	});
});

describe('slide-size custom properties', () => {
	it('the editing stage publishes its slide size', () => {
		expect(CANVAS_SOURCE).toContain("'--pptx-slide-w': `${size.width}px`");
		expect(CANVAS_SOURCE).toContain("'--pptx-slide-h': `${size.height}px`");
	});

	it('the presentation stage publishes it too', () => {
		expect(PRESENTATION_SOURCE).toContain("'--pptx-slide-w': `${size.width}px`");
		expect(PRESENTATION_SOURCE).toContain("'--pptx-slide-h': `${size.height}px`");
	});
});
