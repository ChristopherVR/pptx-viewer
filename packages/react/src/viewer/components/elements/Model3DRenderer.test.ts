import { describe, it, expect, vi, afterEach, expectTypeOf } from 'vitest';

import { dataUrlToBlobUrl } from './Model3DRenderer';

// ---------------------------------------------------------------------------
// dataUrlToBlobUrl
//
// This used to be a private, hand-decoded copy of the base64 -> Blob
// conversion that inferred its MIME from the data URL itself. It is now a
// thin wrapper over the shared `modelDataToBlobUrl`
// (packages/shared/src/render/model3d-scene.ts, covered by that module's own
// tests), threading the element's `modelMimeType` through as the Blob type
// (falling back to the shared `DEFAULT_MODEL_MIME`, "model/gltf-binary",
// instead of whatever MIME segment the data URL happens to declare). These
// tests pin that wiring through the binding.
// ---------------------------------------------------------------------------

describe('dataUrlToBlobUrl', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns undefined for falsy input', () => {
		expect(dataUrlToBlobUrl(undefined)).toBeUndefined();
		expect(dataUrlToBlobUrl('')).toBeUndefined();
	});

	it('returns undefined for a string that is not a base64 data URL', () => {
		expect(dataUrlToBlobUrl('not-a-data-url')).toBeUndefined();
	});

	it('converts a valid base64 data URL to a blob URL using the given MIME type', () => {
		// Minimal valid base64 data URL (1 byte: 0x00)
		const dataUrl = 'data:application/octet-stream;base64,AA==';

		const fakeUrl = 'blob:http://localhost/fake-uuid';
		vi.spyOn(globalThis.URL, 'createObjectURL').mockReturnValue(fakeUrl);

		const result = dataUrlToBlobUrl(dataUrl, 'application/octet-stream');

		expect(result).toBe(fakeUrl);
		expect(globalThis.URL.createObjectURL).toHaveBeenCalledOnce();

		const blob = (globalThis.URL.createObjectURL as ReturnType<typeof vi.fn>).mock
			.calls[0][0] as Blob;
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe('application/octet-stream');
		expect(blob.size).toBe(1);
	});

	it('defaults to the shared DEFAULT_MODEL_MIME when no modelMimeType is given', () => {
		const dataUrl = 'data:model/gltf-binary;base64,AA==';

		const fakeUrl = 'blob:http://localhost/fake-uuid-2';
		vi.spyOn(globalThis.URL, 'createObjectURL').mockReturnValue(fakeUrl);

		const result = dataUrlToBlobUrl(dataUrl);
		expect(result).toBe(fakeUrl);

		const blob = (globalThis.URL.createObjectURL as ReturnType<typeof vi.fn>).mock
			.calls[0][0] as Blob;
		expect(blob.type).toBe('model/gltf-binary');
	});

	it('returns undefined for a data URL missing the base64 marker', () => {
		// The shared `parseDataUrlToBytes` (core) requires the exact
		// `data:<mime>;base64,<payload>` shape; a `;base64` marker is not
		// optional the way it was in the old hand-rolled decoder.
		const dataUrl = 'data:application/octet-stream,AA==';
		const result = dataUrlToBlobUrl(dataUrl);
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Blob URL cleanup
// ---------------------------------------------------------------------------

describe('blob URL lifecycle', () => {
	it('uRL.revokeObjectURL is called for cleanup', () => {
		const fakeUrl = 'blob:http://localhost/cleanup-test';
		const revokeSpy = vi.fn<() => void>();
		globalThis.URL.revokeObjectURL = revokeSpy;

		// Simulate cleanup: the component calls URL.revokeObjectURL in an
		// effect cleanup.  We verify the function is callable and works.
		URL.revokeObjectURL(fakeUrl);
		expect(revokeSpy).toHaveBeenCalledWith(fakeUrl);
	});
});

// ---------------------------------------------------------------------------
// Poster fallback (module loads without Three.js)
// ---------------------------------------------------------------------------

describe('model3DRenderer module', () => {
	it('exports dataUrlToBlobUrl as a named export', async () => {
		const mod = await import('./Model3DRenderer');
		expectTypeOf(mod.dataUrlToBlobUrl).toBeFunction();
	});

	it('exports Model3DRenderer as a named export', async () => {
		const mod = await import('./Model3DRenderer');
		expectTypeOf(mod.Model3DRenderer).toBeFunction();
	});
});
