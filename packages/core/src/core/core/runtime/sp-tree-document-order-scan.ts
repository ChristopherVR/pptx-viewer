/**
 * sp-tree-document-order-scan: read the true child order of a shape tree back
 * off the raw markup.
 *
 * fast-xml-parser is configured without `preserveOrder`, so a parsed
 * `p:spTree` stores same-tag siblings in one array per tag and the
 * interleaving is gone. Any writer that re-serializes the parsed object
 * therefore emits paint order sorted by tag. Where the object is all we have,
 * the ONLY surviving record of the authored sequence is the part as it was
 * loaded, so this scans it.
 *
 * The scan is deliberately shallow-typed: each child is named by its tag plus
 * its index within that tag's array, which is exactly how the parsed object
 * addresses it. `p:grpSp` is descended into, because `CT_GroupShape` is the
 * same ordered sequence one level down and a group's children restack the same
 * way.
 *
 * An `mc:AlternateContent` envelope counts as ONE opaque child and is not
 * descended into. That is the difference from
 * `PptxHandlerRuntimeSpTreeParsing.extractSpTreeChildOrder`, which resolves the
 * envelope into the branch children it contributes: that is right for parsing,
 * where the envelope has been unwrapped and its children merged into the tag
 * arrays, and wrong here, where the object may still hold the envelope itself.
 * Counting it opaquely keeps the refs aligned either way: a surviving envelope
 * resolves by position, and an unwrapped one simply fails to resolve, leaving
 * its merged children unranked - which is where the writer already puts them.
 *
 * Like the corpus harness's own reader, this treats the markup as tags rather
 * than parsing it: OOXML parts do not carry comments or CDATA, and an
 * attribute value holding a literal `>` would have to be hand-authored.
 */
import { SHAPE_TREE_ELEMENT_TAGS } from '../../utils';

const ALTERNATE_CONTENT_TAG = 'mc:AlternateContent';
const GROUP_TAG = 'p:grpSp';

/** One shape-tree child in document order, addressed as the parsed object does. */
export interface SpTreeChildPlan {
	/** Full tag name including namespace prefix, e.g. `p:cxnSp`. */
	readonly tag: string;
	/** 0-based occurrence index within that tag's array on the container. */
	readonly indexInType: number;
	/** Document order of this child's OWN children; empty unless `p:grpSp`. */
	readonly children: readonly SpTreeChildPlan[];
}

interface Frame {
	readonly children: SpTreeChildPlan[];
	readonly counters: Map<string, number>;
}

function isContainerChild(tag: string): boolean {
	return SHAPE_TREE_ELEMENT_TAGS.has(tag) || tag === ALTERNATE_CONTENT_TAG;
}

/**
 * Document order of the first `p:spTree` in a part, groups included.
 *
 * Returns an empty array when the part has no shape tree or the tree is empty,
 * which callers must treat as "order unknown, leave the output alone".
 */
export function scanSpTreeDocumentOrder(xml: string): SpTreeChildPlan[] {
	const open = /<p:spTree[\s>]/.exec(xml);
	if (!open) {
		return [];
	}
	const bodyStart = xml.indexOf('>', open.index);
	if (bodyStart < 0 || xml[bodyStart - 1] === '/') {
		return [];
	}

	const root: SpTreeChildPlan[] = [];
	const stack: Frame[] = [{ children: root, counters: new Map() }];
	/** Depth inside a subtree that holds no shape-tree children of interest. */
	let inert = 0;

	const tagPattern = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
	tagPattern.lastIndex = bodyStart + 1;
	let match: RegExpExecArray | null;
	while ((match = tagPattern.exec(xml))) {
		const [, closing, tag, , selfClosing] = match;
		if (closing) {
			if (inert > 0) {
				inert--;
			} else {
				stack.pop();
				if (stack.length === 0) {
					break;
				}
			}
			continue;
		}
		if (inert === 0 && isContainerChild(tag)) {
			const frame = stack[stack.length - 1];
			const indexInType = frame.counters.get(tag) ?? 0;
			frame.counters.set(tag, indexInType + 1);
			const children: SpTreeChildPlan[] = [];
			frame.children.push({ tag, indexInType, children });
			if (!selfClosing) {
				if (tag === GROUP_TAG) {
					stack.push({ children, counters: new Map() });
				} else {
					inert++;
				}
			}
			continue;
		}
		if (!selfClosing) {
			inert++;
		}
	}
	return root;
}
