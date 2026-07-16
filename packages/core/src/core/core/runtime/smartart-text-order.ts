import type { XmlObject } from '../../types';

const paragraphOrder = new WeakMap<XmlObject, string[]>();
const TEXT_ITEMS = new Set(['r', 'br', 'fld', 'tab']);

function localName(name: string): string {
	const colon = name.indexOf(':');
	return colon >= 0 ? name.slice(colon + 1) : name;
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
			if (localName(key) === 't' && value && typeof value === 'object') {
				for (const [childKey, childValue] of Object.entries(value as XmlObject)) {
					if (localName(childKey) !== 'p') {
						continue;
					}
					paragraphs.push(
						...((Array.isArray(childValue) ? childValue : [childValue]) as XmlObject[]),
					);
				}
			} else {
				stack.push(value);
			}
		}
	}
	return paragraphs;
}

function extractSourceOrders(xml: string): string[][] {
	const orders: string[][] = [];
	const textBodyPattern = /<([A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/\1t\s*>/gu;
	for (const bodyMatch of xml.matchAll(textBodyPattern)) {
		const paragraphPattern = /<([A-Za-z_][\w.-]*:)?p\b[^>]*>([\s\S]*?)<\/\1p\s*>/gu;
		for (const paragraphMatch of bodyMatch[2].matchAll(paragraphPattern)) {
			orders.push(
				[...paragraphMatch[2].matchAll(/<([A-Za-z_][\w.-]*:)?([A-Za-z][\w.-]*)\b[^>]*>/gu)]
					.filter((match) => TEXT_ITEMS.has(match[2]))
					.map((match) => match[2]),
			);
		}
	}
	return orders;
}

/** Attach source item order to parsed SmartArt paragraph objects. */
export function annotateSmartArtTextOrder(xml: string, parsed: unknown): void {
	const orders = extractSourceOrders(xml);
	const paragraphs = collectParsedParagraphs(parsed);
	for (let index = 0; index < Math.min(orders.length, paragraphs.length); index++) {
		paragraphOrder.set(paragraphs[index], orders[index]);
	}
}

/** Return paragraph text items in source order. */
export function orderedSmartArtTextEntries(paragraph: XmlObject): Array<[string, XmlObject]> {
	const keysByName = new Map<string, string>();
	for (const key of Object.keys(paragraph)) {
		if (TEXT_ITEMS.has(localName(key))) {
			keysByName.set(localName(key), key);
		}
	}
	const itemsFor = (key: string): XmlObject[] => {
		const value = paragraph[key];
		const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
		return items.map((item) =>
			item && typeof item === 'object' && !Array.isArray(item) ? item : {},
		) as XmlObject[];
	};
	const order = paragraphOrder.get(paragraph);
	if (!order) {
		return [...keysByName.values()].flatMap((key) =>
			itemsFor(key).map((item) => [key, item] as [string, XmlObject]),
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
