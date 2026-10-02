/**
 * Turns an SVG string into a node without going through `innerHTML`.
 *
 * The gallery catalogue builds preview tiles from trusted geometry and escaped theme data, but a
 * string-to-HTML sink is exactly what static analysis (and a future careless caller) cannot
 * prove safe. Parsing as an SVG *document* never runs script, and anything executable
 * (`<script>`, `<foreignObject>`, embeds, event-handler attributes, `javascript:` URLs) is stripped
 * from the result as defence in depth. Returns `null` for anything that is not a well-formed
 * `<svg>` root.
 */
const BLOCKED_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed']);

export function parseSvgPreview(doc: Document, svg: string): Element | null {
	const Parser = globalThis.DOMParser;
	if (typeof Parser !== 'function') {
		return null;
	}
	const parsed = new Parser().parseFromString(svg, 'image/svg+xml');
	const root = parsed.documentElement;
	if (root.localName !== 'svg' || parsed.getElementsByTagName('parsererror').length > 0) {
		return null;
	}
	for (const node of Array.from(root.querySelectorAll('*'))) {
		if (BLOCKED_ELEMENTS.has(node.localName.toLowerCase())) {
			node.remove();
			continue;
		}
		for (const attribute of Array.from(node.attributes)) {
			if (/^on/iu.test(attribute.name) || /^\s*javascript:/iu.test(attribute.value)) {
				node.removeAttribute(attribute.name);
			}
		}
	}
	return doc.importNode(root, true);
}
