import type { XmlObject, TextStyle } from '../../types';

const EMU_PER_PX = 9525;

/**
 * Build an `a:effectLst` XML object for text run effects.
 * Returns `undefined` if no effects are present.
 */
export function buildTextRunEffectListXml(
	style: TextStyle,
): XmlObject | undefined {
	const hasTextShadow =
		!!style.textShadowColor ||
		(typeof style.textShadowBlur === 'number' && style.textShadowBlur > 0);
	const hasTextInnerShadow =
		!!style.textInnerShadowColor ||
		(typeof style.textInnerShadowBlur === 'number' &&
			style.textInnerShadowBlur > 0);
	const hasTextPresetShadow = !!style.textPresetShadowName;
	const hasTextGlow =
		!!style.textGlowColor ||
		(typeof style.textGlowRadius === 'number' && style.textGlowRadius > 0);
	const hasTextReflection = !!style.textReflection;
	const hasTextBlur =
		typeof style.textBlurRadius === 'number' && style.textBlurRadius > 0;
	const hasTextAlphaModFix = typeof style.textAlphaModFix === 'number';
	const hasTextAlphaMod = typeof style.textAlphaMod === 'number';
	const hasTextHsl =
		typeof style.textHslHue === 'number' ||
		typeof style.textHslSaturation === 'number' ||
		typeof style.textHslLuminance === 'number';
	const hasTextClrChange =
		!!style.textClrChangeFrom && !!style.textClrChangeTo;
	const hasTextDuotone = !!style.textDuotone;

	const hasAny =
		hasTextShadow ||
		hasTextInnerShadow ||
		hasTextPresetShadow ||
		hasTextGlow ||
		hasTextReflection ||
		hasTextBlur ||
		hasTextAlphaModFix ||
		hasTextAlphaMod ||
		hasTextHsl ||
		hasTextClrChange ||
		hasTextDuotone;

	if (!hasAny) return undefined;

	const effectLst: XmlObject = {};

	if (hasTextShadow) {
		effectLst['a:outerShdw'] = buildOuterShadowNode(style);
	}
	if (hasTextInnerShadow) {
		effectLst['a:innerShdw'] = buildInnerShadowNode(style);
	}
	if (hasTextPresetShadow) {
		effectLst['a:prstShdw'] = buildPresetShadowNode(style);
	}
	if (hasTextGlow) {
		effectLst['a:glow'] = buildGlowNode(style);
	}
	if (hasTextReflection) {
		effectLst['a:reflection'] = buildReflectionNode(style);
	}
	if (hasTextBlur) {
		effectLst['a:blur'] = {
			'@_rad': String(
				Math.round((style.textBlurRadius ?? 0) * EMU_PER_PX),
			),
		};
	}
	if (hasTextAlphaModFix) {
		effectLst['a:alphaModFix'] = {
			'@_amt': String(Math.round((style.textAlphaModFix ?? 100) * 1000)),
		};
	}
	if (hasTextAlphaMod) {
		effectLst['a:alphaMod'] = {
			'@_amt': String(Math.round((style.textAlphaMod ?? 100) * 1000)),
		};
	}
	if (hasTextHsl) {
		effectLst['a:hsl'] = buildHslNode(style);
	}
	if (hasTextClrChange) {
		effectLst['a:clrChange'] = buildClrChangeNode(style);
	}
	if (hasTextDuotone && style.textDuotone) {
		effectLst['a:duotone'] = {
			'a:srgbClr': [
				{ '@_val': style.textDuotone.color1.replace('#', '') },
				{ '@_val': style.textDuotone.color2.replace('#', '') },
			],
		};
	}

	return effectLst;
}

function buildShadowColorNode(
	hex: string,
	opacity: number | undefined,
): XmlObject {
	const clr = hex.replace('#', '');
	const alpha =
		typeof opacity === 'number'
			? Math.round(opacity * 100000)
			: undefined;
	return {
		'@_val': clr,
		...(alpha !== undefined
			? { 'a:alpha': { '@_val': String(alpha) } }
			: {}),
	};
}

function distAndDir(
	ox: number,
	oy: number,
): { dist: number; dir: number } {
	const dist = Math.sqrt(ox * ox + oy * oy);
	const dir = (Math.atan2(oy, ox) * 180) / Math.PI;
	return { dist, dir };
}

function buildOuterShadowNode(style: TextStyle): XmlObject {
	const ox = style.textShadowOffsetX ?? 0;
	const oy = style.textShadowOffsetY ?? 0;
	const { dist, dir } = distAndDir(ox, oy);
	return {
		'@_blurRad': String(
			Math.round((style.textShadowBlur ?? 4) * EMU_PER_PX),
		),
		'@_dist': String(Math.round(dist * EMU_PER_PX)),
		'@_dir': String(Math.round(dir * 60000)),
		'a:srgbClr': buildShadowColorNode(
			style.textShadowColor || '#000000',
			style.textShadowOpacity,
		),
	};
}

function buildInnerShadowNode(style: TextStyle): XmlObject {
	const ox = style.textInnerShadowOffsetX ?? 0;
	const oy = style.textInnerShadowOffsetY ?? 0;
	const { dist, dir } = distAndDir(ox, oy);
	return {
		'@_blurRad': String(
			Math.round((style.textInnerShadowBlur ?? 3) * EMU_PER_PX),
		),
		'@_dist': String(Math.round(dist * EMU_PER_PX)),
		'@_dir': String(Math.round(dir * 60000)),
		'a:srgbClr': buildShadowColorNode(
			style.textInnerShadowColor || '#000000',
			style.textInnerShadowOpacity,
		),
	};
}

function buildPresetShadowNode(style: TextStyle): XmlObject {
	const node: XmlObject = {
		'@_prst': style.textPresetShadowName,
	};
	if (typeof style.textPresetShadowDistance === 'number') {
		node['@_dist'] = String(
			Math.round(style.textPresetShadowDistance * EMU_PER_PX),
		);
	}
	if (typeof style.textPresetShadowDirection === 'number') {
		node['@_dir'] = String(
			Math.round(style.textPresetShadowDirection * 60000),
		);
	}
	if (style.textPresetShadowColor) {
		node['a:srgbClr'] = buildShadowColorNode(
			style.textPresetShadowColor,
			style.textPresetShadowOpacity,
		);
	}
	return node;
}

function buildGlowNode(style: TextStyle): XmlObject {
	return {
		'@_rad': String(
			Math.round((style.textGlowRadius ?? 6) * EMU_PER_PX),
		),
		'a:srgbClr': buildShadowColorNode(
			style.textGlowColor || '#ffff00',
			style.textGlowOpacity,
		),
	};
}

function buildReflectionNode(style: TextStyle): XmlObject {
	const refl: XmlObject = {};
	if (typeof style.textReflectionBlur === 'number') {
		refl['@_blurRad'] = String(
			Math.round(style.textReflectionBlur * EMU_PER_PX),
		);
	}
	if (typeof style.textReflectionStartOpacity === 'number') {
		refl['@_stA'] = String(
			Math.round(style.textReflectionStartOpacity * 100000),
		);
	}
	if (typeof style.textReflectionEndOpacity === 'number') {
		refl['@_endA'] = String(
			Math.round(style.textReflectionEndOpacity * 100000),
		);
	}
	if (typeof style.textReflectionOffset === 'number') {
		refl['@_dist'] = String(
			Math.round(style.textReflectionOffset * EMU_PER_PX),
		);
	}
	return refl;
}

function buildHslNode(style: TextStyle): XmlObject {
	const node: XmlObject = {};
	if (typeof style.textHslHue === 'number') {
		node['@_hue'] = String(Math.round(style.textHslHue * 60000));
	}
	if (typeof style.textHslSaturation === 'number') {
		node['@_sat'] = String(Math.round(style.textHslSaturation * 1000));
	}
	if (typeof style.textHslLuminance === 'number') {
		node['@_lum'] = String(Math.round(style.textHslLuminance * 1000));
	}
	return node;
}

function buildClrChangeNode(style: TextStyle): XmlObject {
	return {
		'a:clrFrom': {
			'a:srgbClr': {
				'@_val': (style.textClrChangeFrom || '').replace('#', ''),
			},
		},
		'a:clrTo': {
			'a:srgbClr': {
				'@_val': (style.textClrChangeTo || '').replace('#', ''),
			},
		},
	};
}
