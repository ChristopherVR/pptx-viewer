import type { PptxImageEffects, XmlObject } from '../../types';
import {
	buildSrgbColorChoice,
	colorsEqual,
	extractColorChoiceXml,
} from '../../utils/color-xml-preservation';

type ParseColor = (node: XmlObject | undefined) => string | undefined;
type ExtractOpacity = (node: XmlObject | undefined) => number | undefined;

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

function colorChoices(parent: XmlObject): XmlObject[] {
	const choices: XmlObject[] = [];
	for (const [key, value] of Object.entries(parent)) {
		if (
			!['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr'].includes(localName(key))
		) {
			continue;
		}
		for (const item of Array.isArray(value) ? value : [value]) {
			if (item && typeof item === 'object') {
				choices.push({ [key]: item } as XmlObject);
			}
		}
	}
	return choices;
}

function canonicalColor(parent: XmlObject | undefined): XmlObject | undefined {
	const choice = extractColorChoiceXml(parent);
	if (!choice) {
		return undefined;
	}
	const [key, raw] = Object.entries(choice)[0] ?? [];
	if (!key || !raw || typeof raw !== 'object') {
		return undefined;
	}
	const node: XmlObject = {};
	for (const [childKey, value] of Object.entries(raw as XmlObject)) {
		node[childKey.startsWith('@_') ? childKey : `a:${localName(childKey)}`] = value;
	}
	return { [`a:${localName(key)}`]: node } as XmlObject;
}

function resolveColor(parent: XmlObject | undefined, parseColor: ParseColor): string | undefined {
	return parseColor(canonicalColor(parent));
}

function opacity(
	parent: XmlObject | undefined,
	extractOpacity: ExtractOpacity,
): number | undefined {
	return extractOpacity(canonicalColor(parent));
}

export function parseImageColorEffects(
	blip: XmlObject,
	parseColor: ParseColor,
	extractOpacity: ExtractOpacity,
): Pick<
	PptxImageEffects,
	| 'grayscale'
	| 'grayscaleRawXml'
	| 'biLevel'
	| 'biLevelRawXml'
	| 'clrChange'
	| 'clrRepl'
	| 'duotone'
> {
	const result: PptxImageEffects = {};
	const grayscale = child(blip, 'grayscl');
	if (grayscale) {
		result.grayscale = true;
		result.grayscaleRawXml = grayscale;
	}
	const biLevel = child(blip, 'biLevel');
	if (biLevel) {
		const threshold = Number(biLevel['@_thresh']);
		if (Number.isFinite(threshold)) {
			result.biLevel = threshold / 1000;
		}
		result.biLevelRawXml = biLevel;
	}
	const change = child(blip, 'clrChange');
	const from = child(change, 'clrFrom');
	const to = child(change, 'clrTo');
	if (change && from && to) {
		result.clrChange = {
			clrFrom: resolveColor(from, parseColor) ?? '#000000',
			clrTo: resolveColor(to, parseColor) ?? '#FFFFFF',
			clrToTransparent: (opacity(to, extractOpacity) ?? 1) <= 0,
			rawXml: change,
		};
	}
	const replace = child(blip, 'clrRepl');
	const replacement = resolveColor(replace, parseColor);
	if (replace && replacement) {
		result.clrRepl = { color: replacement, rawXml: replace };
	}
	const duotone = child(blip, 'duotone');
	if (duotone) {
		const colors = colorChoices(duotone).map((color) => resolveColor(color, parseColor));
		if (colors[0] && colors[1]) {
			result.duotone = { color1: colors[0], color2: colors[1], rawXml: duotone };
		}
	}
	return result;
}

function sameRawColor(raw: XmlObject | undefined, value: string, parseColor: ParseColor): boolean {
	return colorsEqual(resolveColor(raw, parseColor), value);
}

function mergeWrapper(original: XmlObject | undefined, colors: XmlObject): XmlObject {
	const merged: XmlObject = { ...(original ?? {}) };
	for (const key of Object.keys(merged)) {
		if (extractColorChoiceXml({ [key]: merged[key] } as XmlObject)) {
			delete merged[key];
		}
	}
	const extKey = Object.keys(merged).find((key) => localName(key) === 'extLst');
	const ext = extKey ? merged[extKey] : undefined;
	if (extKey) {
		delete merged[extKey];
	}
	Object.assign(merged, colors);
	if (extKey) {
		merged[extKey] = ext;
	}
	return merged;
}

function setChild(parent: XmlObject, name: string, value: XmlObject | undefined): void {
	const key = Object.keys(parent).find((candidate) => localName(candidate) === name);
	if (key) {
		if (value) {
			parent[key] = value;
		} else {
			delete parent[key];
		}
		return;
	}
	if (!value) {
		return;
	}
	const extKey = Object.keys(parent).find((candidate) => localName(candidate) === 'extLst');
	const ext = extKey ? parent[extKey] : undefined;
	if (extKey) {
		delete parent[extKey];
	}
	parent[`a:${name}`] = value;
	if (extKey) {
		parent[extKey] = ext;
	}
}

export function applyImageColorEffects(
	blip: XmlObject,
	effects: PptxImageEffects,
	parseColor: ParseColor,
	extractOpacity: ExtractOpacity,
): void {
	setChild(blip, 'grayscl', effects.grayscale ? (effects.grayscaleRawXml ?? {}) : undefined);
	let biLevel: XmlObject | undefined;
	if (typeof effects.biLevel === 'number' && Number.isFinite(effects.biLevel)) {
		const threshold = String(Math.round(Math.max(0, Math.min(100, effects.biLevel)) * 1000));
		biLevel = { ...(effects.biLevelRawXml ?? {}), '@_thresh': threshold };
	}
	setChild(blip, 'biLevel', biLevel);

	const change = effects.clrChange;
	if (change) {
		const rawFrom = child(change.rawXml, 'clrFrom');
		const rawTo = child(change.rawXml, 'clrTo');
		const rawTransparent = rawTo ? (opacity(rawTo, extractOpacity) ?? 1) <= 0 : undefined;
		const unchanged =
			sameRawColor(rawFrom, change.clrFrom, parseColor) &&
			sameRawColor(rawTo, change.clrTo, parseColor) &&
			(rawTransparent === undefined || change.clrToTransparent === rawTransparent);
		if (unchanged && change.rawXml) {
			setChild(blip, 'clrChange', change.rawXml);
		} else {
			const fromChoice = sameRawColor(rawFrom, change.clrFrom, parseColor)
				? extractColorChoiceXml(rawFrom)
				: buildSrgbColorChoice(change.clrFrom);
			const preserveTo =
				sameRawColor(rawTo, change.clrTo, parseColor) && rawTransparent === change.clrToTransparent;
			const toChoice = preserveTo
				? extractColorChoiceXml(rawTo)
				: buildSrgbColorChoice(change.clrTo, change.clrToTransparent ? 0 : undefined);
			const node = { ...(change.rawXml ?? {}) } as XmlObject;
			setChild(node, 'clrFrom', mergeWrapper(rawFrom, fromChoice ?? {}));
			setChild(node, 'clrTo', mergeWrapper(rawTo, toChoice ?? {}));
			setChild(blip, 'clrChange', node);
		}
	} else {
		setChild(blip, 'clrChange', undefined);
	}

	const replacement = effects.clrRepl;
	if (replacement) {
		const raw = replacement.rawXml as XmlObject | undefined;
		setChild(
			blip,
			'clrRepl',
			sameRawColor(raw, replacement.color, parseColor) && raw
				? raw
				: mergeWrapper(raw, buildSrgbColorChoice(replacement.color)),
		);
	} else {
		setChild(blip, 'clrRepl', undefined);
	}

	const duo = effects.duotone;
	if (duo) {
		const originals = duo.rawXml ? colorChoices(duo.rawXml) : [];
		if (
			duo.rawXml &&
			sameRawColor(originals[0], duo.color1, parseColor) &&
			sameRawColor(originals[1], duo.color2, parseColor)
		) {
			setChild(blip, 'duotone', duo.rawXml);
		} else {
			setChild(
				blip,
				'duotone',
				mergeWrapper(duo.rawXml, {
					'a:srgbClr': [
						{ '@_val': duo.color1.replace(/^#/u, '') },
						{ '@_val': duo.color2.replace(/^#/u, '') },
					],
				}),
			);
		}
	} else {
		setChild(blip, 'duotone', undefined);
	}
}
