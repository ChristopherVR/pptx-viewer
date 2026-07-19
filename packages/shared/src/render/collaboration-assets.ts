/**
 * collaboration-assets.ts: binary payload sync for the pptx-viewer
 * collaboration stack.
 *
 * Large binary element fields (media/OLE/3D-model payloads) are synced once
 * via a separate `pptx:assets` Y.Map keyed by `${elementId}:${fieldName}`,
 * instead of being re-embedded as base64 inside every element write. This
 * avoids re-transmitting multi-MB payloads on every unrelated edit to the
 * same element: `writeAssetFields` only touches the assets map when the
 * stored payload actually differs from the incoming value.
 *
 * Known, accepted cost: asset entries are NOT garbage-collected when the
 * element that referenced them is deleted outright (only an explicit
 * field-clear removes its entry, via the `else` branch below). A long-lived
 * room's `pptx:assets` map can only grow. No sweep is implemented in this
 * pass; correct GC across concurrent/offline peers is a separate problem.
 */

import type { YDocLike, YMapLike } from './collaboration-sync';

export const YDOC_ASSETS_KEY = 'pptx:assets';

/**
 * Element fields large/binary enough to route through the asset map instead
 * of being embedded inline as a scalar or complex JSON-blob field.
 */
export const ASSET_ELEMENT_FIELDS: ReadonlySet<string> = new Set([
	'mediaData',
	'posterFrameData',
	'oleEmbeddedData',
	'previewImageData',
	'modelData',
]);

const ASSET_REF_KEYS: Readonly<Record<string, string>> = {
	mediaData: '_mdRef',
	posterFrameData: '_pfdRef',
	oleEmbeddedData: '_oedRef',
	previewImageData: '_pidRef',
	modelData: '_moRef',
};
const REV_ASSET_REF_KEYS: Readonly<Record<string, string>> = Object.fromEntries(
	Object.entries(ASSET_REF_KEYS).map(([field, ref]) => [ref, field]),
);

/**
 * Suffix for the per-field version counter stored on an element's own Y.Map
 * (e.g. `mediaData__v`). Replacing the binary on an EXISTING element only
 * mutates the separate `pptx:assets` map and leaves the element's ref value
 * unchanged, so the `pptx:slides` deep observer would never fire and peers
 * would keep the stale binary. Bumping this counter in the same transaction
 * touches the element map, so the observer fires and readSlidesFromYDoc
 * re-resolves the asset. It is an internal sync token, not a PptxElement
 * field, so the read path skips it (see isAssetVersionKey).
 */
const ASSET_VERSION_SUFFIX = '__v';

export function assetVersionKey(fieldName: string): string {
	return `${fieldName}${ASSET_VERSION_SUFFIX}`;
}

/** True when `key` is one of the internal per-field asset version counters. */
export function isAssetVersionKey(key: string): boolean {
	if (!key.endsWith(ASSET_VERSION_SUFFIX)) {
		return false;
	}
	return ASSET_ELEMENT_FIELDS.has(key.slice(0, -ASSET_VERSION_SUFFIX.length));
}

export function assetKey(elementId: string, fieldName: string): string {
	return `${elementId}:${fieldName}`;
}

export function getAssetsMap(ydoc: YDocLike): YMapLike {
	return ydoc.getMap(YDOC_ASSETS_KEY);
}

/** True when `key` is one of the element-map ref-pointer keys this module owns. */
export function isAssetRefKey(key: string): boolean {
	return key in REV_ASSET_REF_KEYS;
}

/**
 * Writes any present asset-routed fields from `rec` into `assets`, storing
 * only a small ref pointer (not the payload) on the element's own `ymap`.
 * Never reads from `ymap` itself, so it's safe to call on a brand-new,
 * not-yet-integrated map (Yjs throws on reading an unintegrated type) - use
 * this from a create/write path. `assets` is always a root-level (already
 * integrated) map, so the identical-payload skip-write check is still safe.
 */
export function writeAssetFields(
	elementId: string,
	rec: Record<string, unknown>,
	ymap: YMapLike,
	assets: YMapLike,
): void {
	for (const field of ASSET_ELEMENT_FIELDS) {
		const value = rec[field];
		if (typeof value === 'string' && value.length > 0) {
			const key = assetKey(elementId, field);
			if (assets.get(key) !== value) {
				assets.set(key, value);
			}
			ymap.set(ASSET_REF_KEYS[field], key);
		}
	}
}

/**
 * Reconcile variant of {@link writeAssetFields} for an `ymap` that is
 * already integrated (an existing live element being updated in place):
 * additionally reads the current ref to skip a redundant set, and clears
 * the ref + its `assets` entry when the field was cleared.
 */
export function reconcileAssetFields(
	elementId: string,
	rec: Record<string, unknown>,
	ymap: YMapLike,
	assets: YMapLike,
): void {
	for (const field of ASSET_ELEMENT_FIELDS) {
		const refKey = ASSET_REF_KEYS[field];
		const value = rec[field];
		if (typeof value === 'string' && value.length > 0) {
			const key = assetKey(elementId, field);
			if (assets.get(key) !== value) {
				assets.set(key, value);
				// The payload changed for an existing element. When the ref key is
				// unchanged (an in-place binary swap) nothing on the element map
				// would move, so bump a version counter to force a pptx:slides
				// transaction; without it, no peer re-reads the new binary.
				const vKey = assetVersionKey(field);
				const currentVersion = ymap.get(vKey);
				ymap.set(vKey, (typeof currentVersion === 'number' ? currentVersion : 0) + 1);
			}
			if (ymap.get(refKey) !== key) {
				ymap.set(refKey, key);
			}
		} else {
			const existingRef = ymap.get(refKey);
			if (typeof existingRef === 'string') {
				ymap.delete(refKey);
				assets.delete(existingRef);
			}
		}
	}
}

/** Rehydrates any asset-routed fields referenced by `ymap` onto `element`. */
export function readAssetFields(
	ymap: YMapLike,
	assets: YMapLike,
	element: Record<string, unknown>,
): void {
	for (const [refKey, field] of Object.entries(REV_ASSET_REF_KEYS)) {
		const ref = ymap.get(refKey);
		if (typeof ref === 'string') {
			const value = assets.get(ref);
			if (typeof value === 'string') {
				element[field] = value;
			}
		}
	}
}
