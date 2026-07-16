import type {
	EffectDagAlphaOutset,
	EffectDagBlur,
	EffectDagPresetShadow,
	XmlObject,
} from '../../types';

const PRESET_SHADOW = /^shdw(?:[1-9]|1\d|20)$/;

export function parseEffectDagBlur(value: unknown): EffectDagBlur | undefined {
	const xml = asXml(value);
	if (!xml) {
		return undefined;
	}
	const effect: EffectDagBlur = { kind: 'blur', xml };
	const radius = nonNegativeInteger(xml['@_rad']);
	if (radius !== undefined) {
		effect.radiusEmu = radius;
	}
	const grow = parseBoolean(xml['@_grow']);
	if (grow !== undefined) {
		effect.grow = grow;
	}
	return effect;
}

export function parseEffectDagPresetShadow(value: unknown): EffectDagPresetShadow | undefined {
	const xml = asXml(value);
	if (!xml) {
		return undefined;
	}
	const effect: EffectDagPresetShadow = { kind: 'prstShdw', xml };
	const preset = String(xml['@_prst'] ?? '').trim();
	if (PRESET_SHADOW.test(preset)) {
		effect.preset = preset as `shdw${number}`;
	}
	const distance = nonNegativeInteger(xml['@_dist']);
	if (distance !== undefined) {
		effect.distanceEmu = distance;
	}
	const direction = positiveFixedAngle(xml['@_dir']);
	if (direction !== undefined) {
		effect.direction = direction;
	}
	return effect;
}

export function parseEffectDagAlphaOutset(value: unknown): EffectDagAlphaOutset | undefined {
	const xml = asXml(value);
	if (!xml) {
		return undefined;
	}
	const effect: EffectDagAlphaOutset = { kind: 'alphaOutset', xml };
	const radius = coordinate(xml['@_rad']);
	if (radius !== undefined) {
		effect.radiusEmu = radius;
	} else if (xml['@_rad'] === undefined) {
		effect.radiusEmu = 0;
	}
	return effect;
}

export function serializeEffectDagBlur(effect: EffectDagBlur): XmlObject {
	const xml = { ...effect.xml };
	writeInteger(xml, 'rad', effect.radiusEmu, true);
	if (effect.grow !== undefined) {
		xml['@_grow'] = effect.grow ? '1' : '0';
	}
	return xml;
}

export function serializeEffectDagPresetShadow(effect: EffectDagPresetShadow): XmlObject {
	const xml = { ...effect.xml };
	if (effect.preset !== undefined && PRESET_SHADOW.test(effect.preset)) {
		xml['@_prst'] = effect.preset;
	}
	writeInteger(xml, 'dist', effect.distanceEmu, true);
	if (
		effect.direction !== undefined &&
		Number.isSafeInteger(effect.direction) &&
		effect.direction >= 0 &&
		effect.direction < 21600000
	) {
		xml['@_dir'] = String(effect.direction);
	}
	return xml;
}

export function serializeEffectDagAlphaOutset(effect: EffectDagAlphaOutset): XmlObject {
	const xml = { ...effect.xml };
	if (effect.radiusEmu === 0 && effect.xml['@_rad'] === undefined) {
		return xml;
	}
	if (coordinate(effect.radiusEmu) !== undefined) {
		xml['@_rad'] = String(effect.radiusEmu);
	}
	return xml;
}

function asXml(value: unknown): XmlObject | undefined {
	return value !== null && typeof value === 'object' ? (value as XmlObject) : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
	const parsed = integer(value);
	return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}

function integer(value: unknown): number | undefined {
	if (value === undefined || value === null || !/^-?\d+$/.test(String(value))) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function coordinate(value: unknown): number | undefined {
	const parsed = integer(value);
	return parsed !== undefined && parsed >= -27273042329600 && parsed <= 27273042316900
		? parsed
		: undefined;
}

function positiveFixedAngle(value: unknown): number | undefined {
	const parsed = integer(value);
	return parsed !== undefined && parsed >= 0 && parsed < 21600000 ? parsed : undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	if (normalized === '1' || normalized === 'true') {
		return true;
	}
	if (normalized === '0' || normalized === 'false') {
		return false;
	}
	return undefined;
}

function writeInteger(
	xml: XmlObject,
	name: string,
	value: number | undefined,
	nonNegative: boolean,
): void {
	if (value === undefined || !Number.isSafeInteger(value) || (nonNegative && value < 0)) {
		return;
	}
	xml[`@_${name}`] = String(value);
}
