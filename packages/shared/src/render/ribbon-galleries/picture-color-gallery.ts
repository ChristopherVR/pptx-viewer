/**
 * Picture Format > Adjust > Color: Color Saturation, Color Tone (temperature)
 * and Recolor presets. Saturation and tone write the a14 fields
 * (`colorSaturation`, `colorTemperature`); recolors write the recolor fields
 * core already round-trips (`grayscale`, `duotone`, `biLevel`, `lum`). The
 * neutral preset removes the field.
 *
 * @module render/ribbon-galleries/picture-color-gallery
 */
import type { PptxImageEffects } from 'pptx-viewer-core';

import { getImageCorrectionsFilterTokens } from '../image-effect-corrections';
import type { RibbonGalleryContext } from './gallery-types';
import {
	accentDuotone,
	BI_LEVEL_THRESHOLDS,
	NEUTRAL_SATURATION_PERCENT,
	NEUTRAL_TEMPERATURE_K,
	RECOLOR_ACCENTS,
	resolveAccentHex,
	SATURATION_PERCENTS,
	SEPIA_DUOTONE,
	TEMPERATURES_K,
	WASHOUT_LUM,
} from './picture-adjust-catalog';
import { adjustGalleryModule, sameHex } from './picture-adjust-gallery';
import type { AdjustPreset, AdjustSection } from './picture-adjust-gallery';

const KEY = 'pptx.gallery.pictureColor';

function saturationPreset(percent: number): AdjustPreset {
	const sat = percent * 1000;
	const normal = percent === NEUTRAL_SATURATION_PERCENT;
	return {
		id: normal ? 'saturationNormal' : `saturation${percent}`,
		labelKey: normal ? `${KEY}.saturationNormal` : `${KEY}.saturation`,
		...(!normal && { labelParams: { amount: percent } }),
		label: normal ? 'Saturation: 100% (Normal)' : `Saturation: ${percent}%`,
		changes: () => ({ colorSaturation: normal ? undefined : { sat } }),
		applied: (fx) => (fx.colorSaturation?.sat ?? NEUTRAL_SATURATION_PERCENT * 1000) === sat,
		preview: { css: getImageCorrectionsFilterTokens({ colorSaturation: { sat } }).join(' ') },
	};
}

function tonePreset(kelvin: number): AdjustPreset {
	const normal = kelvin === NEUTRAL_TEMPERATURE_K;
	return {
		id: normal ? 'toneNormal' : `tone${kelvin}`,
		labelKey: normal ? `${KEY}.toneNormal` : `${KEY}.tone`,
		...(!normal && { labelParams: { kelvin } }),
		label: normal ? 'Temperature: 6500 K (Normal)' : `Temperature: ${kelvin} K`,
		changes: () => ({ colorTemperature: normal ? undefined : { colorTemp: kelvin } }),
		applied: (fx) => (fx.colorTemperature?.colorTemp ?? NEUTRAL_TEMPERATURE_K) === kelvin,
		preview: {
			css: getImageCorrectionsFilterTokens({ colorTemperature: { colorTemp: kelvin } }).join(' '),
		},
	};
}

const isWashout = (fx: PptxImageEffects): boolean =>
	fx.lum?.bright === WASHOUT_LUM.bright && fx.lum?.contrast === WASHOUT_LUM.contrast;

/** Every recolor field cleared, so a recolor pick replaces the previous one. */
function recolorReset(fx: PptxImageEffects): Partial<PptxImageEffects> {
	return {
		grayscale: undefined,
		grayscaleRawXml: undefined,
		duotone: undefined,
		biLevel: undefined,
		biLevelRawXml: undefined,
		colorWash: undefined,
		...(isWashout(fx) && { lum: undefined }),
	};
}

function duotonePreset(
	id: string,
	labelKey: string,
	label: string,
	colors: { color1: string; color2: string },
	labelParams?: Readonly<Record<string, string | number>>,
): AdjustPreset {
	return {
		id,
		labelKey,
		...(labelParams && { labelParams }),
		label,
		changes: (fx) => ({ ...recolorReset(fx), duotone: { ...colors } }),
		applied: (fx) =>
			sameHex(fx.duotone?.color1, colors.color1) && sameHex(fx.duotone?.color2, colors.color2),
		preview: { duotone: [colors.color1, colors.color2] },
	};
}

function recolorPresets(themeColorMap?: Readonly<Record<string, string>>): AdjustPreset[] {
	const none: AdjustPreset = {
		id: 'recolorNone',
		labelKey: `${KEY}.recolorNone`,
		label: 'No Recolor',
		changes: recolorReset,
		applied: (fx) =>
			!fx.grayscale && !fx.duotone && typeof fx.biLevel !== 'number' && !isWashout(fx),
		preview: {},
	};
	const grayscale: AdjustPreset = {
		id: 'recolorGrayscale',
		labelKey: `${KEY}.recolorGrayscale`,
		label: 'Grayscale',
		changes: (fx) => ({ ...recolorReset(fx), grayscale: true }),
		applied: (fx) => Boolean(fx.grayscale),
		preview: { css: 'grayscale(100%)' },
	};
	const washout: AdjustPreset = {
		id: 'recolorWashout',
		labelKey: `${KEY}.recolorWashout`,
		label: 'Washout',
		changes: (fx) => ({ ...recolorReset(fx), lum: { ...WASHOUT_LUM } }),
		applied: isWashout,
		preview: { css: 'brightness(1.7) contrast(0.3)' },
	};
	const biLevels = BI_LEVEL_THRESHOLDS.map((percent): AdjustPreset => ({
		id: `recolorBlackWhite${percent}`,
		labelKey: `${KEY}.recolorBlackWhite`,
		labelParams: { amount: percent },
		label: `Black and White: ${percent}%`,
		changes: (fx) => ({ ...recolorReset(fx), biLevel: percent }),
		applied: (fx) => fx.biLevel === percent,
		preview: { threshold: percent },
	}));
	const accents = RECOLOR_ACCENTS.flatMap((slot, index) => {
		const hex = resolveAccentHex(themeColorMap, slot);
		const n = index + 1;
		return (['dark', 'light'] as const).map((variant) =>
			duotonePreset(
				`recolorAccent${n}${variant === 'dark' ? 'Dark' : 'Light'}`,
				`${KEY}.recolorAccent${variant === 'dark' ? 'Dark' : 'Light'}`,
				`Accent ${n}, ${variant === 'dark' ? 'Dark' : 'Light'}`,
				accentDuotone(hex, variant),
				{ n },
			),
		);
	});
	return [
		none,
		grayscale,
		duotonePreset('recolorSepia', `${KEY}.recolorSepia`, 'Sepia', { ...SEPIA_DUOTONE }),
		washout,
		...biLevels,
		...accents,
	];
}

/** The Color gallery's sections; accent recolors follow the deck theme. */
export function pictureColorSections(ctx: RibbonGalleryContext): AdjustSection[] {
	return [
		{
			id: 'saturation',
			titleKey: `${KEY}.saturationTitle`,
			title: 'Color Saturation',
			columns: 3,
			presets: SATURATION_PERCENTS.map(saturationPreset),
		},
		{
			id: 'tone',
			titleKey: `${KEY}.toneTitle`,
			title: 'Color Tone',
			columns: 3,
			presets: TEMPERATURES_K.map(tonePreset),
		},
		{
			id: 'recolor',
			titleKey: `${KEY}.recolorTitle`,
			title: 'Recolor',
			columns: 4,
			presets: recolorPresets(ctx.themeColorMap),
		},
	];
}

export const PICTURE_COLOR_GALLERY = adjustGalleryModule(
	'pictureColor',
	`${KEY}.title`,
	'Color',
	pictureColorSections,
);
