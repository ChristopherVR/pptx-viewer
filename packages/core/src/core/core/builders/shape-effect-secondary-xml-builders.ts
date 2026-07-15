import type { ShapeStyle, XmlObject } from '../../types';

interface Context {
	emuPerPx: number;
	clampUnitInterval: (value: number) => number;
}

export function buildSoftEdgeXml(style: ShapeStyle, emuPerPx: number): XmlObject | undefined {
	const radius = style.softEdgeRadius;
	return typeof radius === 'number' && Number.isFinite(radius) && radius > 0
		? { '@_rad': String(Math.round(radius * emuPerPx)) }
		: undefined;
}

export function buildReflectionXml(style: ShapeStyle, context: Context): XmlObject | undefined {
	const numericValues = [
		style.reflectionBlurRadius,
		style.reflectionStartOpacity,
		style.reflectionDistance,
	];
	if (
		!numericValues.some((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
	) {
		return undefined;
	}
	const xml: XmlObject = {};
	const fixed = (value: number) => String(Math.round(context.clampUnitInterval(value) * 100000));
	const numberAttr = (name: string, value: number | undefined, multiplier = 1) => {
		if (typeof value === 'number' && Number.isFinite(value)) {
			xml[`@_${name}`] = String(Math.round(value * multiplier));
		}
	};
	if (
		typeof style.reflectionBlurRadius === 'number' &&
		Number.isFinite(style.reflectionBlurRadius) &&
		style.reflectionBlurRadius > 0
	) {
		numberAttr('blurRad', style.reflectionBlurRadius, context.emuPerPx);
	}
	if (typeof style.reflectionStartOpacity === 'number') {
		xml['@_stA'] = fixed(style.reflectionStartOpacity);
	}
	if (typeof style.reflectionEndOpacity === 'number') {
		xml['@_endA'] = fixed(style.reflectionEndOpacity);
	}
	if (typeof style.reflectionStartPosition === 'number') {
		xml['@_stPos'] = fixed(style.reflectionStartPosition);
	}
	if (typeof style.reflectionEndPosition === 'number') {
		xml['@_endPos'] = fixed(style.reflectionEndPosition);
	}
	numberAttr('dir', style.reflectionDirection, 60000);
	numberAttr('rot', style.reflectionRotation, 60000);
	numberAttr('fadeDir', style.reflectionFadeDirection, 60000);
	numberAttr('sx', style.reflectionScaleX);
	numberAttr('sy', style.reflectionScaleY);
	numberAttr('kx', style.reflectionSkewX);
	numberAttr('ky', style.reflectionSkewY);
	if (
		typeof style.reflectionDistance === 'number' &&
		Number.isFinite(style.reflectionDistance) &&
		style.reflectionDistance > 0
	) {
		numberAttr('dist', style.reflectionDistance, context.emuPerPx);
	}
	if (style.reflectionAlignment) {
		xml['@_algn'] = style.reflectionAlignment;
	}
	if (typeof style.reflectionRotateWithShape === 'boolean') {
		xml['@_rotWithShape'] = style.reflectionRotateWithShape ? '1' : '0';
	}
	return xml;
}

export function buildBlurXml(style: ShapeStyle, emuPerPx: number): XmlObject | undefined {
	const radius = style.blurRadius;
	return typeof radius === 'number' && Number.isFinite(radius) && radius > 0
		? { '@_rad': String(Math.round(radius * emuPerPx)), '@_grow': style.blurGrow ? '1' : '0' }
		: undefined;
}

export function buildLineEffectListXml(style: ShapeStyle, context: Context): XmlObject | undefined {
	const list: XmlObject = {};
	const shadowColor = String(style.lineShadowColor || '').trim();
	if (shadowColor && shadowColor !== 'transparent') {
		const x = typeof style.lineShadowOffsetX === 'number' ? style.lineShadowOffsetX : 2;
		const y = typeof style.lineShadowOffsetY === 'number' ? style.lineShadowOffsetY : 2;
		const blur = typeof style.lineShadowBlur === 'number' ? Math.max(0, style.lineShadowBlur) : 4;
		const opacity = context.clampUnitInterval(style.lineShadowOpacity ?? 0.35);
		list['a:outerShdw'] = {
			'@_blurRad': String(Math.round(blur * context.emuPerPx)),
			'@_dist': String(Math.round(Math.hypot(x, y) * context.emuPerPx)),
			'@_dir': String(Math.round((((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) * 60000)),
			'a:srgbClr': colorXml(shadowColor, opacity),
		};
	}
	const glowColor = String(style.lineGlowColor || '').trim();
	const glowRadius = style.lineGlowRadius;
	if (
		glowColor &&
		glowColor !== 'transparent' &&
		typeof glowRadius === 'number' &&
		Number.isFinite(glowRadius) &&
		glowRadius > 0
	) {
		list['a:glow'] = {
			'@_rad': String(Math.round(glowRadius * context.emuPerPx)),
			'a:srgbClr': colorXml(glowColor, context.clampUnitInterval(style.lineGlowOpacity ?? 0.4)),
		};
	}
	return Object.keys(list).length > 0 ? list : undefined;
}

function colorXml(color: string, opacity: number): XmlObject {
	return {
		'@_val': color.replace('#', ''),
		'a:alpha': { '@_val': String(Math.round(opacity * 100000)) },
	};
}
