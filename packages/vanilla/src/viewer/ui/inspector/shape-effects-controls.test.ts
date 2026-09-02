import { describe, expect, it, vi } from 'vitest';

import { createShapeEffectsControls } from './shape-effects-controls';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * Mount with the identity translator so an option's text IS the i18n key it
 * resolved, which is what distinguishes "spelled from the shared arrowhead
 * catalogue" from "printed the raw `a:tailEnd` token".
 */
function mount() {
	const setShapeStyle = vi.fn();
	const controls = createShapeEffectsControls(document, (key) => key, {
		setShapeStyle,
		setShapeType: vi.fn(),
	} as unknown as InspectorHandlers);
	controls.update({ canShape: true, isConnector: true } as InspectorState);
	const labels = Array.from(controls.el.querySelectorAll('label'));
	const arrowFor = (key: string): HTMLSelectElement =>
		labels.find((label) => label.textContent?.startsWith(key))!.querySelector('select')!;
	return { controls, setShapeStyle, arrowFor };
}

describe('shape effects arrowhead pickers', () => {
	it('keeps the six arrowhead tokens as the option values', () => {
		const { arrowFor } = mount();

		for (const key of ['pptx.connectorArrows.startArrow', 'pptx.connectorArrows.endArrow']) {
			expect(Array.from(arrowFor(key).options).map((option) => option.value)).toStrictEqual([
				'none',
				'triangle',
				'stealth',
				'diamond',
				'oval',
				'arrow',
			]);
		}
	});

	it('spells the arrowheads rather than showing `stealth`', () => {
		const { arrowFor } = mount();

		expect(
			Array.from(arrowFor('pptx.connectorArrows.startArrow').options).map(
				(option) => option.textContent,
			),
		).toStrictEqual([
			'pptx.arrowhead.none',
			'pptx.arrowhead.triangle',
			'pptx.arrowhead.stealth',
			'pptx.arrowhead.diamond',
			'pptx.arrowhead.oval',
			'pptx.arrowhead.openArrow',
		]);
	});

	it('still writes the wire token onto the connector style', () => {
		const { arrowFor, setShapeStyle } = mount();
		const start = arrowFor('pptx.connectorArrows.startArrow');

		start.value = 'stealth';
		start.dispatchEvent(new Event('change'));

		expect(setShapeStyle).toHaveBeenCalledWith({ connectorStartArrow: 'stealth' });
	});
});

describe('shadow rotate-with-shape toggle', () => {
	it('writes shadowRotateWithShape when toggled', () => {
		const { controls, setShapeStyle } = mount();
		const checkbox = Array.from(controls.el.querySelectorAll('input[type="checkbox"]')).find(
			(input) => input.closest('label')?.textContent?.includes('pptx.shape.shadowRotateWithShape'),
		) as HTMLInputElement;
		expect(checkbox).toBeDefined();

		checkbox.checked = false;
		checkbox.dispatchEvent(new Event('change'));

		expect(setShapeStyle).toHaveBeenCalledWith({ shadowRotateWithShape: false });
	});
});
