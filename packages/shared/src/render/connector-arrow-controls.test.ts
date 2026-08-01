import type { ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	CONNECTOR_ARROW_CONTROLS,
	CONNECTOR_ARROW_SIZE_VALUES,
	CONNECTOR_ARROW_VALUES,
	connectorArrowPatch,
	connectorArrowValue,
} from './connector-arrow-controls';

describe('connector arrow controls', () => {
	it('offers the six controls React shows, in React order', () => {
		expect(CONNECTOR_ARROW_CONTROLS.map((control) => control.styleKey)).toStrictEqual([
			'connectorStartArrow',
			'connectorEndArrow',
			'connectorStartArrowWidth',
			'connectorStartArrowLength',
			'connectorEndArrowWidth',
			'connectorEndArrowLength',
		]);
	});

	it('spells every offered token through the shared vocabulary', () => {
		for (const control of CONNECTOR_ARROW_CONTROLS) {
			for (const value of control.values) {
				expect(control.optionLabelKeys[value], `${control.styleKey} / ${value}`).toMatch(
					/^pptx\./u,
				);
			}
		}
	});

	it('never exposes a raw schema token as an option caption', () => {
		// `arrow` is PowerPoint's "Open Arrow"; the abbreviations sm/med/lg are
		// not words. Both were rendered raw by earlier private tables.
		const captionKeys = CONNECTOR_ARROW_CONTROLS.flatMap((control) =>
			control.values.map((value) => control.optionLabelKeys[value]),
		);
		expect(captionKeys.every((key) => key !== undefined)).toBeTruthy();
		expect(CONNECTOR_ARROW_VALUES).toContain('arrow');
		expect(CONNECTOR_ARROW_SIZE_VALUES).toStrictEqual(['sm', 'med', 'lg']);
	});

	it('falls back to no arrowhead and a medium size', () => {
		const [startArrow, , startWidth] = CONNECTOR_ARROW_CONTROLS;
		expect(connectorArrowValue(startArrow!, undefined)).toBe('none');
		expect(connectorArrowValue(startWidth!, undefined)).toBe('med');
	});

	it('reads the value a deck authored', () => {
		const style: ShapeStyle = {
			connectorStartArrow: 'oval',
			connectorStartArrowWidth: 'lg',
			connectorEndArrowLength: 'sm',
		};
		const byKey = new Map(CONNECTOR_ARROW_CONTROLS.map((c) => [c.styleKey, c]));
		expect(connectorArrowValue(byKey.get('connectorStartArrow')!, style)).toBe('oval');
		expect(connectorArrowValue(byKey.get('connectorStartArrowWidth')!, style)).toBe('lg');
		expect(connectorArrowValue(byKey.get('connectorEndArrowLength')!, style)).toBe('sm');
		expect(connectorArrowValue(byKey.get('connectorEndArrowWidth')!, style)).toBe('med');
	});

	it('patches the OOXML-backed key the control owns', () => {
		const byKey = new Map(CONNECTOR_ARROW_CONTROLS.map((c) => [c.styleKey, c]));
		expect(connectorArrowPatch(byKey.get('connectorEndArrow')!, 'stealth')).toStrictEqual({
			connectorEndArrow: 'stealth',
		});
		expect(connectorArrowPatch(byKey.get('connectorStartArrowLength')!, 'lg')).toStrictEqual({
			connectorStartArrowLength: 'lg',
		});
	});

	it('ignores a token the control does not offer', () => {
		const [startArrow] = CONNECTOR_ARROW_CONTROLS;
		expect(connectorArrowPatch(startArrow!, 'sm')).toStrictEqual({});
	});
});
