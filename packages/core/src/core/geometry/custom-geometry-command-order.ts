import type { XmlObject } from '../types';

const ORDER_SUFFIX = '#pptx-order-';
const commandOrder = new WeakMap<XmlObject, string[]>();
const PATH_COMMANDS = new Set(['moveTo', 'lnTo', 'arcTo', 'quadBezTo', 'cubicBezTo', 'close']);

function localName(name: string): string {
	const colon = name.indexOf(':');
	return colon >= 0 ? name.slice(colon + 1) : name;
}

function childByLocalName(node: XmlObject | undefined, name: string): unknown {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	return key ? node[key] : undefined;
}

function collectParsedPaths(root: unknown): XmlObject[] {
	const paths: XmlObject[] = [];
	const stack: unknown[] = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || typeof current !== 'object') {
			continue;
		}
		if (Array.isArray(current)) {
			for (let index = current.length - 1; index >= 0; index--) {
				stack.push(current[index]);
			}
			continue;
		}
		const node = current as XmlObject;
		for (const [key, value] of Object.entries(node).reverse()) {
			if (localName(key) === 'custGeom') {
				const pathList = childByLocalName(value as XmlObject, 'pathLst') as XmlObject | undefined;
				const rawPaths = childByLocalName(pathList, 'path');
				paths.push(
					...((Array.isArray(rawPaths) ? rawPaths : rawPaths ? [rawPaths] : []) as XmlObject[]),
				);
			} else {
				stack.push(value);
			}
		}
	}
	return paths;
}

function extractSourceOrders(xml: string): string[][] {
	const orders: string[][] = [];
	const custGeomPattern = /<([A-Za-z_][\w.-]*:)?custGeom\b[^>]*>([\s\S]*?)<\/\1custGeom\s*>/gu;
	for (const geometryMatch of xml.matchAll(custGeomPattern)) {
		const geometryXml = geometryMatch[2];
		const pathPattern = /<([A-Za-z_][\w.-]*:)?path\b[^>]*>([\s\S]*?)<\/\1path\s*>/gu;
		for (const pathMatch of geometryXml.matchAll(pathPattern)) {
			const order = [
				...pathMatch[2].matchAll(/<\/?([A-Za-z_][\w.-]*:)?([A-Za-z][\w.-]*)\b[^>]*>/gu),
			]
				.filter((match) => match[0][1] !== '/' && PATH_COMMANDS.has(match[2]))
				.map((match) => match[2]);
			orders.push(order);
		}
	}
	return orders;
}

/** Attach source command order to parsed custom-geometry path objects. */
export function annotateCustomGeometryCommandOrder(xml: string, parsed: unknown): void {
	const orders = extractSourceOrders(xml);
	if (orders.length === 0) {
		return;
	}
	const paths = collectParsedPaths(parsed);
	for (let index = 0; index < Math.min(paths.length, orders.length); index++) {
		commandOrder.set(paths[index], orders[index]);
	}
}

/** Return path command entries in their original source order. */
export function orderedPathCommandEntries(
	path: XmlObject,
	ensureArray: (value: unknown) => unknown[],
): Array<[string, unknown]> {
	const commandItems = (key: string): unknown[] => {
		const value = path[key];
		const items = ensureArray(value);
		return items.length === 0 && localName(key) === 'close' && value !== undefined
			? [value]
			: items;
	};
	const order = commandOrder.get(path);
	if (!order) {
		return Object.keys(path).flatMap((key) =>
			key.startsWith('@_') ? [] : commandItems(key).map((item) => [key, item] as [string, unknown]),
		);
	}
	const consumed = new Map<string, number>();
	return order.flatMap((name) => {
		const key = Object.keys(path).find((candidate) => localName(candidate) === name);
		if (!key) {
			return [];
		}
		const items = commandItems(key);
		const index = consumed.get(key) ?? 0;
		consumed.set(key, index + 1);
		return index < items.length ? [[key, items[index]] as [string, unknown]] : [];
	});
}

/** Create an internal ordered key for a repeated non-adjacent XML element. */
export function orderedXmlKey(baseName: string, order: number): string {
	return `${baseName}${ORDER_SUFFIX}${order}`;
}

/** Strip the internal order marker before emitting XML. */
export function stripXmlOrderSuffix(tagName: string): string {
	const index = tagName.indexOf(ORDER_SUFFIX);
	return index >= 0 ? tagName.slice(0, index) : tagName;
}

/** Remove internal order markers from serialized XML tag names. */
export function stripXmlOrderMarkers(xml: string): string {
	return xml.replace(/#pptx-order-\d+/gu, '');
}
