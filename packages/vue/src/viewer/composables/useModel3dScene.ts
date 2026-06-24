/**
 * useModel3dScene: Vue composable that drives the shared vanilla-three
 * {@link mountModel3D} controller for a GLB/GLTF 3D model element.
 *
 * Responsibilities (the framework-coupled glue the SFC should stay free of):
 * - derive a blob (object) URL from the element's base64 `modelData` data URL
 *   (via core `parseDataUrlToBytes`, never hand-rolled base64), recomputing when
 *   `modelData` changes and revoking the previous URL;
 * - mount the shared scene into a caller-provided container ref whenever a blob
 *   URL exists, three.js is available, and the container is attached;
 * - expose whether the scene actually mounted (`mounted`) so the SFC can fall
 *   back to its poster when three.js is absent / the model failed / there is no
 *   model data;
 * - dispose the live handle and revoke the blob URL on teardown or input change.
 *
 * `three` is an optional peer dependency; it is only ever imported dynamically
 * inside the shared module, so this composable adds nothing to the bundle when
 * the consumer does not install it.
 */
import { parseDataUrlToBytes } from 'pptx-viewer-core';
import type { Model3DPptxElement } from 'pptx-viewer-core';
import { mountModel3D } from 'pptx-viewer-shared';
import type { Model3DHandle } from 'pptx-viewer-shared';
import { onScopeDispose, ref, watch } from 'vue';
import type { Ref } from 'vue';

/** Reactive inputs to {@link useModel3dScene}. */
export interface UseModel3dSceneOptions {
	/** Container the scene's canvas is appended into; may be null pre-mount. */
	container: Ref<HTMLElement | null>;
	/** The 3D model element (or undefined when the element is not a model3d). */
	element: Ref<Model3DPptxElement | undefined>;
	/** CSS-pixel view width. */
	width: Ref<number>;
	/** CSS-pixel view height. */
	height: Ref<number>;
	/** Enable orbit controls (rotate + zoom). Default true. */
	interactive: Ref<boolean>;
}

/** Result of {@link useModel3dScene}. */
export interface UseModel3dSceneResult {
	/** True once an interactive scene has actually mounted (three available). */
	mounted: Ref<boolean>;
}

/** Default MIME for GLB binaries when the element omits `modelMimeType`. */
const DEFAULT_MODEL_MIME = 'model/gltf-binary';

/**
 * Convert a base64 data URL to a blob (object) URL the GLTF loader can fetch.
 * Returns undefined for missing / non-base64 data URLs.
 */
function modelDataToBlobUrl(
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
	// `Uint8Array<ArrayBufferLike>`, which TS does not accept as a `BlobPart`
	// (the backing buffer could in theory be a SharedArrayBuffer).
	const bytes = new Uint8Array(parsed.bytes);
	const blob = new Blob([bytes], { type: mimeType ?? DEFAULT_MODEL_MIME });
	return URL.createObjectURL(blob);
}

/**
 * Mount and manage the shared 3D scene for a model element. See module doc.
 */
export function useModel3dScene(options: UseModel3dSceneOptions): UseModel3dSceneResult {
	const { container, element, width, height, interactive } = options;
	const mounted = ref(false);

	let handle: Model3DHandle | null = null;
	let blobUrl: string | undefined;
	// Monotonic token so a slow mount() that resolves after teardown / a newer
	// model is discarded instead of clobbering the current handle.
	let mountToken = 0;

	/** Dispose the live handle (if any) and reset mounted state. */
	function disposeHandle(): void {
		handle?.dispose();
		handle = null;
		mounted.value = false;
	}

	/** Revoke and clear the current blob URL. */
	function revokeBlobUrl(): void {
		if (blobUrl) {
			URL.revokeObjectURL(blobUrl);
			blobUrl = undefined;
		}
	}

	/** Tear down the scene + blob URL, then mount afresh for the current model. */
	function remount(): void {
		const token = ++mountToken;
		disposeHandle();
		revokeBlobUrl();

		const el = element.value;
		const host = container.value;
		blobUrl = modelDataToBlobUrl(el?.modelData, el?.modelMimeType);
		if (!blobUrl || !host) {
			return;
		}

		const url = blobUrl;
		void mountModel3D(host, url, {
			width: width.value,
			height: height.value,
			interactive: interactive.value,
		}).then((next) => {
			// Stale resolution: a newer remount (or teardown) ran meanwhile.
			if (token !== mountToken) {
				next.dispose();
				return undefined;
			}
			handle = next;
			mounted.value = next.ok;
			return undefined;
		});
	}

	// Remount when the model source (data or container) changes.
	watch([() => element.value?.modelData, () => element.value?.modelMimeType, container], remount, {
		immediate: true,
	});

	// Push interactivity changes to the live handle without a remount.
	watch(interactive, (on) => handle?.setInteractive(on));

	// Push size changes to the live handle without a remount.
	watch([width, height], ([w, h]) => handle?.resize(w, h));

	onScopeDispose(() => {
		mountToken++;
		disposeHandle();
		revokeBlobUrl();
	});

	return { mounted };
}
