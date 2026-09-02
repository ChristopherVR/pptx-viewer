import type { PptxImageEffects, PptxImagePrerenderedCorrections } from '../../types';
import type { A14ImageExtension } from './image-a14-effects';

/**
 * Copy a parsed `a14` blip extension onto the image-effects model.
 *
 * Everything the extension carries is edit-time metadata: PowerPoint bakes the
 * result into the bitmap the main `a:blip` points at, so artistic effects are
 * modelled but flagged as pre-rendered (see `image-a14-effects.ts`).
 *
 * @returns `true` when anything was written onto `effects`.
 */
export function applyA14ExtensionToEffects(
	effects: PptxImageEffects,
	a14: A14ImageExtension,
): boolean {
	let hasAny = false;

	if (a14.artisticEffect !== undefined) {
		effects.artisticEffect = a14.artisticEffect;
		// PowerPoint always keeps the pristine original in a14:imgLayer when it
		// bakes an effect. An extension WITHOUT that layer was written by this
		// library from a gallery pick over an untouched bitmap, so the effect
		// must keep rendering after a round-trip.
		if (a14.originalImageRelId !== undefined) {
			effects.artisticPrerenderedEffect = a14.artisticEffect;
		}
		if (a14.artisticRadius !== undefined) {
			effects.artisticRadius = a14.artisticRadius;
		}
		if (a14.artisticParams) {
			effects.artisticParams = a14.artisticParams;
		}
		hasAny = true;
	}
	if (a14.backgroundRemoval) {
		effects.backgroundRemoval = a14.backgroundRemoval;
		hasAny = true;
	}
	if (a14.originalImageRelId !== undefined) {
		effects.originalImageRelId = a14.originalImageRelId;
		hasAny = true;
	}

	// Corrections / Color panel settings, raw as the XML carries them.
	// The snapshot gets its own copies: an inspector patching a live value in
	// place must not silently update the record of what is baked in.
	const corrections: PptxImagePrerenderedCorrections = {};
	if (a14.sharpenSoften) {
		effects.sharpenSoften = a14.sharpenSoften;
		corrections.sharpenSoften = { ...a14.sharpenSoften };
	}
	if (a14.brightnessContrast) {
		effects.brightnessContrast = a14.brightnessContrast;
		corrections.brightnessContrast = { ...a14.brightnessContrast };
	}
	if (a14.colorTemperature) {
		effects.colorTemperature = a14.colorTemperature;
		corrections.colorTemperature = { ...a14.colorTemperature };
	}
	if (a14.colorSaturation) {
		effects.colorSaturation = a14.colorSaturation;
		corrections.colorSaturation = { ...a14.colorSaturation };
	}
	if (Object.keys(corrections).length > 0) {
		// Same rule as the artistic effect: the pristine layer is PowerPoint's
		// signature for "the main blip already carries the result", and the
		// snapshot lets the renderer skip exactly the values that are baked in.
		if (a14.originalImageRelId !== undefined) {
			effects.prerenderedCorrections = corrections;
		}
		hasAny = true;
	}
	return hasAny;
}
