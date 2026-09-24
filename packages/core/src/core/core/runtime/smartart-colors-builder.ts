import type { XmlObject } from '../../types';
import type { PptxSmartArtColorTransform } from '../../types/smart-art';
import { colorsEqual } from '../../utils/color-xml-preservation';
import {
	applySmartArtColorStyleLabels,
	applySmartArtDefinitionMetadata,
} from './smartart-definition-builder';

/** Resolve the local (prefix-stripped) name of an XML key. */
type LocalNameResolver = (key: string) => string;

/**
 * Resolve an authored colour-choice node (`{'a:schemeClr': {...}}`) to its hex
 * value, so an unedited themed colour can be recognised and left alone.
 */
export type SmartArtColorResolver = (node: XmlObject) => string | undefined;

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
 * `schemeClr` through the theme map), so writing it back unconditionally
 * severed the diagram from the theme: a plain load -> save of
 * `smartart-chart-table-mix.pptx` turned `a:schemeClr` into `a:srgbClr` in
 * `ppt/diagrams/colors*.xml` for diagrams nobody had edited. `resolveColor`
 * closes that: the authored node is still in the part being merged, so when it
 * still resolves to the hex the model holds there is no edit to write and the
 * node is left exactly as authored. Without a resolver (callers that have no
 * theme to resolve against) the old replace-always behaviour stands.
 *
 * When the colour HAS changed, the first colour element is replaced with an
 * explicit `a:srgbClr` regardless of its original element type and the old
 * colour key is removed. When the list has no colour child at all, a single
 * `a:srgbClr` is inserted.
 */
function applyColorToList(
	list: XmlObject,
	value: string,
	getLocalName: LocalNameResolver,
	resolveColor?: SmartArtColorResolver,
): void {
	const colorKey = Object.keys(list).find((k) => COLOR_LOCAL_NAMES.has(getLocalName(k)));
	const srgb: XmlObject = { '@_val': hex(value) };

	if (!colorKey) {
		list['a:srgbClr'] = srgb;
		return;
	}

	// Keep any trailing colour stops beyond the first.
	const existing = list[colorKey];
	if (resolveColor) {
		const authored = asObject(Array.isArray(existing) ? existing[0] : existing);
		const authoredHex = authored ? resolveColor({ [colorKey]: authored } as XmlObject) : undefined;
		if (authoredHex && colorsEqual(authoredHex, value)) {
			return;
		}
	}
	const rest = Array.isArray(existing)
		? existing.slice(1).filter((entry): entry is XmlObject => Boolean(asObject(entry)))
		: [];

	if (colorKey !== 'a:srgbClr') {
		delete list[colorKey];
	}
	list['a:srgbClr'] = rest.length > 0 ? [srgb, ...rest] : srgb;
}

/**
 * Merge a FULL resolved colour list (one entry per position, as produced by
 * `buildSmartArtColorRoleMap`/`buildSmartArtColorLists`) back into a
 * `fillClrLst` / `linClrLst`, comparing every position instead of only the
 * first.
 *
 * When every position still resolves to the same hex it was parsed with
 * (`resolveColor` unchanged at every index), the list is left completely
 * untouched, including its original element types (`a:schemeClr` etc.) --
 * this is what makes an edit to one `styleLbl`'s colours not bleed into an
 * untouched sibling `styleLbl` that merely shares the same list shape.
 *
 * When any position genuinely changed, the WHOLE list is re-emitted as
 * explicit `a:srgbClr` values from `values`. A parsed XML object cannot keep
 * two differently-named sibling elements (`a:schemeClr` then `a:srgbClr`) in
 * their original relative document order once they live under separate
 * object keys, so once one entry needs to change type the safest fix is a
 * uniform rebuild from the already-resolved hex values, never from the
 * stale, un-resolved authored nodes (writing an authored `{'@_val':
 * 'accent2'}` node under the `a:srgbClr` key -- i.e. literally
 * `<a:srgbClr val="accent2"/>` -- was the bug this replaces).
 */
function applyColorListValues(
	list: XmlObject,
	values: readonly string[],
	getLocalName: LocalNameResolver,
	resolveColor?: SmartArtColorResolver,
): boolean {
	if (values.length === 0) {
		return false;
	}
	const colorKey = Object.keys(list).find((k) => COLOR_LOCAL_NAMES.has(getLocalName(k)));
	const existingRaw = colorKey ? list[colorKey] : undefined;
	const existing = Array.isArray(existingRaw) ? existingRaw : existingRaw ? [existingRaw] : [];

	if (resolveColor && colorKey && existing.length === values.length) {
		const unchanged = existing.every((entryRaw, index) => {
			const entry = asObject(entryRaw);
			const authoredHex = entry ? resolveColor({ [colorKey]: entry } as XmlObject) : undefined;
			return authoredHex !== undefined && colorsEqual(authoredHex, values[index]);
		});
		if (unchanged) {
			return false;
		}
	}

	if (colorKey && colorKey !== 'a:srgbClr') {
		delete list[colorKey];
	}
	const srgbNodes = values.map((value) => ({ '@_val': hex(value) }));
	list['a:srgbClr'] = srgbNodes.length === 1 ? srgbNodes[0] : srgbNodes;
	return true;
}

/**
 * Merge each `styleLbl`'s OWN resolved colour list (keyed by role name, e.g.
 * `node1`, `parChTrans1D2`) back into that same label, per
 * `transform.roleColors`. This is the fix for the flat-index merge below,
 * which assigned `transform.fillColors[i]`/`lineColors[i]` to the i-th label
 * that merely HAS a fill/line list -- but `fillColors`/`lineColors` are only
 * the PRIMARY node role's cycling palette (see
 * `PptxSmartArtColorTransform.fillColors`), so on a plain, unedited
 * multi-label diagram that flat index silently reassigned every OTHER
 * label's first colour to the wrong slot of the primary palette.
 */
function applyRoleColors(
	labels: XmlObject[],
	roleColors: Record<string, { fill: string[]; line: string[] }>,
	getLocalName: LocalNameResolver,
	resolveColor?: SmartArtColorResolver,
): boolean {
	let mutated = false;
	for (const label of labels) {
		const name = String(label['@_name'] ?? '').trim();
		const role = name ? roleColors[name] : undefined;
		if (!role) {
			continue;
		}
		const fillKey = findKey(label, 'fillClrLst', getLocalName);
		if (fillKey) {
			const list = asObject(label[fillKey]);
			if (list && applyColorListValues(list, role.fill, getLocalName, resolveColor)) {
				mutated = true;
			}
		}
		const lineKey = findKey(label, 'linClrLst', getLocalName);
		if (lineKey) {
			const list = asObject(label[lineKey]);
			if (list && applyColorListValues(list, role.line, getLocalName, resolveColor)) {
				mutated = true;
			}
		}
	}
	return mutated;
}

/**
 * Surgically merge the in-memory colour transform back into the parsed
 * `colorsDef` element of a `ppt/diagrams/colors*.xml` part.
 *
 * When `transform.roleColors` is present (the normal case: every real parse
 * populates it via `buildSmartArtColorRoleMap`), each `styleLbl` is merged
 * from ITS OWN resolved colour list, matched by role name
 * ({@link applyRoleColors}). `transform.fillColors`/`lineColors` are only the
 * PRIMARY node role's cycling palette (used for rendering), so a label-index
 * based merge silently reassigned every OTHER label's colour to the wrong
 * slot of that unrelated palette on a plain, unedited round-trip.
 *
 * Without `roleColors` (a hand-built transform that never went through a real
 * parse), the merge falls back to the legacy behaviour: one ordered colour
 * per `styleLbl` that carries a `fillClrLst` / `linClrLst`, for the i-th such
 * label the first fill colour is overwritten with `fillColors[i]`; likewise
 * for line colours. Labels without a corresponding list, and lists with no
 * in-memory colour at that index, are left untouched. Everything else
 * (uniqueId, title/desc, ext lists, effect refs, per-label attributes) is
 * preserved verbatim -- `title` is a `CT_ColorTransform` CHILD ELEMENT
 * (`<dgm:title val="..."/>`) per ECMA-376, not an attribute, and nothing in
 * the editing UI ever renames a colour scheme, so it is never rewritten here.
 *
 * @returns true when at least one field was written, false when nothing
 *          changed (so the caller can skip rewriting the part).
 */
export function applySmartArtColorTransform(
	colorsDef: XmlObject,
	transform: PptxSmartArtColorTransform | undefined,
	getLocalName: LocalNameResolver,
	resolveColor?: SmartArtColorResolver,
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

	if (transform.roleColors) {
		return applyRoleColors(labels, transform.roleColors, getLocalName, resolveColor) || mutated;
	}

	let fillIndex = 0;
	let lineIndex = 0;
	for (const label of labels) {
		const fillKey = findKey(label, 'fillClrLst', getLocalName);
		if (fillKey) {
			const value = transform.fillColors[fillIndex++];
			const list = asObject(label[fillKey]);
			if (list && value) {
				applyColorToList(list, value, getLocalName, resolveColor);
				mutated = true;
			}
		}

		const lineKey = findKey(label, 'linClrLst', getLocalName);
		if (lineKey) {
			const value = transform.lineColors[lineIndex++];
			const list = asObject(label[lineKey]);
			if (list && value) {
				applyColorToList(list, value, getLocalName, resolveColor);
				mutated = true;
			}
		}
	}

	return mutated;
}
