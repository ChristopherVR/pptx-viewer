import { describe, expect, it } from 'vitest';

import { buildChart3DBoxFaceColors, shadeChart3DFace } from './chart-3d-shading';

describe('shadeChart3DFace', () => {
	const base = '#156082'; // theme accent1, the colour gt/chart-01 was measured against.

	it('keeps the front face at the base colour exactly', () => {
		expect(shadeChart3DFace(base, 'front')).toBe(base);
	});

	it('darkens the top face to ~0.75x (measured off gt/chart-01)', () => {
		expect(shadeChart3DFace(base, 'top')).toBe('#104862'); // 0x15*0.75≈0x10, 0x60*0.75≈0x48, 0x82*0.75≈0x62
	});

	it('darkens the side faces to ~0.64x (measured off gt/chart-01)', () => {
		const right = shadeChart3DFace(base, 'right');
		expect(right).toBe(shadeChart3DFace(base, 'left'));
		expect(right).toBe(shadeChart3DFace(base, 'back'));
		// 0x15*0.64≈0x0d, 0x60*0.64≈0x3d, 0x82*0.64≈0x53
		expect(right).toBe('#0d3d53');
	});

	it('darkens bottom the most (rarely visible; not independently measured)', () => {
		const bottom = shadeChart3DFace(base, 'bottom');
		const side = shadeChart3DFace(base, 'right');
		expect(bottom).not.toBe(side);
	});
});

describe('buildChart3DBoxFaceColors', () => {
	it('orders colours to match THREE.BoxGeometry material groups (+x,-x,+y,-y,+z,-z)', () => {
		const base = '#156082';
		const [right, left, top, bottom, front, back] = buildChart3DBoxFaceColors(base);
		expect(front).toBe(base);
		expect(top).toBe(shadeChart3DFace(base, 'top'));
		expect(right).toBe(shadeChart3DFace(base, 'right'));
		expect(left).toBe(shadeChart3DFace(base, 'left'));
		expect(back).toBe(shadeChart3DFace(base, 'back'));
		expect(bottom).toBe(shadeChart3DFace(base, 'bottom'));
	});
});
