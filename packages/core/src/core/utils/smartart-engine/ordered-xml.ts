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

function isNameChar(ch: string): boolean {
	return /[\w.:-]/u.test(ch);
}

function isSpace(ch: string): boolean {
	return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/**
 * Attributes of one start tag. A linear, hand-written scan rather than a
 * regex: `name\s*=\s*"value"` patterns with overlapping quantifiers backtrack
 * polynomially on crafted input (CodeQL js/polynomial-redos), and this reader
 * runs on untrusted deck XML.
 */
function parseAttributes(source: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	let i = 0;
	const n = source.length;
	while (i < n) {
		while (i < n && !isNameChar(source[i])) {
			i++;
		}
		const nameStart = i;
		while (i < n && isNameChar(source[i])) {
			i++;
		}
		const name = source.slice(nameStart, i);
		while (i < n && isSpace(source[i])) {
			i++;
		}
		if (!name || source[i] !== '=') {
			continue;
		}
		i++;
		while (i < n && isSpace(source[i])) {
			i++;
		}
		const quote = source[i];
		if (quote !== '"' && quote !== "'") {
			continue;
		}
		const close = source.indexOf(quote, i + 1);
		if (close < 0) {
			break;
		}
		const value = source.slice(i + 1, close);
		i = close + 1;
		if (name === 'xmlns' || name.startsWith('xmlns:')) {
			continue;
		}
		attrs[localName(name)] = decodeEntities(value);
	}
	return attrs;
}

/** Index of the `>` closing a tag that starts at `from`, skipping quoted values. */
function tagEnd(xml: string, from: number): number {
	let quote = '';
	for (let i = from; i < xml.length; i++) {
		const ch = xml[i];
		if (quote) {
			if (ch === quote) {
				quote = '';
			}
		} else if (ch === '"' || ch === "'") {
			quote = ch;
		} else if (ch === '>') {
			return i;
		}
	}
	return -1;
}

/**
 * Parse `xml` and return its document element, or `undefined` when the text
 * holds no element at all. Comments, processing instructions, CDATA sections
 * and DOCTYPE declarations are skipped. Linear in the input length.
 */
export function parseOrderedXml(xml: string): OrderedXmlElement | undefined {
	const root: OrderedXmlElement = { name: '#document', attrs: {}, children: [] };
	const stack: OrderedXmlElement[] = [root];
	let i = xml.indexOf('<');
	while (i >= 0 && i < xml.length) {
		if (xml.startsWith('<!--', i)) {
			const close = xml.indexOf('-->', i + 4);
			i = close < 0 ? -1 : xml.indexOf('<', close + 3);
			continue;
		}
		if (xml.startsWith('<![CDATA[', i)) {
			const close = xml.indexOf(']]>', i + 9);
			i = close < 0 ? -1 : xml.indexOf('<', close + 3);
			continue;
		}
		const end = tagEnd(xml, i + 1);
		if (end < 0) {
			break;
		}
		const next = xml.indexOf('<', end + 1);
		const first = xml[i + 1];
		if (first === '?' || first === '!') {
			i = next;
			continue;
		}
		const closing = first === '/';
		let cursor = closing ? i + 2 : i + 1;
		const nameStart = cursor;
		while (cursor < end && isNameChar(xml[cursor])) {
			cursor++;
		}
		const tag = xml.slice(nameStart, cursor);
		if (!tag) {
			i = next;
			continue;
		}
		if (closing) {
			if (stack.length > 1) {
				stack.pop();
			}
			i = next;
			continue;
		}
		const selfClosing = xml[end - 1] === '/';
		const element: OrderedXmlElement = {
			name: localName(tag),
			attrs: parseAttributes(xml.slice(cursor, selfClosing ? end - 1 : end)),
			children: [],
		};
		stack[stack.length - 1].children.push(element);
		if (!selfClosing) {
			stack.push(element);
		}
		i = next;
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
