import type { SmartArtStyle, XmlObject } from '../../types';

type LocalName = (key: string) => string;

function objectChild(node: XmlObject, name: string, localName: LocalName): XmlObject {
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	return value && typeof value === 'object' ? (value as XmlObject) : {};
}

/** Apply an explicit gallery choice to node style refs, preserving other diagram payloads. */
export function applySmartArtStyleIntensity(
	definition: XmlObject,
	intensity: SmartArtStyle | undefined,
	localName: LocalName,
): boolean {
	if (!intensity) {
		return false;
	}
	const key = Object.keys(definition).find((candidate) => localName(candidate) === 'styleLbl');
	const value = key ? definition[key] : undefined;
	const labels = Array.isArray(value) ? value : value ? [value] : [];
	let changed = false;
	for (const label of labels as XmlObject[]) {
		if (!/^node\d+$/u.test(String(label['@_name'] ?? ''))) {
			continue;
		}
		const styleKey =
			Object.keys(label).find((candidate) => localName(candidate) === 'style') ?? 'dgm:style';
		const style = objectChild(label, 'style', localName);
		for (const [name, idx] of [
			['fillRef', intensity === 'flat' ? 1 : intensity === 'moderate' ? 2 : 3],
			['effectRef', intensity === 'flat' ? 0 : intensity === 'moderate' ? 1 : 2],
		] as const) {
			const refKey =
				Object.keys(style).find((candidate) => localName(candidate) === name) ?? `a:${name}`;
			const ref = objectChild(style, name, localName);
			style[refKey] = {
				...(Object.keys(ref).length ? ref : { 'a:schemeClr': { '@_val': 'phClr' } }),
				'@_idx': String(idx),
			};
		}
		label[styleKey] = style;
		if (intensity !== 'intense') {
			const shape3dKey = Object.keys(label).find((candidate) => localName(candidate) === 'sp3d');
			if (shape3dKey) {
				label[shape3dKey] = {};
			}
		}
		changed = true;
	}
	return changed;
}
