/**
 * Unit tests for model3d-renderer pure helpers.
 *
 * All assertions target functions exported from `model3d-renderer-helpers.ts`
 * (the Angular-free layer). No TestBed or DOM involved, following the same
 * pattern as `connector-renderer.component.test.ts`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildModel3DViewModel, deriveModel3DBlobUrl } from './model3d-renderer-helpers';

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

// ---------------------------------------------------------------------------
// deriveModel3DBlobUrl
// ---------------------------------------------------------------------------

describe('deriveModel3DBlobUrl', () => {
	// 1-byte (0x00) GLB payload; the bytes are irrelevant to the test.
	const GLB_DATA_URL = 'data:model/gltf-binary;base64,AA==';

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns undefined for non-model3d elements', () => {
		const shape = { type: 'shape', id: 's', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		expect(deriveModel3DBlobUrl(shape)).toBeUndefined();
	});

	it('returns undefined when the element has no modelData', () => {
		expect(deriveModel3DBlobUrl(model3d())).toBeUndefined();
	});

	it('returns undefined when modelData is not a parseable data URL', () => {
		expect(deriveModel3DBlobUrl(model3d({ modelData: 'not-a-data-url' }))).toBeUndefined();
	});

	it('creates a blob URL from a valid modelData data URL', () => {
		const fakeUrl = 'blob:http://localhost/fake-model';
		const spy = vi.spyOn(globalThis.URL, 'createObjectURL').mockReturnValue(fakeUrl);

		const result = deriveModel3DBlobUrl(model3d({ modelData: GLB_DATA_URL }));

		expect(result).toBe(fakeUrl);
		expect(spy).toHaveBeenCalledOnce();
		const blob = spy.mock.calls[0][0] as Blob;
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe('model/gltf-binary');
		expect(blob.size).toBe(1);
	});

	it('honours an explicit modelMimeType', () => {
		const spy = vi
			.spyOn(globalThis.URL, 'createObjectURL')
			.mockReturnValue('blob:http://localhost/x');

		deriveModel3DBlobUrl(model3d({ modelData: GLB_DATA_URL, modelMimeType: 'model/gltf+json' }));

		const blob = spy.mock.calls[0][0] as Blob;
		expect(blob.type).toBe('model/gltf+json');
	});
});

// ---------------------------------------------------------------------------
// Shared scene controller contract
//
// The component dynamically imports the vendored scene runtime and relies on
// `mountModel3D` resolving to a handle whose `ok` flag drives the poster
// fallback (a not-ok handle, e.g. the `THREE_UNAVAILABLE` sentinel, forces the
// poster). The contract surface (function shape + no-op sentinel) is asserted
// against the real module; the mount/dispose path is exercised in the
// component test below with a mocked controller (real WebGL cannot run under
// happy-dom).
// ---------------------------------------------------------------------------

describe('shared model3d-scene contract', () => {
	it('exports mountModel3D and a no-op THREE_UNAVAILABLE sentinel', async () => {
		const mod = await import('../internal/shared-src/render/model3d-scene');
		expect(mod.mountModel3D).toBeTypeOf('function');
		expect(mod.THREE_UNAVAILABLE.ok).toBeFalsy();
		expect(() => mod.THREE_UNAVAILABLE.dispose()).not.toThrow();
	});
});
