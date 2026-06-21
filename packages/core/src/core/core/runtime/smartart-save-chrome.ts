import type { XmlObject, PptxSmartArtChrome } from '../../types';

/** Resolve the local (prefix-stripped) name of an XML key. */
type LocalNameResolver = (key: string) => string;

/** Treat a value as an XmlObject, defaulting to an empty object. */
function asObject(value: unknown): XmlObject {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as XmlObject) : {};
}

/**
 * Persist SmartArt chrome (background fill + outline) back onto the diagram
 * data model's `dgm:bg` and `dgm:whole` nodes.
 *
 * Only the fill colour of `dgm:bg/a:solidFill` and the line colour / width of
 * `dgm:whole/a:ln` are written; any other children of those nodes (effects,
 * gradient stops, ext lists) are left untouched. When a node does not yet
 * exist it is created with the minimal structure PowerPoint accepts.
 *
 * @param dataModel The parsed `dgm:dataModel` object (mutated in place).
 * @param chrome The in-memory chrome to persist, or undefined to no-op.
 * @param getLocalName Resolver mapping an XML key to its local name.
 */
export function applySmartArtChrome(
	dataModel: XmlObject,
	chrome: PptxSmartArtChrome | undefined,
	getLocalName: LocalNameResolver,
): void {
	if (
		!chrome ||
		(!chrome.backgroundColor &&
			!chrome.outlineColor &&
			(chrome.outlineWidth === null || chrome.outlineWidth === undefined))
	) {
		return;
	}

	const findKey = (obj: XmlObject, name: string): string | undefined =>
		Object.keys(obj).find((k) => getLocalName(k) === name);

	// ── Background fill (dgm:bg/a:solidFill/a:srgbClr) ────────────────
	if (chrome.backgroundColor) {
		const hex = chrome.backgroundColor.replace('#', '');
		const bgKey = findKey(dataModel, 'bg') ?? 'dgm:bg';
		const bg = asObject(dataModel[bgKey]);
		const fillKey = findKey(bg, 'solidFill') ?? 'a:solidFill';
		bg[fillKey] = { 'a:srgbClr': { '@_val': hex } };
		dataModel[bgKey] = bg;
	}

	// ── Outline (dgm:whole/a:ln) ─────────────────────────────────────
	const hasOutlineWidth = chrome.outlineWidth !== null && chrome.outlineWidth !== undefined;
	if (chrome.outlineColor || hasOutlineWidth) {
		const wholeKey = findKey(dataModel, 'whole') ?? 'dgm:whole';
		const whole = asObject(dataModel[wholeKey]);
		const lnKey = findKey(whole, 'ln') ?? 'a:ln';
		const ln = asObject(whole[lnKey]);
		if (hasOutlineWidth) {
			ln['@_w'] = String(Math.round((chrome.outlineWidth as number) * 12700));
		}
		if (chrome.outlineColor) {
			const hex = chrome.outlineColor.replace('#', '');
			const fillKey = findKey(ln, 'solidFill') ?? 'a:solidFill';
			ln[fillKey] = { 'a:srgbClr': { '@_val': hex } };
		}
		whole[lnKey] = ln;
		dataModel[wholeKey] = whole;
	}
}
