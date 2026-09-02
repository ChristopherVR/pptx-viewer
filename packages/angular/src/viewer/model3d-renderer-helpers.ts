import type { Model3DPptxElement, PptxElement } from 'pptx-viewer-core';

import { modelDataToBlobUrl } from '../internal/shared';
import type { StyleMap } from './element-style';
import { getContainerStyle } from './element-style';

/**
 * Pure helpers for `Model3DRendererComponent`.
 *
 * All functions are framework-agnostic (no Angular dependency) so they can be
 * unit-tested without TestBed, following the same pattern as
 * `connector-path.ts`.
 */

/** Narrowed view-model derived from a `Model3DPptxElement`. */
export interface Model3DViewModel {
	/** Resolved model element, or undefined when the element is not a model3d. */
	readonly model: Model3DPptxElement | undefined;
	/**
	 * Poster image src: `posterImage` is preferred over the raster `imageData`
	 * fallback (mirrors the React `PosterFallback` and the Vue port).
	 */
	readonly posterSrc: string | undefined;
}

/**
 * Narrow `element` to `Model3DPptxElement` and derive the poster source.
 * Uses the type discriminant directly (`el.type === 'model3d'`) to avoid an
 * `isModel3DElement` guard that does not exist in `pptx-viewer-core` exports.
 */
export function buildModel3DViewModel(element: PptxElement): Model3DViewModel {
	if (element.type !== 'model3d') {
		return { model: undefined, posterSrc: undefined };
	}
	const model: Model3DPptxElement = element;
	const posterSrc = model.posterImage ?? model.imageData;
	return { model, posterSrc };
}

/** Wrapper `[ngStyle]`-compatible style for the model3d container `<div>`. */
export function buildModel3DContainerStyle(element: PptxElement, zIndex: number): StyleMap {
	return getContainerStyle(element, zIndex);
}

/**
 * Derive an object (blob) URL for the GLTF/GLB loader from the element's
 * base64 `modelData` data URL. Delegates to shared's `modelDataToBlobUrl`
 * (reuses core's `parseDataUrlToBytes`, no hand-rolled base64); this wrapper
 * only narrows `element` to `Model3DPptxElement` first. Returns `undefined`
 * when the element is not a model3d, has no `modelData`, or the data URL
 * cannot be parsed: the caller then shows the poster fallback. The returned
 * URL is owned by the caller, which must `URL.revokeObjectURL` it on teardown.
 */
export function deriveModel3DBlobUrl(element: PptxElement): string | undefined {
	if (element.type !== 'model3d') {
		return undefined;
	}
	const model: Model3DPptxElement = element;
	return modelDataToBlobUrl(model.modelData, model.modelMimeType);
}
