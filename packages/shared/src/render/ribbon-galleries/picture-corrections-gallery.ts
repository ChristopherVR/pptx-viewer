/**
 * Picture Format > Adjust > Corrections: the Sharpen/Soften presets and
 * PowerPoint's 5x5 Brightness/Contrast grid (-40% .. +40%). Presets write the
 * a14 Corrections fields (`sharpenSoften`, `brightnessContrast`) core already
 * parses, renders and serialises. The neutral preset removes the field.
 *
 * @module render/ribbon-galleries/picture-corrections-gallery
 */
import { getImageCorrectionsFilterTokens } from '../image-effect-corrections';
import {
	BRIGHTNESS_CONTRAST_STEPS,
	SHARPEN_SOFTEN_PERCENTS,
	signedPercent,
} from './picture-adjust-catalog';
import { adjustGalleryModule } from './picture-adjust-gallery';
import type { AdjustPreset, AdjustSection } from './picture-adjust-gallery';

const KEY = 'pptx.gallery.pictureCorrections';

function sharpenPreset(percent: number): AdjustPreset {
	const amount = percent * 1000;
	const abs = Math.abs(percent);
	const id = percent < 0 ? `soften${abs}` : percent > 0 ? `sharpen${abs}` : 'sharpenNormal';
	const css =
		percent < 0
			? getImageCorrectionsFilterTokens({ sharpenSoften: { amount } }).join(' ')
			: // A sharpen is an SVG convolution at render time; a contrast lift previews it.
				percent > 0
				? `contrast(${1 + percent / 200})`
				: '';
	return {
		id,
		labelKey:
			percent === 0 ? `${KEY}.sharpenNormal` : `${KEY}.${percent < 0 ? 'soften' : 'sharpen'}`,
		...(percent !== 0 && { labelParams: { amount: abs } }),
		label:
			percent === 0 ? 'Sharpen: 0% (Normal)' : `${percent < 0 ? 'Soften' : 'Sharpen'}: ${abs}%`,
		changes: () => ({ sharpenSoften: percent === 0 ? undefined : { amount } }),
		applied: (fx) => (fx.sharpenSoften?.amount ?? 0) === amount,
		preview: { css },
	};
}

function brightnessContrastPreset(brightness: number, contrast: number): AdjustPreset {
	const bright = brightness * 1000;
	const cont = contrast * 1000;
	const normal = brightness === 0 && contrast === 0;
	return {
		id: normal ? 'bcNormal' : `bc_b${brightness}_c${contrast}`,
		labelKey: normal ? `${KEY}.brightnessContrastNormal` : `${KEY}.brightnessContrast`,
		...(!normal && {
			labelParams: { brightness: signedPercent(brightness), contrast: signedPercent(contrast) },
		}),
		label: normal
			? 'Brightness: 0% Contrast: 0% (Normal)'
			: `Brightness: ${signedPercent(brightness)}% Contrast: ${signedPercent(contrast)}%`,
		changes: () => ({
			brightnessContrast: normal
				? undefined
				: { ...(bright !== 0 && { bright }), ...(cont !== 0 && { contrast: cont }) },
		}),
		applied: (fx) =>
			(fx.brightnessContrast?.bright ?? 0) === bright &&
			(fx.brightnessContrast?.contrast ?? 0) === cont,
		preview: {
			css: getImageCorrectionsFilterTokens({
				brightnessContrast: { bright, contrast: cont },
			}).join(' '),
		},
	};
}

/** The Corrections gallery's sections. */
export function pictureCorrectionsSections(): AdjustSection[] {
	return [
		{
			id: 'sharpenSoften',
			titleKey: `${KEY}.sharpenSoften`,
			title: 'Sharpen/Soften',
			columns: 5,
			presets: SHARPEN_SOFTEN_PERCENTS.map(sharpenPreset),
		},
		{
			id: 'brightnessContrast',
			titleKey: `${KEY}.brightnessContrastTitle`,
			title: 'Brightness/Contrast',
			columns: 5,
			presets: BRIGHTNESS_CONTRAST_STEPS.flatMap((brightness) =>
				BRIGHTNESS_CONTRAST_STEPS.map((contrast) => brightnessContrastPreset(brightness, contrast)),
			),
		},
	];
}

export const PICTURE_CORRECTIONS_GALLERY = adjustGalleryModule(
	'pictureCorrections',
	`${KEY}.title`,
	'Corrections',
	pictureCorrectionsSections,
);
