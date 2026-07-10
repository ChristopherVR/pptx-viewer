import { parseDataUrlToBytes } from 'pptx-viewer-core';

/**
 * Pure helpers for `model3d` (embedded GLB/GLTF) elements (Svelte port of the
 * vanilla binding's `renderModel3dElement`). The actual scene mounting is
 * stateful (DOM refs, an async lifecycle) and lives in the `Model3dView` SFC
 * via the shared framework-free `mountModel3D` controller; this module only
 * holds the pure data-URL -> blob-URL conversion so it stays unit-testable
 * without a DOM.
 */

/** Default MIME for GLB binaries when the element omits `modelMimeType`. */
export const DEFAULT_MODEL_MIME = 'model/gltf-binary';

/**
 * Convert the base64 `modelData` data URL to a blob (object) URL the shared
 * GLTF loader can fetch. Returns undefined for missing / malformed data URLs.
 */
export function modelDataToBlobUrl(
	dataUrl: string | undefined,
	mimeType: string | undefined,
): string | undefined {
	if (!dataUrl) {
		return undefined;
	}
	const parsed = parseDataUrlToBytes(dataUrl);
	if (!parsed) {
		return undefined;
	}
	// Copy into a fresh ArrayBuffer-backed view: `parseDataUrlToBytes` returns a
	// `Uint8Array<ArrayBufferLike>`, which TS does not accept as a `BlobPart`.
	const bytes = new Uint8Array(parsed.bytes);
	const blob = new Blob([bytes], { type: mimeType ?? DEFAULT_MODEL_MIME });
	return URL.createObjectURL(blob);
}
