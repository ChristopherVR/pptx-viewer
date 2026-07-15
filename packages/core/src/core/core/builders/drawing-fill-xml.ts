import type { XmlObject } from '../../types';

const ATTRIBUTE_PREFIX = '@_';

/** Return the first object child whose qualified name has the requested local name. */
export function drawingChild(
	node: XmlObject | undefined,
	requestedName: string,
): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith(ATTRIBUTE_PREFIX) || key === '#text') {
			continue;
		}
		if (key.split(':').at(-1) !== requestedName) {
			continue;
		}
		const child = Array.isArray(value) ? value[0] : value;
		if (child && typeof child === 'object' && !Array.isArray(child)) {
			return child as XmlObject;
		}
	}
	return undefined;
}

/** Return all object children whose qualified name has the requested local name. */
export function drawingChildren(node: XmlObject | undefined, requestedName: string): XmlObject[] {
	if (!node) {
		return [];
	}
	for (const [key, value] of Object.entries(node)) {
		if (
			key.startsWith(ATTRIBUTE_PREFIX) ||
			key === '#text' ||
			key.split(':').at(-1) !== requestedName
		) {
			continue;
		}
		const values = Array.isArray(value) ? value : [value];
		return values.filter(
			(child): child is XmlObject =>
				Boolean(child) && typeof child === 'object' && !Array.isArray(child),
		);
	}
	return [];
}

function qualifiedLocalName(key: string): string {
	return key.split(':').at(-1) ?? key;
}

/**
 * Overlay modeled fill children on preserved source XML.
 *
 * Known children are replaced with canonical DrawingML names. Unknown children,
 * extension lists, namespace declarations, and unmodeled attributes survive.
 * Child insertion follows the supplied CT_* schema order.
 */
export function mergeDrawingFillXml(
	original: XmlObject | undefined,
	generated: XmlObject,
	modeledChildren: readonly string[],
	childOrder: readonly string[],
): XmlObject {
	const attributes: Array<[string, string | undefined]> = [];
	const children = new Map<string, XmlObject | XmlObject[] | string | undefined>();

	for (const [key, value] of Object.entries(original ?? {})) {
		if (key.startsWith(ATTRIBUTE_PREFIX)) {
			attributes.push([key, value as string | undefined]);
		} else if (!modeledChildren.includes(qualifiedLocalName(key))) {
			children.set(key, value as XmlObject | XmlObject[] | string | undefined);
		}
	}
	for (const [key, value] of Object.entries(generated)) {
		if (key.startsWith(ATTRIBUTE_PREFIX)) {
			const existing = attributes.findIndex(([name]) => name === key);
			if (existing >= 0) {
				attributes.splice(existing, 1);
			}
			attributes.push([key, value as string | undefined]);
		} else {
			children.set(key, value as XmlObject | XmlObject[] | string | undefined);
		}
	}

	const result: XmlObject = {};
	for (const [key, value] of attributes) {
		result[key] = value;
	}
	for (const name of childOrder) {
		for (const [key, value] of children) {
			if (qualifiedLocalName(key) === name) {
				result[key] = value;
				children.delete(key);
			}
		}
	}
	for (const [key, value] of children) {
		result[key] = value;
	}
	return result;
}
