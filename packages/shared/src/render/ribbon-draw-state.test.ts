import { describe, expect, it } from 'vitest';

import { canRequestDraw } from './ribbon-draw-state';

const state = { tool: 'pen' as const, color: '#000000', width: 3, editable: true };
describe('draw intent boundaries', () => {
	it('rejects invalid widths, colors and read-only actions', () => {
		expect(canRequestDraw(state, { kind: 'width', value: Number.NaN })).toBeFalsy();
		expect(canRequestDraw(state, { kind: 'width', value: 17 })).toBeFalsy();
		expect(canRequestDraw(state, { kind: 'color', value: 'red', committed: true })).toBeFalsy();
		expect(
			canRequestDraw({ ...state, editable: false }, { kind: 'tool', value: 'pen' }),
		).toBeFalsy();
		expect(canRequestDraw(state, { kind: 'width', value: 16 })).toBeTruthy();
	});
});
