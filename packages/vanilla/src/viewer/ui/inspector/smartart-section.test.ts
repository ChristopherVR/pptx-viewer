import type { PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createSmartArtSection } from './smartart-section';
import type { InspectorHandlers, InspectorState } from './types';

/** A `section()` factory matching the one `createInspector` passes in. */
function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

/** Mount with the identity translator so an option's text IS its i18n key. */
function mount() {
	const setSmartArtColorScheme = vi.fn();
	const section = createSmartArtSection(document, (key) => key, sectionFactory(), {
		setSmartArtColorScheme,
		setSmartArtLayout: vi.fn(),
		setSmartArtNodeText: vi.fn(),
		setSmartArtNodeStyle: vi.fn(),
		mutateSmartArtNode: vi.fn(),
	} as unknown as InspectorHandlers);
	section.update({
		isSmartArt: true,
		smartArtData: { nodes: [], resolvedLayoutType: 'list' } as unknown as PptxSmartArtData,
	} as InspectorState);
	const scheme = section.el.querySelector<HTMLSelectElement>(
		'[data-testid="smartart-color-scheme"]',
	)!;
	return { section, setSmartArtColorScheme, scheme };
}

describe('smartart colour scheme picker', () => {
	it('keeps the five `dgm:colorsDef` families as the option values', () => {
		const { scheme } = mount();

		expect(Array.from(scheme.options).map((option) => option.value)).toStrictEqual([
			'colorful1',
			'colorful2',
			'colorful3',
			'monochromatic1',
			'monochromatic2',
		]);
	});

	it('spells the families rather than showing `monochromatic2`', () => {
		const { scheme } = mount();

		expect(Array.from(scheme.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.smartart.schemeColorful1',
			'pptx.smartart.schemeColorful2',
			'pptx.smartart.schemeColorful3',
			'pptx.smartart.schemeMonochromatic1',
			'pptx.smartart.schemeMonochromatic2',
		]);
	});

	it('still commits the family token', () => {
		const { scheme, setSmartArtColorScheme } = mount();

		scheme.value = 'monochromatic1';
		scheme.dispatchEvent(new Event('change'));

		expect(setSmartArtColorScheme).toHaveBeenCalledWith('monochromatic1');
	});

	it('captions the layout buttons from the shared layout catalogue', () => {
		const { section } = mount();
		const button = section.el.querySelector<HTMLButtonElement>(
			'[data-testid="smartart-layout-hierarchy"]',
		)!;

		expect(button.textContent).toBe('pptx.smartart.category.hierarchy');
	});
});
