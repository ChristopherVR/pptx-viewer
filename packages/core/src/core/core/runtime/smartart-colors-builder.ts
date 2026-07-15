import type { XmlObject } from '../../types';
import type { PptxSmartArtColorTransform } from '../../types/smart-art';
import {
	applySmartArtColorStyleLabels,
	applySmartArtDefinitionMetadata,
} from './smartart-definition-builder';

/** Resolve the local (prefix-stripped) name of an XML key. */
type LocalNameResolver = (key: string) => string;

/** Treat a value as an XmlObject, or undefined when it is not one. */
function asObject(value: unknown): XmlObject | undefined {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

/** Normalise a parsed child (object or array) to an array of XmlObjects. */
function toArray(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value.filter((entry): entry is XmlObject => Boolean(asObject(entry)));
	}
	const obj = asObject(value);
	return obj ? [obj] : [];
}

/** Find the first key on `obj` whose local name matches `name`. */
function findKey(
	obj: XmlObject,
	name: string,
	getLocalName: LocalNameResolver,
): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === name);
}

/** Strip a leading `#` from a hex colour. */
function hex(value: string): string {
	return value.replace('#', '');
}

const COLOR_LOCAL_NAMES: ReadonlySet<string> = new Set([
	'srgbClr',
	'schemeClr',
	'sysClr',
	'prstClr',
	'scrgbClr',
	'hslClr',
]);

/**
 * Overwrite the FIRST colour child of a `fillClrLst` / `linClrLst` with an
 * `a:srgbClr` carrying the resolved hex `value`, preserving the list's own
 * attributes and any trailing colours beyond the first.
 *
 * The in-memory colour is an already-resolved hex (the loader resolved any
 * `schemeClr` through the theme map), so the first colour element is replaced
 * with an explicit `a:srgbClr` regardless of its original element type, and the
 * old colour key is removed when it differs. When the list has no colour child
 * at all, a single `a:srgbClr` is inserted.
 */
function applyColorToList(list: XmlObject, value: string, getLocalName: LocalNameResolver): void {
	const colorKey = Object.keys(list).find((k) => COLOR_LOCAL_NAMES.has(getLocalName(k)));
	const srgb: XmlObject = { '@_val': hex(value) };

	if (!colorKey) {
		list['a:srgbClr'] = srgb;
		return;
	}

	// Keep any trailing colour stops beyond the first.
	const existing = list[colorKey];
	const rest = Array.isArray(existing)
		? existing.slice(1).filter((entry): entry is XmlObject => Boolean(asObject(entry)))
		: [];

	if (colorKey !== 'a:srgbClr') {
		delete list[colorKey];
	}
	list['a:srgbClr'] = rest.length > 0 ? [srgb, ...rest] : srgb;
}

/**
 * Surgically merge the in-memory colour transform back into the parsed
 * `colorsDef` element of a `ppt/diagrams/colors*.xml` part.
 *
 * The merge mirrors the parse (one ordered colour per `styleLbl` that carries a
 * `fillClrLst` / `linClrLst`): for the i-th label with a fill list, the first
 * fill colour is overwritten with `fillColors[i]`; likewise for line colours.
 * Labels without a corresponding list, and lists with no in-memory colour at
 * that index, are left untouched. Everything else (uniqueId, title/desc, ext
 * lists, effect refs, per-label attributes) is preserved verbatim -- `title`
 * is a `CT_ColorTransform` CHILD ELEMENT (`<dgm:title val="..."/>`) per
 * ECMA-376, not an attribute, and nothing in the editing UI ever renames a
 * colour scheme, so it is never rewritten here.
 *
 * @returns true when at least one field was written, false when nothing
 *          changed (so the caller can skip rewriting the part).
 */
export function applySmartArtColorTransform(
	colorsDef: XmlObject,
	transform: PptxSmartArtColorTransform | undefined,
	getLocalName: LocalNameResolver,
): boolean {
	if (!transform) {
		return false;
	}

	let mutated = false;
	mutated = applySmartArtDefinitionMetadata(colorsDef, transform, getLocalName) || mutated;
	mutated = applySmartArtColorStyleLabels(colorsDef, transform.labels, getLocalName) || mutated;

	const styleLblKey = findKey(colorsDef, 'styleLbl', getLocalName);
	if (!styleLblKey) {
		return mutated;
	}
	const labels = toArray(colorsDef[styleLblKey]);
	if (labels.length === 0) {
		return mutated;
	}

	let fillIndex = 0;
	let lineIndex = 0;
	for (const label of labels) {
		const fillKey = findKey(label, 'fillClrLst', getLocalName);
		if (fillKey) {
			const value = transform.fillColors[fillIndex++];
			const list = asObject(label[fillKey]);
			if (list && value) {
				applyColorToList(list, value, getLocalName);
				mutated = true;
			}
		}

		const lineKey = findKey(label, 'linClrLst', getLocalName);
		if (lineKey) {
			const value = transform.lineColors[lineIndex++];
			const list = asObject(label[lineKey]);
			if (list && value) {
				applyColorToList(list, value, getLocalName);
				mutated = true;
			}
		}
	}

	return mutated;
}
