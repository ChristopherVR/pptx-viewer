import type { PptxImageEffects, XmlObject } from '../../types';
import {
	buildSrgbColorChoice,
	colorsEqual,
	extractColorChoiceXml,
} from '../../utils/color-xml-preservation';

type ParseColor = (node: XmlObject | undefined) => string | undefined;

const localName = (key: string): string => key.split(':').at(-1) ?? key;

function child(parent: XmlObject | undefined, name: string): XmlObject | undefined {
	if (!parent) {
		return undefined;
	}
	const key = Object.keys(parent).find((candidate) => localName(candidate) === name);
	const value = key ? parent[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function setChild(parent: XmlObject, name: string, value: XmlObject | undefined): void {
	const key = Object.keys(parent).find((candidate) => localName(candidate) === name);
	if (key) {
		if (value) {
			parent[key] = value;
		} else {
			delete parent[key];
		}
	} else if (value) {
		parent[`a:${name}`] = value;
	}
}

function canonicalColor(parent: XmlObject | undefined): XmlObject | undefined {
	const choice = extractColorChoiceXml(parent);
	const [key, raw] = Object.entries(choice ?? {})[0] ?? [];
	if (!key || !raw || typeof raw !== 'object') {
		return undefined;
	}
	const node: XmlObject = {};
	for (const [childKey, value] of Object.entries(raw as XmlObject)) {
		node[childKey.startsWith('@_') ? childKey : `a:${localName(childKey)}`] = value;
	}
	return { [`a:${localName(key)}`]: node } as XmlObject;
}

function parsePercent(value: unknown, fixed: boolean): number | undefined {
	const text = String(value ?? '').trim();
	if (!text) {
		return undefined;
	}
	const strict = text.endsWith('%');
	const parsed = Number(strict ? text.slice(0, -1) : text) / (strict ? 1 : 1000);
	if (!Number.isFinite(parsed) || parsed < 0 || (fixed && parsed > 100)) {
		return undefined;
	}
	return parsed;
}

function percentXml(
	raw: XmlObject | undefined,
	attr: string,
	value: number,
	fixed: boolean,
	defaultValue?: number,
): XmlObject {
	const rawValue = raw?.[`@_${attr}`];
	if (
		raw &&
		((rawValue === undefined && value === defaultValue) || parsePercent(rawValue, fixed) === value)
	) {
		return raw;
	}
	const xml: XmlObject = { ...(raw ?? {}) };
	xml[`@_${attr}`] = String(Math.round(value * 1000));
	return xml;
}

export function parseImageAlphaEffects(
	blip: XmlObject,
	parseColor: ParseColor,
): Partial<PptxImageEffects> {
	const effects: PptxImageEffects = {};
	const modFix = child(blip, 'alphaModFix');
	if (modFix) {
		effects.alphaModFix = parsePercent(modFix['@_amt'], false) ?? 100;
		effects.alphaModFixRawXml = modFix;
	}
	const inverse = child(blip, 'alphaInv');
	if (inverse) {
		const color = parseColor(canonicalColor(inverse));
		effects.alphaInv = { ...(color ? { color } : {}), rawXml: inverse };
	}
	const ceiling = child(blip, 'alphaCeiling');
	if (ceiling) {
		effects.alphaCeiling = true;
		effects.alphaCeilingRawXml = ceiling;
	}
	const floor = child(blip, 'alphaFloor');
	if (floor) {
		effects.alphaFloor = true;
		effects.alphaFloorRawXml = floor;
	}
	const modulate = child(blip, 'alphaMod');
	if (modulate) {
		const cont = child(modulate, 'cont');
		effects.alphaMod = {
			...(cont ? { contRawXml: cont } : {}),
			rawXml: modulate,
		};
	}
	const replace = child(blip, 'alphaRepl');
	if (replace) {
		const alpha = parsePercent(replace['@_a'], true);
		if (alpha !== undefined) {
			effects.alphaRepl = alpha;
			effects.alphaReplRawXml = replace;
		}
	}
	const biLevel = child(blip, 'alphaBiLevel');
	if (biLevel) {
		const threshold = parsePercent(biLevel['@_thresh'], true);
		if (threshold !== undefined) {
			effects.alphaBiLevel = threshold;
			effects.alphaBiLevelRawXml = biLevel;
		}
	}
	return effects;
}

export function applyImageAlphaEffects(
	blip: XmlObject,
	effects: PptxImageEffects,
	parseColor: ParseColor,
): void {
	const modFix = effects.alphaModFix;
	setChild(
		blip,
		'alphaModFix',
		typeof modFix === 'number' && Number.isFinite(modFix) && modFix >= 0
			? percentXml(effects.alphaModFixRawXml, 'amt', modFix, false, 100)
			: undefined,
	);
	const inverse = effects.alphaInv;
	if (inverse) {
		const raw = inverse.rawXml;
		const original = parseColor(canonicalColor(raw));
		const node = { ...(raw ?? {}) };
		if (inverse.color && !colorsEqual(original, inverse.color)) {
			for (const key of Object.keys(node)) {
				if (extractColorChoiceXml({ [key]: node[key] } as XmlObject)) {
					delete node[key];
				}
			}
			Object.assign(node, buildSrgbColorChoice(inverse.color));
		}
		setChild(blip, 'alphaInv', node);
	} else {
		setChild(blip, 'alphaInv', undefined);
	}
	setChild(
		blip,
		'alphaCeiling',
		effects.alphaCeiling ? (effects.alphaCeilingRawXml ?? {}) : undefined,
	);
	setChild(blip, 'alphaFloor', effects.alphaFloor ? (effects.alphaFloorRawXml ?? {}) : undefined);
	if (effects.alphaMod) {
		const node = { ...(effects.alphaMod.rawXml ?? {}) };
		if (effects.alphaMod.contRawXml) {
			setChild(node, 'cont', effects.alphaMod.contRawXml as XmlObject);
		}
		if (child(node, 'cont') || effects.alphaMod.rawXml) {
			setChild(blip, 'alphaMod', node);
		} else {
			setChild(blip, 'alphaMod', undefined);
		}
	} else {
		setChild(blip, 'alphaMod', undefined);
	}
	const repl = effects.alphaRepl;
	setChild(
		blip,
		'alphaRepl',
		typeof repl === 'number' && Number.isFinite(repl) && repl >= 0 && repl <= 100
			? percentXml(effects.alphaReplRawXml, 'a', repl, true)
			: undefined,
	);
	const threshold = effects.alphaBiLevel;
	setChild(
		blip,
		'alphaBiLevel',
		typeof threshold === 'number' &&
			Number.isFinite(threshold) &&
			threshold >= 0 &&
			threshold <= 100
			? percentXml(effects.alphaBiLevelRawXml, 'thresh', threshold, true)
			: undefined,
	);
}
