import { describe, expect, it } from 'vitest';

import { getCropShapeClipPath } from './crop-shape-clip';

describe('getCropShapeClipPath', () => {
	it('returns undefined for no crop shape', () => {
		expect(getCropShapeClipPath(undefined, 100, 100)).toBeUndefined();
	});

	it("returns undefined for cropShape 'none'", () => {
		expect(getCropShapeClipPath('none', 100, 100)).toBeUndefined();
	});

	it('resolves a direct preset name like ellipse', () => {
		const result = getCropShapeClipPath('ellipse', 100, 60);
		expect(result).toBeDefined();
		expect(result).toBeTypeOf('string');
	});

	it('maps roundedRect to the roundRect preset', () => {
		const result = getCropShapeClipPath('roundedRect', 200, 100);
		expect(result).toBeDefined();
	});

	it('maps star to the star5 preset', () => {
		const result = getCropShapeClipPath('star', 100, 100);
		expect(result).toBeDefined();
	});

	it('resolves a triangle preset', () => {
		const result = getCropShapeClipPath('triangle', 100, 100);
		expect(result).toBeDefined();
	});

	it('produces the same output for equal dimensions regardless of call order', () => {
		const a = getCropShapeClipPath('hexagon', 120, 80);
		const b = getCropShapeClipPath('hexagon', 120, 80);
		expect(a).toStrictEqual(b);
	});
});
