/**
 * @fileoverview Node surgery for writing an edited `<p:grpSp>` back into a
 * layout or slide master.
 *
 * A template part is not rebuilt from the typed model on an ordinary save: it
 * is re-serialized straight out of `layoutXmlMap` / `masterXmlMap`, in the
 * loader-native shape fast-xml-parser produced, and `template-sp-tree-order`
 * re-interleaves it at flush time from the part's ORIGINAL XML. Both of those
 * constrain what a rebuilt group may look like when it is put back, which is
 * what the two helpers here enforce.
 */
import { stripXmlOrderSuffix } from '../../geometry';
import type { XmlObject } from '../../types';
import { setOwnXmlProperty } from './ordered-xml-children';

/**
 * Collapse `#pptx-order-N` marker keys back into one bucket per tag, in place.
 *
 * `assignOrderedXmlChildren` stores a tag that reappears after a different tag
 * under a marked key, so plain key order carries document order. That is right
 * for a node the builder serializes directly, and wrong for a node handed back
 * to a template part: the flush re-interleaves that part from its original XML
 * by matching each child on its index WITHIN ITS TAG, and a marked key hides
 * the child from that lookup. A group authored `sp, cxnSp, sp, cxnSp` came back
 * out as `sp2, cxnSp2, sp1, cxnSp1`, because only the first of each tag was
 * found and positioned.
 *
 * Order is not lost by collapsing: it is recovered at the flush from the
 * authored part, exactly as it is for every shape the template writer patches
 * in place. Groups written into a SLIDE keep their markers, which is where the
 * markers do carry the order.
 */
export function collapseOrderedXmlChildren(node: XmlObject): void {
	if (!Object.keys(node).some((key) => stripXmlOrderSuffix(key) !== key)) {
		return;
	}
	const tagOrder: string[] = [];
	const byTag = new Map<string, unknown[]>();
	for (const [key, value] of Object.entries(node)) {
		const tag = stripXmlOrderSuffix(key);
		let bucket = byTag.get(tag);
		if (!bucket) {
			bucket = [];
			byTag.set(tag, bucket);
			tagOrder.push(tag);
		}
		bucket.push(...(Array.isArray(value) ? value : [value]));
	}
	for (const key of Object.keys(node)) {
		delete node[key];
	}
	for (const tag of tagOrder) {
		const bucket = byTag.get(tag) ?? [];
		setOwnXmlProperty(node, tag, bucket.length === 1 ? bucket[0] : bucket);
	}
}

/**
 * Move every member of `source` onto `target`, in place, and return `target`.
 *
 * Every other element type reaches the template writer as its own `rawXml`
 * patched in place, so the node in the cached part IS the node the model
 * points at. A group is rebuilt into a fresh object instead, so it is folded
 * back into the original node rather than replacing it: the identity is what
 * lets `ensureTemplateShapeAttached` recognise the shape already in the tree
 * instead of appending a second `<p:grpSp>` beside it.
 *
 * `source` is read out before `target` is cleared, because a rebuilt group may
 * carry references to sub-nodes of the original (`p:extLst` is passed through
 * by reference).
 */
export function replaceXmlNodeContents(target: XmlObject, source: XmlObject): XmlObject {
	if (target === source) {
		return target;
	}
	const members = Object.entries(source);
	for (const key of Object.keys(target)) {
		delete target[key];
	}
	for (const [key, value] of members) {
		setOwnXmlProperty(target, key, value);
	}
	return target;
}
