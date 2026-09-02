/**
 * activex-controls-overlay.component.test.ts: ActiveX control fallback
 * overlay, Angular binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals, matching `effects-panel.component.test.ts`.
 * Pins wave-4 contract item 7: Angular previously drew nothing for a slide
 * carrying `p:controls > p:control`.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import type { PptxActiveXControl } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { CanvasSize } from '../internal/shared';
import { ActiveXControlsOverlayComponent } from './activex-controls-overlay.component';

function createOverlay(
	controls: PptxActiveXControl[],
	canvasSize: CanvasSize = { width: 960, height: 540 },
): ActiveXControlsOverlayComponent {
	const overlay = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new ActiveXControlsOverlayComponent(),
	);
	Object.assign(overlay, {
		controls: signal(controls) as unknown as InputSignal<readonly PptxActiveXControl[]>,
		canvasSize: signal(canvasSize) as unknown as InputSignal<CanvasSize>,
	});
	return overlay;
}

describe('activeXControlsOverlayComponent', () => {
	it('renders nothing for a slide with no ActiveX controls', () => {
		const overlay = createOverlay([]);
		expect(overlay['rows']()).toStrictEqual([]);
	});

	it('draws a labelled placeholder badge for a control with no fallback picture', () => {
		const overlay = createOverlay([{ relId: 'rId5', name: 'Command Button 1' }]);
		const rows = overlay['rows']();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			label: 'Command Button 1',
			isImage: false,
			imageUrl: undefined,
		});
	});

	it('places the fallback-picture geometry when the control carries one', () => {
		const overlay = createOverlay([
			{ relId: 'rId5', name: 'Command Button 1', x: 10, y: 20, width: 100, height: 30 },
		]);
		const rows = overlay['rows']();
		expect(rows[0]).toMatchObject({ left: 10, top: 20, width: 100, height: 30 });
	});

	it('stacks multiple placeholder-only controls instead of overlapping them', () => {
		const overlay = createOverlay([
			{ relId: 'rId5', name: 'Button A' },
			{ relId: 'rId6', name: 'Button B' },
		]);
		const rows = overlay['rows']();
		expect(rows).toHaveLength(2);
		expect(rows[0].top).not.toBe(rows[1].top);
	});
});
