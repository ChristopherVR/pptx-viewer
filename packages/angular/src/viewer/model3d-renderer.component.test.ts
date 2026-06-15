/**
 * Unit tests for model3d-renderer pure helpers.
 *
 * All assertions target functions exported from `model3d-renderer-helpers.ts`
 * (the Angular-free layer). No TestBed or DOM involved, following the same
 * pattern as `connector-renderer.component.test.ts`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildModel3DViewModel } from './model3d-renderer-helpers';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function model3d(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'model3d',
		id: 'm3d 1',
		x: 0,
		y: 0,
		width: 320,
		height: 240,
		...overrides,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// buildModel3DViewModel
// ---------------------------------------------------------------------------

describe('buildModel3DViewModel', () => {
	it('returns the model element and no posterSrc when neither poster nor imageData is set', () => {
		const vm = buildModel3DViewModel(model3d());
		expect(vm.model).toBeDefined();
		expect(vm.posterSrc).toBeUndefined();
	});

	it('resolves posterSrc from posterImage when present', () => {
		const src = 'data:image/png;base64,POSTER';
		const vm = buildModel3DViewModel(model3d({ posterImage: src }));
		expect(vm.posterSrc).toBe(src);
	});

	it('falls back to imageData when posterImage is absent', () => {
		const src = 'data:image/png;base64,RASTER';
		const vm = buildModel3DViewModel(model3d({ imageData: src }));
		expect(vm.posterSrc).toBe(src);
	});

	it('prefers posterImage over imageData when both are present', () => {
		const posterSrc = 'data:image/png;base64,POSTER';
		const imageSrc = 'data:image/png;base64,RASTER';
		const vm = buildModel3DViewModel(model3d({ posterImage: posterSrc, imageData: imageSrc }));
		expect(vm.posterSrc).toBe(posterSrc);
	});

	it('returns undefined model and undefined posterSrc for non-model3d elements', () => {
		const shape: PptxElement = {
			type: 'shape',
			id: 's1',
			name: '',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as PptxElement;
		const vm = buildModel3DViewModel(shape);
		expect(vm.model).toBeUndefined();
		expect(vm.posterSrc).toBeUndefined();
	});
});
