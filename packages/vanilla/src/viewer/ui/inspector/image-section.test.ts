import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createImageSection } from './image-section';
import type { InspectorHandlers, InspectorState } from './types';

function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

function state(overrides: Partial<InspectorState> = {}): InspectorState {
	return {
		hasSelection: true,
		isImage: true,
		croppable: true,
		altText: '',
		cropLeft: 0,
		cropTop: 0,
		cropRight: 0,
		cropBottom: 0,
		...overrides,
	} as InspectorState;
}

function handlers(): InspectorHandlers {
	return {
		setAltText: vi.fn(),
		replaceImage: vi.fn(),
		resetImage: vi.fn(),
		setImageBrightness: vi.fn(),
		setImageContrast: vi.fn(),
		setImageSaturation: vi.fn(),
		setImageCrop: vi.fn(),
		setImageEffects: vi.fn(),
		pushRecentColor: vi.fn(),
	} as unknown as InspectorHandlers;
}

/**
 * G7 (OpenXML parity audit, D3): `a:picLocks/@noCrop` was parsed and
 * round-tripped but never enforced - the four crop number fields stayed
 * enabled regardless of the lock, gated only on `state.isImage`.
 */
describe('image section crop fields with a:picLocks/@noCrop', () => {
	it('disables all four crop fields when croppable is false', () => {
		const section = createImageSection(document, createTranslator(), sectionFactory(), handlers());
		section.update(state({ croppable: false }));
		const cropInputs = section.el.querySelectorAll<HTMLInputElement>('input[type="number"]');
		expect(cropInputs).toHaveLength(4);
		for (const input of cropInputs) {
			expect(input.disabled).toBeTruthy();
		}
	});

	it('leaves the crop fields enabled on an editable, unlocked picture', () => {
		const section = createImageSection(document, createTranslator(), sectionFactory(), handlers());
		section.update(state({ croppable: true }));
		const cropInputs = section.el.querySelectorAll<HTMLInputElement>('input[type="number"]');
		for (const input of cropInputs) {
			expect(input.disabled).toBeFalsy();
		}
	});
});
