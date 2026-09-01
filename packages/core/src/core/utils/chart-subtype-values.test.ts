import { describe, expect, it } from 'vitest';

import { parseBar3DShapeVal, parseRadarStyleVal } from './chart-subtype-values';

describe('parseBar3DShapeVal', () => {
	it.each(['box', 'cone', 'coneToMax', 'cylinder', 'pyramid', 'pyramidToMax'])(
		'accepts %s',
		(value) => {
			expect(parseBar3DShapeVal(value)).toBe(value);
		},
	);

	it('rejects an unknown value', () => {
		expect(parseBar3DShapeVal('sphere')).toBeUndefined();
	});

	it('rejects an empty string', () => {
		expect(parseBar3DShapeVal('')).toBeUndefined();
	});
});

describe('parseRadarStyleVal', () => {
	it.each(['standard', 'marker', 'filled'])('accepts %s', (value) => {
		expect(parseRadarStyleVal(value)).toBe(value);
	});

	it('rejects an unknown value', () => {
		expect(parseRadarStyleVal('outline')).toBeUndefined();
	});
});
