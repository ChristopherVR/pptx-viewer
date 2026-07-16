import type { XmlObject } from '../../types';

const childOrder = new WeakMap<XmlObject, string[]>();

function localName(name: string): string {
	const colon = name.indexOf(':');
	return colon >= 0 ? name.slice(colon + 1) : name;
}

function isXmlObject(value: unknown): value is XmlObject {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function collectParsedParagraphs(root: unknown): XmlObject[] {
	const paragraphs: XmlObject[] = [];
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
			if (
				(localName(key) === 't' || localName(key) === 'txBody') &&
				value &&
				typeof value === 'object'
			) {
				for (const [childKey, childValue] of Object.entries(value as XmlObject)) {
					if (localName(childKey) !== 'p') {
						continue;
					}
					paragraphs.push(
						...(Array.isArray(childValue) ? childValue : [childValue]).filter(isXmlObject),
					);
				}
			} else {
				stack.push(value);
			}
		}
	}
	return paragraphs;
}

function directChildOrder(xml: string): string[] {
	const order: string[] = [];
	let depth = 0;
	for (const match of xml.matchAll(/<(\/)?([A-Za-z_][\w.-]*:)?([A-Za-z][\w.-]*)\b[^>]*>/gu)) {
		const closing = Boolean(match[1]);
		const selfClosing = /\/\s*>$/u.test(match[0]);
		if (closing) {
			depth = Math.max(0, depth - 1);
			continue;
		}
		if (depth === 0) {
			order.push(match[3]);
		}
		if (!selfClosing) {
			depth++;
		}
	}
	return order;
}

function extractElementOrders(xml: string, elementName: string): string[][] {
	const orders: string[][] = [];
	const pattern = new RegExp(
		`<([A-Za-z_][\\w.-]*:)?${elementName}\\b[^>]*>([\\s\\S]*?)<\\/\\1${elementName}\\s*>`,
		'gu',
	);
	for (const match of xml.matchAll(pattern)) {
		orders.push(directChildOrder(match[2]));
	}
	return orders;
}

function directChildrenByLocalName(paragraphs: XmlObject[], name: string): XmlObject[] {
	return paragraphs.flatMap((paragraph) =>
		Object.entries(paragraph).flatMap(([key, value]) => {
			if (localName(key) !== name) {
				return [];
			}
			const values = Array.isArray(value) ? value : [value];
			return values.filter(isXmlObject);
		}),
	);
}

/** Attach source item order to parsed SmartArt paragraph objects. */
export function annotateSmartArtTextOrder(xml: string, parsed: unknown): void {
	const paragraphs = collectParsedParagraphs(parsed);
	const orders = extractElementOrders(xml, 'p');
	for (let index = 0; index < Math.min(orders.length, paragraphs.length); index++) {
		childOrder.set(paragraphs[index], orders[index]);
	}
	for (const name of ['r', 'fld', 'br']) {
		const nodes = directChildrenByLocalName(paragraphs, name);
		const nodeOrders = extractElementOrders(xml, name);
		for (let index = 0; index < Math.min(nodeOrders.length, nodes.length); index++) {
			childOrder.set(nodes[index], nodeOrders[index]);
		}
	}
}

/** Return the original direct-child local-name order for a parsed XML node. */
export function smartArtChildOrder(node: XmlObject): string[] | undefined {
	return childOrder.get(node)?.slice();
}

/** Return paragraph text items in source order. */
export function orderedSmartArtTextEntries(paragraph: XmlObject): Array<[string, unknown]> {
	const keysByName = new Map<string, string>();
	for (const key of Object.keys(paragraph)) {
		if (!key.startsWith('@_')) {
			keysByName.set(localName(key), key);
		}
	}
	const itemsFor = (key: string): unknown[] => {
		const value = paragraph[key];
		return Array.isArray(value) ? value : value === undefined ? [] : [value];
	};
	const order = childOrder.get(paragraph);
	if (!order) {
		return [...keysByName.values()].flatMap((key) =>
			itemsFor(key).map((item) => [key, item] as [string, unknown]),
		);
	}
	const consumed = new Map<string, number>();
	return order.flatMap((name) => {
		const key = keysByName.get(name);
		if (!key) {
			return [];
		}
		const index = consumed.get(key) ?? 0;
		consumed.set(key, index + 1);
		const item = itemsFor(key)[index];
		return item === undefined ? [] : [[key, item]];
	});
}
