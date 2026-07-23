/**
 * collaboration-live-patch-target.ts: locating an element inside the shared
 * Y.Doc and writing one interim patch into it.
 *
 * Split out of `collaboration-live-patch.ts` (which owns the throttled patcher
 * and the binding-facing helpers) to keep both files inside the repo's 300 LOC
 * ceiling. This half is pure: given a doc it finds the element's Y.Map through
 * the existing schema and applies geometry / text, with no timers or state.
 */

import type { TextSegment, TextStyle } from 'pptx-viewer-core';

import { reconcileElementTextBody } from './collaboration-reconcile';
import type { YArrayLike, YDocLike, YjsFactories, YMapLike } from './collaboration-sync';
import { YDOC_SLIDES_KEY } from './collaboration-sync';
import { remapTextToSegments } from './remap-text';

/** Interim geometry for an element mid-gesture. All fields optional. */
export interface LiveGeometryPatch {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	rotation?: number;
}

export const GEOMETRY_KEYS = ['x', 'y', 'width', 'height', 'rotation'] as const;

/** The element's pre-edit rich text, used to remap the interim plain text. */
export interface LiveTextSource {
	textSegments?: TextSegment[];
	textStyle?: TextStyle;
}

export interface PendingTextPatch {
	value: string;
	source: LiveTextSource;
}

export interface PendingPatch {
	slideId: string | undefined;
	elementId: string;
	geometry?: LiveGeometryPatch;
	text?: PendingTextPatch;
}

/** Interim text longer than this is left to the commit path (safety valve). */
export const MAX_LIVE_TEXT_LENGTH = 100_000;

const asMap = (value: unknown): YMapLike | undefined =>
	typeof value === 'object' && value !== null && typeof (value as YMapLike).get === 'function'
		? (value as YMapLike)
		: undefined;

const asArray = (value: unknown): YArrayLike | undefined =>
	typeof value === 'object' && value !== null && typeof (value as YArrayLike).get === 'function'
		? (value as YArrayLike)
		: undefined;

/**
 * Locate an element's Y.Map through the existing schema
 * (pptx:slides -> slide Y.Map -> `elements` Y.Array -> element Y.Map).
 * When `slideId` is undefined every slide is searched.
 *
 * Only top-level `elements` are walked, so a group's children are not
 * reachable. No binding drags a group child directly today; if one starts to,
 * this walk needs to recurse into `groupElements`.
 */
export function findElementYMap(
	doc: YDocLike,
	slideId: string | undefined,
	elementId: string,
): YMapLike | undefined {
	const slidesArr = doc.getArray(YDOC_SLIDES_KEY);
	for (let i = 0; i < slidesArr.length; i++) {
		const slideMap = asMap(slidesArr.get(i));
		if (!slideMap || (slideId !== undefined && slideMap.get('id') !== slideId)) {
			continue;
		}
		const elements = asArray(slideMap.get('elements'));
		if (!elements) {
			continue;
		}
		for (let j = 0; j < elements.length; j++) {
			const elementMap = asMap(elements.get(j));
			if (elementMap && elementMap.get('id') === elementId) {
				return elementMap;
			}
		}
	}
	return undefined;
}

/** Write one queued patch into the doc. Caller owns the transaction + origin. */
export function applyLivePatch(
	doc: YDocLike,
	factories: YjsFactories,
	patch: PendingPatch,
	textPatchLimit: number,
): void {
	const ymap = findElementYMap(doc, patch.slideId, patch.elementId);
	if (!ymap) {
		return;
	}
	if (patch.geometry) {
		for (const key of GEOMETRY_KEYS) {
			const next = patch.geometry[key];
			if (typeof next === 'number' && ymap.get(key) !== next) {
				ymap.set(key, next);
			}
		}
	}
	if (patch.text) {
		const { value, source } = patch.text;
		if (value.length > textPatchLimit) {
			return;
		}
		if (ymap.get('text') !== value) {
			ymap.set('text', value);
		}
		const segments = remapTextToSegments(value, source.textSegments, source.textStyle);
		reconcileElementTextBody(ymap, { textSegments: segments }, factories);
	}
}
