import type { Model3DPptxElement, PptxElement } from 'pptx-viewer-core';

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
