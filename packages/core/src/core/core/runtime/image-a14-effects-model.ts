import type { PptxImageEffects } from '../../types';
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
	if (a14.sharpenSoften) {
		effects.sharpenSoften = a14.sharpenSoften;
		hasAny = true;
	}
	if (a14.brightnessContrast) {
		effects.brightnessContrast = a14.brightnessContrast;
		hasAny = true;
	}
	if (a14.colorTemperature) {
		effects.colorTemperature = a14.colorTemperature;
		hasAny = true;
	}
	if (a14.colorSaturation) {
		effects.colorSaturation = a14.colorSaturation;
		hasAny = true;
	}
	return hasAny;
}
