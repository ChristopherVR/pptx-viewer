/**
 * element-misc-properties.component.test.ts: the connector arrow pickers.
 *
 * Two things are pinned here. The arrow width and length selects listed `sm` /
 * `med` / `lg`: the literal `a:headEnd/@w` and `@len` attribute values, offered
 * to the user as if they were words. Those values are a file-format contract,
 * so the relabelling must leave them exactly where they were.
 *
 * The captions were also Angular's own sentence-case strings ("Start arrow"),
 * interpolated from an `end` loop variable, while React, Vue, Svelte and
 * Vanilla all render `pptx.connectorArrows.*` ("Start Arrow"). A caption IS the
 * control's accessible name, so that divergence silently broke every spec that
 * addresses these controls by name.
 *
 * No TestBed in this package's suite, so this asserts the descriptor table the
 * template iterates, the keys it spells them with, and the style patch the
 * change handler builds from a picked value.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	CONNECTOR_ARROW_CONTROLS,
	connectorArrowPatch,
	connectorArrowValue,
} from '../internal/shared';
import { keyToLabel, translationsEn } from '../internal/shared-src/i18n';
import { ARROW_SIZE_VALUES, connectorStylePatch } from './element-misc-properties.component';
import { arrowSizeLabelKey, schemaLabelKey } from './schema-token-labels';

function renderedLabel(key: string): string {
	return (translationsEn as Record<string, string | undefined>)[key] ?? keyToLabel(key);
}

describe('arrow size picker', () => {
	it('still offers the three schema steps as its values', () => {
		expect([...ARROW_SIZE_VALUES]).toStrictEqual(['sm', 'med', 'lg']);
	});

	it('spells each step as a word', () => {
		expect(ARROW_SIZE_VALUES.map((size) => renderedLabel(arrowSizeLabelKey(size)))).toStrictEqual([
			'Small',
			'Medium',
			'Large',
		]);
	});

	it('writes the wire token, not the label, into the element style', () => {
		const element = { id: 'c1', type: 'connector' } as unknown as PptxElement;

		expect(connectorStylePatch(element, { connectorStartArrowWidth: 'lg' })).toStrictEqual({
			shapeStyle: { connectorStartArrowWidth: 'lg' },
		});
	});
});

describe('connector arrow card', () => {
	it('renders the six controls under the same names React uses', () => {
		expect(
			CONNECTOR_ARROW_CONTROLS.map((control) => renderedLabel(control.labelKey)),
		).toStrictEqual([
			'Start Arrow',
			'End Arrow',
			'Start Width',
			'Start Length',
			'End Width',
			'End Length',
		]);
	});

	it('spells the arrowhead options rather than showing `stealth`', () => {
		const start = CONNECTOR_ARROW_CONTROLS[0];

		expect(
			start.values.map((value) => renderedLabel(schemaLabelKey(start.optionLabelKeys, value))),
		).toStrictEqual(['None', 'Triangle', 'Stealth', 'Diamond', 'Oval', 'Open Arrow']);
	});

	it('shows the authored value, and the schema default where the style is silent', () => {
		const style: ShapeStyle = { connectorStartArrow: 'oval' };

		expect(connectorArrowValue(CONNECTOR_ARROW_CONTROLS[0], style)).toBe('oval');
		// An absent `a:headEnd` means no head; an absent `@w`/`@len` means medium.
		expect(connectorArrowValue(CONNECTOR_ARROW_CONTROLS[1], style)).toBe('none');
		expect(connectorArrowValue(CONNECTOR_ARROW_CONTROLS[2], style)).toBe('med');
	});

	it('merges every control write into the existing connector style', () => {
		const element = {
			id: 'c1',
			type: 'connector',
			shapeStyle: { strokeWidth: 3 },
		} as unknown as PptxElement;

		for (const control of CONNECTOR_ARROW_CONTROLS) {
			const value = control.values[control.values.length - 1];

			expect(connectorStylePatch(element, connectorArrowPatch(control, value))).toStrictEqual({
				shapeStyle: { strokeWidth: 3, [control.styleKey]: value },
			});
		}
	});

	it('ignores a token the control does not offer', () => {
		expect(connectorArrowPatch(CONNECTOR_ARROW_CONTROLS[0], 'not-an-arrow')).toStrictEqual({});
	});
});
