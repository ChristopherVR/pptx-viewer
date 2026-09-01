import type { XmlObject } from '../../types';

/**
 * Prefix-insensitive XML access shared by the `a14` picture-extension reader
 * (`image-a14-effects.ts`) and writer (`image-a14-effects-writer.ts`).
 *
 * Real packages bind the drawing-2010 namespace to `a14`, but a hand-written
 * or re-serialised part may use another prefix, so every lookup here matches
 * on the LOCAL name only.
 */

/** URI of the `a14` image-properties blip extension. */
export const A14_IMAGE_PROPS_EXT_URI = '{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}';

/**
 * The drawing-2010 (`a14`) namespace. PowerPoint declares it ON the
 * `a14:imgProps` element rather than on the slide root, so the writer does the
 * same and needs no `mc:Ignorable` plumbing: the `a:ext/@uri` envelope is what
 * makes the extension skippable for a consumer that does not know it.
 */
export const A14_NAMESPACE = 'http://schemas.microsoft.com/office/drawing/2010/main';

export const localName = (key: string): string => key.split(':').at(-1) ?? key;

export function childByLocalName(
	parent: XmlObject | undefined,
	name: string,
): XmlObject | undefined {
	if (!parent) {
		return undefined;
	}
	for (const key of Object.keys(parent)) {
		if (localName(key) !== name) {
			continue;
		}
		const value = parent[key];
		const first = Array.isArray(value) ? value[0] : value;
		if (first && typeof first === 'object') {
			return first as XmlObject;
		}
	}
	return undefined;
}

export function childrenByLocalName(parent: XmlObject | undefined, name: string): XmlObject[] {
	if (!parent) {
		return [];
	}
	const out: XmlObject[] = [];
	for (const key of Object.keys(parent)) {
		if (localName(key) !== name) {
			continue;
		}
		const value = parent[key];
		for (const entry of Array.isArray(value) ? value : [value]) {
			if (entry && typeof entry === 'object') {
				out.push(entry as XmlObject);
			}
		}
	}
	return out;
}

/** Read an attribute (prefix-insensitive: `@_r:embed` and `@_embed` both match). */
export function attrByLocalName(node: XmlObject | undefined, name: string): string | undefined {
	if (!node) {
		return undefined;
	}
	for (const key of Object.keys(node)) {
		if (!key.startsWith('@_')) {
			continue;
		}
		if (localName(key.slice(2)) === name) {
			const value = node[key];
			return value === undefined || value === null ? undefined : String(value);
		}
	}
	return undefined;
}

/** Read a numeric attribute, prefix-insensitive; `undefined` when absent or not finite. */
export function numberAttrByLocalName(
	node: XmlObject | undefined,
	name: string,
): number | undefined {
	const raw = attrByLocalName(node, name);
	if (raw === undefined) {
		return undefined;
	}
	const parsed = Number(raw.endsWith('%') ? raw.slice(0, -1) : raw);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/** Parse a per-100000 relative unit (`ST_PositiveFixedPercentage`) to a 0..1 fraction. */
export function percent100k(node: XmlObject | undefined, name: string): number | undefined {
	const parsed = numberAttrByLocalName(node, name);
	return parsed === undefined ? undefined : parsed / 100000;
}

/** The `a:ext` entries of a blip's `a:extLst`, in document order. */
export function blipExtensionEntries(blip: XmlObject): XmlObject[] {
	const extLst = childByLocalName(blip, 'extLst');
	return childrenByLocalName(extLst, 'ext');
}
