/**
 * image-effect-corrections.ts: CSS/SVG filter mapping for PowerPoint 2010+'s
 * Corrections and Color panels (`a14:sharpenSoften`, `a14:brightnessContrast`,
 * `a14:colorTemperature`, `a14:saturation`), parsed onto
 * {@link PptxImageEffects} as `sharpenSoften`, `brightnessContrast`,
 * `colorTemperature` and `colorSaturation`.
 *
 * These are distinct from the legacy `a:blip/@bright`/`@contrast` pair
 * (`PptxImageEffects.brightness`/`.contrast`, still handled directly in
 * `image-effects.ts`): PowerPoint 2007 wrote the legacy pair as the effect
 * itself, while the a14 corrections are the PowerPoint 2010+ Corrections/Color
 * gallery, recorded at 1/1000ths-of-a-percent precision. Both can be present
 * on the same picture and both apply (OOXML does not treat one as replacing
 * the other), so this module is purely additive to the legacy handling.
 *
 * Like the Artistic Effects gallery (see `isArtisticEffectRendered` in
 * `image-effects.ts`), PowerPoint's Corrections/Color panel bakes the chosen
 * correction into the stored bitmap and keeps the pristine original behind
 * `a14:imgLayer/@r:embed`. Measured on `e2e/fixtures/issue-132-gradient-fill.pptx`
 * (slide 1 logo, `brightnessContrast bright="-20000" contrast="-40000"`): the
 * main-blip PNG is a monotone tonal transform of the `.wdp` original (slope 0.7,
 * fitted per channel over every opaque pixel), so re-applying the panel values
 * on top of it darkens the picture twice. Core records the file's values in
 * `PptxImageEffects.prerenderedCorrections`; {@link renderedImageCorrections}
 * keeps only the fields that differ from that snapshot (i.e. ones changed in
 * this library's inspector), and everything below reads through it.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */
import type { PptxImageEffects, PptxImagePrerenderedCorrections } from 'pptx-viewer-core';

type CorrectionKey = keyof PptxImagePrerenderedCorrections;

/** Structural equality for the small flat records the four corrections use. */
function sameCorrection(
	live: Record<string, number | undefined> | undefined,
	baked: Record<string, number | undefined> | undefined,
): boolean {
	if (!live || !baked) {
		return live === baked;
	}
	const keys = new Set([...Object.keys(live), ...Object.keys(baked)]);
	for (const key of keys) {
		if (live[key] !== baked[key]) {
			return false;
		}
	}
	return true;
}

/**
 * The a14 corrections a renderer must actually apply: each of the four fields
 * whose live value differs from the baked-in snapshot. A field equal to its
 * snapshot is already in the bitmap; one with no snapshot was set in this
 * library and is applied as-is.
 */
export function renderedImageCorrections(
	effects: PptxImageEffects,
): PptxImagePrerenderedCorrections {
	const baked = effects.prerenderedCorrections;
	const isLive = (key: CorrectionKey): boolean =>
		Boolean(effects[key]) && !(baked && sameCorrection(effects[key], baked[key]));
	return {
		...(isLive('sharpenSoften') ? { sharpenSoften: effects.sharpenSoften } : {}),
		...(isLive('brightnessContrast') ? { brightnessContrast: effects.brightnessContrast } : {}),
		...(isLive('colorTemperature') ? { colorTemperature: effects.colorTemperature } : {}),
		...(isLive('colorSaturation') ? { colorSaturation: effects.colorSaturation } : {}),
	};
}

/** Clamp a number to the inclusive `[lo, hi]` range. */
function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

/** Neutral colour temperature, in Kelvin (`a14:colorTemperature/@colorTemp`). */
const NEUTRAL_COLOR_TEMP_K = 6500;
/** Kelvin distance from neutral treated as the "fully warm/cool" endpoint. */
const COLOR_TEMP_RANGE_K = 5000;

/**
 * CSS approximation for `a14:colorTemperature`: warmer than neutral (a lower
 * Kelvin value) adds a sepia tint and rotates hue toward orange; cooler than
 * neutral (a higher Kelvin value) rotates hue toward blue. There is no exact
 * CSS filter for a colour-temperature shift, so this is a visual
 * approximation, not a colour-managed conversion.
 */
function buildColorTemperatureCss(colorTempK: number): string | undefined {
	const diff = colorTempK - NEUTRAL_COLOR_TEMP_K;
	if (diff === 0) {
		return undefined;
	}
	const strength = clamp(Math.abs(diff) / COLOR_TEMP_RANGE_K, 0, 1);
	if (diff < 0) {
		// Warmer: sepia + a small negative hue-rotate biases the sepia toward
		// orange rather than its default brown.
		const sepiaPct = Math.round(strength * 40);
		const hueDeg = Math.round(strength * 15);
		return `sepia(${sepiaPct}%) hue-rotate(-${hueDeg}deg)`;
	}
	// Cooler: rotate hue toward blue.
	const hueDeg = Math.round(strength * 20);
	return `hue-rotate(${hueDeg}deg) saturate(${100 + Math.round(strength * 10)}%)`;
}

/**
 * The CSS `filter:` function tokens for an element's a14 corrections
 * (brightness/contrast, saturation, colour temperature, and softening).
 * Sharpening (a positive `sharpenSoften.amount`) is NOT included here: it
 * needs an SVG `feConvolveMatrix`, produced by {@link getImageSharpenFilter}
 * and appended by the caller as a `url(#id)` reference instead.
 *
 * Values already baked into the bitmap are skipped (see
 * {@link renderedImageCorrections}).
 */
export function getImageCorrectionsFilterTokens(imageEffects: PptxImageEffects): string[] {
	const tokens: string[] = [];
	const effects = renderedImageCorrections(imageEffects);

	if (effects.brightnessContrast) {
		const { bright, contrast } = effects.brightnessContrast;
		if (typeof bright === 'number' && bright !== 0) {
			tokens.push(`brightness(${Math.max(0, 1 + bright / 100000)})`);
		}
		if (typeof contrast === 'number' && contrast !== 0) {
			tokens.push(`contrast(${Math.max(0, 1 + contrast / 100000)})`);
		}
	}

	if (typeof effects.colorSaturation?.sat === 'number') {
		// sat: 100000 = neutral (100%), 0 = grayscale, 400000 = max (400%).
		tokens.push(`saturate(${Math.max(0, effects.colorSaturation.sat / 100000)})`);
	}

	if (typeof effects.colorTemperature?.colorTemp === 'number') {
		const temperatureCss = buildColorTemperatureCss(effects.colorTemperature.colorTemp);
		if (temperatureCss) {
			tokens.push(temperatureCss);
		}
	}

	const sharpenSoftenAmount = effects.sharpenSoften?.amount;
	if (typeof sharpenSoftenAmount === 'number' && sharpenSoftenAmount < 0) {
		// Soften: a small CSS blur. -100000 (fully softened) maps to a 3px blur,
		// a deliberately gentle ceiling since this runs on top of the picture's
		// full-resolution bitmap rather than a thumbnail.
		const strength = clamp(Math.abs(sharpenSoftenAmount) / 100000, 0, 1);
		tokens.push(`blur(${(strength * 3).toFixed(2)}px)`);
	}

	return tokens;
}

/** Stable SVG filter ID for an element's sharpen correction. */
export function getImageSharpenFilterId(elementId: string): string {
	return `sharpen-${elementId}`;
}

/**
 * Build a `feConvolveMatrix` kernel that blends the identity kernel with a
 * 4-neighbour unsharp-mask kernel by `strength` (0..1). The kernel's terms
 * always sum to 1 regardless of strength, which keeps the correction from
 * darkening or brightening the image as a side effect of sharpening it.
 */
function buildSharpenKernel(strength: number): string {
	const edge = (-strength).toFixed(4);
	const center = (1 + 4 * strength).toFixed(4);
	return `0 ${edge} 0 ${edge} ${center} ${edge} 0 ${edge} 0`;
}

/**
 * The SVG `feConvolveMatrix` sharpen filter for a positive `sharpenSoften`
 * amount, or `undefined` when the element has none (or is only softened,
 * which {@link getImageCorrectionsFilterTokens} handles as a CSS `blur()`), or
 * when the sharpening is already baked into the bitmap.
 */
export function getImageSharpenFilter(
	effects: PptxImageEffects,
	elementId: string,
): { id: string; cssReference: string; filterMarkup: string } | undefined {
	const amount = renderedImageCorrections(effects).sharpenSoften?.amount;
	if (typeof amount !== 'number' || amount <= 0) {
		return undefined;
	}
	const strength = clamp(amount / 100000, 0, 1);
	const id = getImageSharpenFilterId(elementId);
	const filterMarkup = `<feConvolveMatrix order="3" kernelMatrix="${buildSharpenKernel(strength)}" preserveAlpha="true"/>`;
	return { id, cssReference: `url(#${id})`, filterMarkup };
}
