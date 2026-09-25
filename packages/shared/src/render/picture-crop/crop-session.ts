/**
 * Crop mode's lifecycle, shared so every binding enters, commits and cancels
 * it the same way:
 *
 * - Enter: the Crop ribbon button, the picture context menu's Crop entry.
 *   Only a croppable picture ({@link canCropElement}) enters.
 * - While in crop mode, handle and pan drags update the picture LIVE (so the
 *   renderer shows the new `a:srcRect` as it changes) without recording undo.
 * - Enter, a click outside the picture, selecting something else, or pressing
 *   the Crop button again COMMITS: one undo step from the snapshot taken on
 *   entry to the current state (none when nothing changed).
 * - Escape CANCELS: the snapshot is written back and no undo step is left.
 *
 * @module render/picture-crop/crop-session
 */
import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import { canInteractWithElement } from '../element-locks';
import { cropFrameOf, readCropInsets } from './crop-geometry';
import type { CropElementUpdate } from './crop-geometry';

/** A picture PowerPoint would let you crop: image-like and not `noCrop`-locked. */
export function canCropElement(el: PptxElement | null | undefined): boolean {
	return (
		el !== null && el !== undefined && isImageLikeElement(el) && canInteractWithElement(el, 'crop')
	);
}

/** The snapshot a crop session restores on cancel. */
export interface CropSession {
	elementId: string;
	original: CropElementUpdate;
}

/** Start crop mode on `el`, or null when it cannot be cropped. */
export function startCropSession(el: PptxElement | null | undefined): CropSession | null {
	if (!el || !canCropElement(el)) {
		return null;
	}
	return { elementId: el.id, original: { ...cropFrameOf(el), ...readCropInsets(el) } };
}

/** The update that undoes every change made during the session. */
export function cancelCropUpdate(session: CropSession): CropElementUpdate {
	return { ...session.original };
}

/** Whether the element differs from the session's snapshot (so commit records undo). */
export function cropSessionChanged(session: CropSession, el: PptxElement): boolean {
	const now: CropElementUpdate = { ...cropFrameOf(el), ...readCropInsets(el) };
	return (Object.keys(now) as (keyof CropElementUpdate)[]).some(
		(key) => Math.abs(now[key] - session.original[key]) > 1e-6,
	);
}

/** What a key press means in crop mode. */
export type CropModeKeyAction = 'commit' | 'cancel' | null;

/** Enter commits, Escape cancels, anything else is not crop mode's business. */
export function cropModeKeyAction(key: string): CropModeKeyAction {
	if (key === 'Enter') {
		return 'commit';
	}
	if (key === 'Escape' || key === 'Esc') {
		return 'cancel';
	}
	return null;
}

/** The ribbon Crop button's label and the crop-menu entries, as i18n keys. */
export const CROP_LABEL_KEY = 'pptx.image.crop';
export const CROP_FILL_LABEL_KEY = 'pptx.image.cropFill';
export const CROP_FIT_LABEL_KEY = 'pptx.image.cropFit';
export const CROP_ASPECT_LABEL_KEY = 'pptx.image.cropToAspectRatio';
export const CROP_HANDLE_ARIA_KEY = 'pptx.image.cropHandle';
export const CROP_MODE_HINT_KEY = 'pptx.image.cropModeHint';
