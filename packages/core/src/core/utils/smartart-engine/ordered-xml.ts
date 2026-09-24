/**
 * Minimal document-order XML reader for DiagramML layout definitions.
 *
 * The package-wide fast-xml-parser configuration drops the interleaving of
 * differently-named siblings (it groups children into one array per tag), but
 * a `dgm:layoutNode` body is an ordered sequence: a `dgm:forEach` between two
 * `dgm:layoutNode`s decides where the iterated shapes sit among their
 * siblings, which in turn decides a `lin` algorithm's placement order. This
 * reader keeps that order. It only needs elements and attributes (layout
 * definitions carry no mixed text content that the engine consumes), strips
 * namespace prefixes, and decodes the five predefined XML entities plus
 * numeric character references in attribute values.
 */

/** One element in document order, named by its local name (prefix removed). */
export interface OrderedXmlElement {
	name: string;
	attrs: Record<string, string>;
	children: OrderedXmlElement[];
}

const ENTITY: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
};

function decodeEntities(value: string): string {
	return value.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/gu, (whole, body: string) => {
		if (body.startsWith('#x')) {
			return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
		}
		if (body.startsWith('#')) {
			return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
		}
		return ENTITY[body] ?? whole;
	});
}

function localName(qualified: string): string {
	const colon = qualified.indexOf(':');
	return colon >= 0 ? qualified.slice(colon + 1) : qualified;
}

function parseAttributes(source: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	const pattern = /([\w.:-]+)\s*=\s*("([^"]*)"|'([^']*)')/gu;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(source))) {
		const name = match[1];
		if (name === 'xmlns' || name.startsWith('xmlns:')) {
			continue;
		}
		attrs[localName(name)] = decodeEntities(match[3] ?? match[4] ?? '');
	}
	return attrs;
}

/**
 * Parse `xml` and return its document element, or `undefined` when the text
 * holds no element at all. Comments, processing instructions, CDATA sections
 * and DOCTYPE declarations are skipped.
 */
export function parseOrderedXml(xml: string): OrderedXmlElement | undefined {
	const root: OrderedXmlElement = { name: '#document', attrs: {}, children: [] };
	const stack: OrderedXmlElement[] = [root];
	const pattern =
		/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[?!][^>]*>|<(\/?)([\w.:-]+)([^>]*?)(\/?)>/gu;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(xml))) {
		const tag = match[2];
		if (!tag) {
			continue;
		}
		if (match[1] === '/') {
			if (stack.length > 1) {
				stack.pop();
			}
			continue;
		}
		const element: OrderedXmlElement = {
			name: localName(tag),
			attrs: parseAttributes(match[3] ?? ''),
			children: [],
		};
		stack[stack.length - 1].children.push(element);
		if (match[4] !== '/') {
			stack.push(element);
		}
	}
	return root.children[0];
}

/** First direct child named `name`. */
export function orderedChild(
	element: OrderedXmlElement | undefined,
	name: string,
): OrderedXmlElement | undefined {
	return element?.children.find((child) => child.name === name);
}

/** Depth-first search for the first descendant named `name`. */
export function findOrderedDescendant(
	element: OrderedXmlElement | undefined,
	name: string,
): OrderedXmlElement | undefined {
	if (!element) {
		return undefined;
	}
	for (const child of element.children) {
		if (child.name === name) {
			return child;
		}
		const nested = findOrderedDescendant(child, name);
		if (nested) {
			return nested;
		}
	}
	return undefined;
}
