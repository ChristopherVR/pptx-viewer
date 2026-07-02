/**
 * useImageEditing: framework-free helpers for the image inspector.
 *
 * Holds the pure logic behind ImagePanel.vue and its sub-panels so the SFCs
 * stay thin: default effect objects, effect merging, crop math, and label
 * humanising. No Vue reactivity here - just data and functions.
 */
import type { PptxElement, PptxImageEffects, PptxCropShape } from 'pptx-viewer-core';

/** One editable crop side: the element field key plus its display label. */
export interface CropSide {
	/** Top-level element field, e.g. `cropLeft`. */
	key: 'cropLeft' | 'cropTop' | 'cropRight' | 'cropBottom';
	/** Human label shown next to the slider. */
	label: string;
}

/** The four crop sides, in the same order as React's ImageCropSection. */
export const CROP_SIDES: readonly CropSide[] = [
	{ key: 'cropLeft', label: 'Crop Left' },
	{ key: 'cropTop', label: 'Crop Top' },
	{ key: 'cropRight', label: 'Crop Right' },
	{ key: 'cropBottom', label: 'Crop Bottom' },
] as const;

/** Default colour-wash effect applied when the wash toggle is switched on. */
export const DEFAULT_COLOR_WASH: NonNullable<PptxImageEffects['colorWash']> = {
	color: '#0066cc',
	opacity: 40,
};

/** Default colour-change effect applied when the recolour toggle is switched on. */
export const DEFAULT_CLR_CHANGE: NonNullable<PptxImageEffects['clrChange']> = {
	clrFrom: '#ffffff',
	clrTo: '#000000',
	clrToTransparent: false,
};

/** Default duotone shadow/highlight pair used before a preset is chosen. */
export const DEFAULT_DUOTONE = { color1: '#000000', color2: '#ffffff' } as const;

/**
 * The image-effects object emitted by "Reset Picture": clears every adjustment
 * back to its neutral default. Mirrors React's ImagePropertiesPanel reset.
 */
export const RESET_IMAGE_EFFECTS: PptxImageEffects = {
	brightness: 0,
	contrast: 0,
	saturation: 0,
	grayscale: false,
	artisticEffect: undefined,
	colorWash: undefined,
	alphaModFix: undefined,
	biLevel: undefined,
	duotone: undefined,
	clrChange: undefined,
};

/** Crop-shape reset value paired with {@link RESET_IMAGE_EFFECTS}. */
export const RESET_CROP_SHAPE: PptxCropShape = 'none';

/** Read the image-effects container off an element, if present. */
export function getImageEffects(element: PptxElement): PptxImageEffects | undefined {
	return 'imageEffects' in element ? element.imageEffects : undefined;
}

/**
 * Build the FULL merged `imageEffects` patch for an element update. The parent
 * merges the returned shallow patch via `ops.updateElement(id, patch)`; nested
 * `imageEffects` is emitted whole so partial writes never drop sibling fields.
 */
export function mergeEffectsPatch(
	current: PptxImageEffects | undefined,
	patch: Partial<PptxImageEffects>,
): Partial<PptxElement> {
	const merged: PptxImageEffects = { ...current, ...patch };
	return { imageEffects: merged } as Partial<PptxElement>;
}

/** Convert a stored crop fraction (0..1) to a 0..80 slider percentage. */
export function cropFractionToPercent(value: number | undefined): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 0;
	}
	return Math.round(Math.max(0, Math.min(0.8, value)) * 100);
}

/** Convert a 0..80 slider percentage back to a crop fraction (0..0.8). */
export function cropPercentToFraction(percent: number): number {
	const clamped = Math.max(0, Math.min(80, percent));
	return clamped / 100;
}

/**
 * Humanise an effect name or i18n key into a plain-English label. The Vue
 * bindings do not wire the React i18n catalogue here, so labels are derived
 * from the stored effect/preset key (e.g. `glow_edges` -> "Glow Edges",
 * `duotonePresetNavyGold` -> "Navy Gold").
 */
export function humanizeEffectLabel(key: string): string {
	const last = key.split('.').pop() ?? key;
	const stripped = last.replace(/^effect/u, '').replace(/^duotonePreset/u, '');
	const base = stripped.length > 0 ? stripped : last;
	return base
		.replace(/[_-]+/gu, ' ')
		.replace(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, '$<lower> $<upper>')
		.replace(/\s+/gu, ' ')
		.trim()
		.replace(/\b\w/gu, (c) => c.toUpperCase());
}
