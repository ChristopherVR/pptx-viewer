/**
 * ordered-xml-children: emit heterogeneous OOXML children in DOCUMENT order.
 *
 * Several OOXML content models are ordered sequences of differently-named
 * children, and for shape containers the order is not cosmetic: `CT_GroupShape`
 * (S19.3.1.45, used by both `p:spTree` and `p:grpSp`) is a painter's-algorithm
 * list, so **document order IS paint order**. Emitting `container['p:sp'] =
 * shapes; container['p:pic'] = pictures; ...` - one array per tag, which is the
 * natural shape of a fast-xml-parser object - silently restacks the container:
 * every picture, connector and group jumps in front of shapes that were
 * authored above them, in PowerPoint and in this viewer alike.
 *
 * The fix is the `#pptx-order-N` marker idiom the repo already uses for
 * custom-geometry path commands (`custom-geometry-command-order.ts`) and OMML
 * sibling order (`omml-sibling-order.ts`): a repeated, non-adjacent tag is
 * stored under a marked key so plain object key-insertion order carries the
 * true sequence, and `PptxRuntimeDependencyFactory` strips the markers from the
 * serialized XML, so the emitted tag names are unchanged.
 *
 * Consumers: the slide shape tree (`slide-save-xml-order.ts`) and, once
 * sequenced, the group shape writer - both need the same guarantee.
 */
import { orderedXmlKey } from '../../geometry';
import type { XmlObject } from '../../types';

/** One child element in document order. */
export interface OrderedXmlChild {
	/** Full tag name including any namespace prefix, e.g. `p:grpSp`. */
	tag: string;
	/** The child element object. */
	node: unknown;
}

/**
 * Set an own property whose key comes from an XML tag name (which may legally
 * be `__proto__`). `Object.defineProperty` always creates a literal own
 * property; unlike `node[key] = value` it never walks the prototype chain.
 */
export function setOwnXmlProperty(node: XmlObject, key: string, value: unknown): void {
	Object.defineProperty(node, key, {
		value,
		writable: true,
		enumerable: true,
		configurable: true,
	});
}

/**
 * Append `children` to `target` so that serialization reproduces their exact
 * order.
 *
 * Adjacent same-tag children collapse into a single array under the plain tag
 * key (the common case, and byte-identical to the old per-tag output). Only a
 * tag that reappears after a different tag needs an `orderedXmlKey` marker, so
 * a container that was already grouped by tag gains no markers at all.
 *
 * The caller owns `target`; existing keys are not cleared, so pass a container
 * whose element keys have already been removed (or a fresh object).
 */
export function assignOrderedXmlChildren(
	target: XmlObject,
	children: readonly OrderedXmlChild[],
): void {
	const runs: Array<{ tag: string; nodes: unknown[] }> = [];
	for (const child of children) {
		const last = runs.at(-1);
		if (last && last.tag === child.tag) {
			last.nodes.push(child.node);
		} else {
			runs.push({ tag: child.tag, nodes: [child.node] });
		}
	}
	const seen = new Set<string>();
	runs.forEach((run, index) => {
		const key = seen.has(run.tag) ? orderedXmlKey(run.tag, index) : run.tag;
		seen.add(run.tag);
		setOwnXmlProperty(target, key, run.nodes.length === 1 ? run.nodes[0] : run.nodes);
	});
}
