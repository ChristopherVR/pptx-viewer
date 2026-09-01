import { describe, expect, it } from 'vitest';

import { normalizeStrokeDashType } from './element-style-transform';
import { STROKE_DASH_OPTIONS } from './stroke-dash-options';

describe('sTROKE_DASH_OPTIONS', () => {
	it('lists all 12 ST_PresetLineDashVal values exactly once', () => {
		const values = STROKE_DASH_OPTIONS.map((o) => o.value);
		expect(values).toStrictEqual([
			'solid',
			'dot',
			'dash',
			'dashDot',
			'lgDash',
			'lgDashDot',
			'lgDashDotDot',
			'sysDot',
			'sysDash',
			'sysDashDot',
			'sysDashDotDot',
			'custom',
		]);
		expect(new Set(values).size).toBe(values.length);
	});

	it('carries an i18n key and non-empty label on every entry', () => {
		for (const option of STROKE_DASH_OPTIONS) {
			expect(option.i18nKey.length).toBeGreaterThan(0);
			expect(option.label.length).toBeGreaterThan(0);
		}
	});

	it('every value is accepted by the shared dash normaliser', () => {
		for (const option of STROKE_DASH_OPTIONS) {
			if (option.value === 'custom') {
				// "custom" is a UI-only sentinel: the normaliser round-trips it, but
				// the actual dash pattern comes from parsed custom dash segments.
				expect(normalizeStrokeDashType(option.value)).toBe('custom');
				continue;
			}
			expect(normalizeStrokeDashType(option.value)).toBe(option.value);
		}
	});
});
