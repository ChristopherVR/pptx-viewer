/**
 * Reset and clear actions of the properties inspector.
 *
 * Every binding shows the same five actions with the same gating, label key
 * and mutation, so the decisions live here and the views only paint them.
 * Each helper returns an {@link InspectorActionState} (is the control in the
 * DOM, is it enabled) and, where the action edits the document, the exact
 * patch to hand to the host's element, slide or chart update (one undo step).
 *
 * Canonical behaviour (PowerPoint's Reset Picture keeps the crop, which is
 * what Reset Crop is for):
 * - Reset Picture: visible on a picture; enabled when the host can edit and
 *   an effect or crop-to-shape override exists; clears `imageEffects` and
 *   `cropShape`, leaves crop insets alone.
 * - Reset Crop: visible on a picture; enabled when the host can edit and the
 *   picture is not `noCrop` locked; zeroes the four insets.
 * - Reset trim: visible only while editable media carries a trim; zeroes both.
 * - Clear series colour: visible per series only while editable and the series
 *   carries its own colour.
 * - Clear background: visible only while the slide has its own background;
 *   enabled when the host can edit; removes colour, picture, gradient, pattern.
 */
import type { PptxChartSeries, PptxElement, PptxSlide } from 'pptx-viewer-core';

import { canInteractWithElement } from './element-locks';
import { clearBackgroundPatch } from './slide-background-patch';

/** Translation keys of the five actions (identical in every binding). */
export const INSPECTOR_RESET_ACTION_KEYS = {
	resetImage: 'pptx.image.resetImage',
	resetCrop: 'pptx.image.resetCrop',
	resetTrim: 'pptx.media.resetTrim',
	clearSeriesColor: 'pptx.chart.clearSeriesColor',
	clearBackground: 'pptx.slideBackground.clearBackground',
} as const;

export interface InspectorActionState {
	/** The control is rendered at all. */
	visible: boolean;
	/** The control accepts activation. */
	enabled: boolean;
}

const HIDDEN: InspectorActionState = { visible: false, enabled: false };

function isNeutralEffect(value: unknown): boolean {
	return value === undefined || value === null || value === 0 || value === false;
}

/** True when the picture carries an effect or crop-to-shape that Reset Picture would remove. */
export function hasImageOverrides(element: PptxElement): boolean {
	const effects = (element as { imageEffects?: Record<string, unknown> }).imageEffects;
	if (effects && Object.values(effects).some((value) => !isNeutralEffect(value))) {
		return true;
	}
	const shape = (element as { cropShape?: string }).cropShape;
	return shape !== undefined && shape !== 'none';
}

export function imageResetState(
	element: PptxElement | undefined,
	canEdit: boolean,
	isPicture: boolean,
): InspectorActionState {
	if (!element || !isPicture) {
		return HIDDEN;
	}
	return { visible: true, enabled: canEdit && hasImageOverrides(element) };
}

export function imageResetPatch(): Partial<PptxElement> {
	return { imageEffects: undefined, cropShape: 'none' } as Partial<PptxElement>;
}

export function cropResetState(
	element: PptxElement | undefined,
	canEdit: boolean,
	isPicture: boolean,
): InspectorActionState {
	if (!element || !isPicture) {
		return HIDDEN;
	}
	return { visible: true, enabled: canEdit && canInteractWithElement(element, 'crop') };
}

export function cropResetPatch(): Partial<PptxElement> {
	return { cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0 } as Partial<PptxElement>;
}

export function mediaTrimResetState(
	media: { trimStartMs?: number; trimEndMs?: number } | undefined,
	canEdit: boolean,
): InspectorActionState {
	const hasTrim = (media?.trimStartMs ?? 0) > 0 || (media?.trimEndMs ?? 0) > 0;
	return canEdit && hasTrim ? { visible: true, enabled: true } : HIDDEN;
}

export function mediaTrimResetPatch(): Partial<PptxElement> {
	return { trimStartMs: 0, trimEndMs: 0 } as Partial<PptxElement>;
}

export function seriesColorClearState(
	series: Pick<PptxChartSeries, 'color'> | undefined,
	canEdit: boolean,
): InspectorActionState {
	return canEdit && series?.color ? { visible: true, enabled: true } : HIDDEN;
}

export function slideBackgroundClearState(
	slide:
		| Pick<
				PptxSlide,
				'backgroundColor' | 'backgroundImage' | 'backgroundGradient' | 'backgroundPattern'
		  >
		| undefined,
	canEdit: boolean,
): InspectorActionState {
	const has = Boolean(
		slide?.backgroundColor ||
		slide?.backgroundImage ||
		slide?.backgroundGradient ||
		slide?.backgroundPattern,
	);
	return has ? { visible: true, enabled: canEdit } : HIDDEN;
}

export function slideBackgroundClearPatch(): Partial<PptxSlide> {
	return clearBackgroundPatch();
}
