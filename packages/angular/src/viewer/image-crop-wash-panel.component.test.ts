/**
 * image-crop-wash-panel.component.test.ts: G7 (OpenXML parity audit, D3).
 *
 * `a:picLocks/@noCrop` was parsed and round-tripped but never enforced - the
 * crop sliders / reset / crop-to-shape buttons stayed usable regardless of
 * the lock. No Angular TestBed (see `vitest.config.ts`): the component is
 * instantiated directly, inputs stubbed as signals, matching
 * `activex-controls-overlay.component.test.ts`.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { ImageCropWashPanelComponent } from './image-crop-wash-panel.component';

function imageEl(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'image',
		id: 'img1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

function createPanel(element: PptxElement): ImageCropWashPanelComponent {
	const panel = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new ImageCropWashPanelComponent(),
	);
	Object.assign(panel, {
		element: signal(element) as unknown as InputSignal<PptxElement>,
	});
	return panel;
}

describe('imageCropWashPanelComponent with a:picLocks/@noCrop', () => {
	it('reports not croppable and ignores crop/reset/shape events when locked', () => {
		const panel = createPanel(imageEl({ locks: { noCrop: true } } as Partial<PptxElement>));
		expect(panel['croppable']()).toBeFalsy();

		const patches: Partial<PptxElement>[] = [];
		panel.patch.subscribe((p) => patches.push(p));

		panel['onCrop']('Left', { target: { value: '40' } } as unknown as Event);
		panel['resetCrop']();
		panel['setCropShape']('ellipse');

		expect(patches).toStrictEqual([]);
	});

	it('accepts crop/reset/shape events on an unlocked picture', () => {
		const panel = createPanel(imageEl());
		expect(panel['croppable']()).toBeTruthy();

		const patches: Partial<PptxElement>[] = [];
		panel.patch.subscribe((p) => patches.push(p));

		panel['onCrop']('Left', { target: { value: '40' } } as unknown as Event);
		expect(patches).toHaveLength(1);
	});
});
