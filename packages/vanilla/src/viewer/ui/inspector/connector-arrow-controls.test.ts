import { CONNECTOR_ARROW_CONTROLS } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import { describe, expect, it, vi } from 'vitest';

import { createConnectorArrowControls } from './connector-arrow-controls';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * Vanilla offered two of the six arrowhead controls (the `type` pickers), so a
 * connector's `@w` / `@len` steps were unreachable even though the renderer
 * honoured them. These tests check what a control has to do to count as
 * shipped: it exists under React's accessible name, offers the shared token
 * list, and writes THAT property when picked.
 *
 * Mounted with the real English dictionary, because the captions ARE the
 * accessible names the parity specs diff against React.
 */
function translate(key: string): string {
	return translationsEn[key] ?? key;
}

function mount(state: Partial<InspectorState> = {}) {
	const setShapeStyle = vi.fn();
	const controls = createConnectorArrowControls(document, translate, {
		setShapeStyle,
	} as unknown as InspectorHandlers);
	controls.update({
		canShape: true,
		isConnector: true,
		arrowheadsChangeable: true,
		...state,
	} as InspectorState);
	const labels = Array.from(controls.el.querySelectorAll('label'));
	const selectFor = (caption: string): HTMLSelectElement => {
		const label = labels.find((candidate) => candidate.firstChild?.textContent === caption);
		if (!label) {
			throw new Error(`no select captioned "${caption}"`);
		}
		return label.querySelector('select')!;
	};
	return { controls, labels, selectFor, setShapeStyle };
}

describe('connector arrow controls', () => {
	it('offers all six controls under the same names React uses', () => {
		const { labels } = mount();

		expect(labels.map((label) => label.firstChild?.textContent)).toStrictEqual([
			'Start Arrow',
			'End Arrow',
			'Start Width',
			'Start Length',
			'End Width',
			'End Length',
		]);
	});

	it('keeps the wire tokens as the option values', () => {
		const { selectFor } = mount();

		expect(
			Array.from(selectFor('Start Arrow').options).map((option) => option.value),
		).toStrictEqual(['none', 'triangle', 'stealth', 'diamond', 'oval', 'arrow']);
		expect(Array.from(selectFor('End Length').options).map((option) => option.value)).toStrictEqual(
			['sm', 'med', 'lg'],
		);
	});

	it('spells the options rather than showing `stealth` or `med`', () => {
		const { selectFor } = mount();

		expect(
			Array.from(selectFor('Start Arrow').options).map((option) => option.textContent),
		).toStrictEqual(['None', 'Triangle', 'Stealth', 'Diamond', 'Oval', 'Open Arrow']);
		expect(
			Array.from(selectFor('End Width').options).map((option) => option.textContent),
		).toStrictEqual(['Small', 'Medium', 'Large']);
	});

	it('reflects the authored value, and the schema default where the style is silent', () => {
		const { selectFor } = mount({
			shapeStyle: { connectorEndArrow: 'oval', connectorEndArrowLength: 'sm' },
		});

		expect(selectFor('End Arrow').value).toBe('oval');
		expect(selectFor('End Length').value).toBe('sm');
		// An absent `a:headEnd` means no head; an absent `@w`/`@len` means medium.
		expect(selectFor('Start Arrow').value).toBe('none');
		expect(selectFor('Start Width').value).toBe('med');
	});

	it('writes each control to its own property', () => {
		const picks: Array<[string, string]> = [
			['Start Arrow', 'stealth'],
			['End Arrow', 'diamond'],
			['Start Width', 'lg'],
			['Start Length', 'sm'],
			['End Width', 'sm'],
			['End Length', 'lg'],
		];

		for (const [caption, value] of picks) {
			const control = CONNECTOR_ARROW_CONTROLS.find(
				(candidate) => translationsEn[candidate.labelKey] === caption,
			)!;
			const { selectFor, setShapeStyle } = mount();
			const select = selectFor(caption);

			select.value = value;
			select.dispatchEvent(new Event('change'));

			expect(setShapeStyle).toHaveBeenCalledWith({ [control.styleKey]: value });
		}
	});

	it('hides the whole card when the selection is not a connector', () => {
		const { controls } = mount({ isConnector: false });

		expect(controls.el.hidden).toBeTruthy();
	});

	// G9 (OpenXML parity audit, D3): a:cxnSpLocks/@noChangeArrowheads already
	// computed `arrowheadsChangeable` in element-locks.ts but nothing here
	// consulted it.
	it('disables every dropdown when the connector locks noChangeArrowheads', () => {
		const { labels } = mount({ arrowheadsChangeable: false });
		const selects = labels.map((label) => label.querySelector('select')!);
		expect(selects).toHaveLength(6);
		expect(selects.every((s) => s.disabled)).toBeTruthy();
	});
});
