/**
 * Structural helpers for editing an existing `p:timing` tree in place.
 *
 * `CT_TimeNodeList` (ECMA-376 S19.5.86) nests time-node containers
 * (`p:par` / `p:seq` / `p:excl`) inside `p:cTn/p:childTnLst`, so an effect the
 * editor wants to add, retime or delete is always reached through a chain of
 * those containers rather than sitting at a fixed depth. Everything here works
 * on that chain: it locates the effect `p:cTn` nodes (the ones carrying
 * `@presetClass`), records the container chain that owns each one, and offers
 * precise insert / remove primitives that leave every sibling node - including
 * the timing markup this app does not model - byte-identical.
 *
 * Removal walks the recorded chain back up and drops only the containers that
 * this removal emptied, which is why the chain is recorded rather than
 * recomputed: pruning "any empty container" would delete unrelated structures
 * a deck legitimately carries.
 *
 * @module services/animation-timing-tree
 */
import type { XmlObject } from '../types';
import { ensureArray, isXmlObject } from './native-animation-helpers';

/** Container element keys that may appear inside a `p:childTnLst`. */
const CONTAINER_KEYS = ['p:par', 'p:seq', 'p:excl'] as const;

/** One `p:par` / `p:seq` / `p:excl` link in the chain down to an effect node. */
export interface TimingContainerRef {
	/** The `p:childTnLst` (or `p:tnLst`) object that holds `node` under `key`. */
	holder: XmlObject;
	/** The key `node` is stored under (`p:par`, `p:seq` or `p:excl`). */
	key: string;
	/** The container element itself (`{ 'p:cTn': ... }`). */
	node: XmlObject;
}

/** An effect time node (`p:cTn` with `@presetClass`) and how to reach it. */
export interface EffectNodeRef {
	/** The effect `p:cTn` element. */
	cTn: XmlObject;
	/** The `p:spTgt/@spid` its behaviours target, when it has one. */
	spid: string | undefined;
	/** The `@presetClass` value (`entr` / `exit` / `emph` / `path` / ...). */
	presetClass: string;
	/** Containers from the outermost (`p:tnLst` child) down to the effect's own. */
	chain: TimingContainerRef[];
}

/** Element (non-attribute) child keys of an XML object. */
function elementKeys(node: XmlObject): string[] {
	return Object.keys(node).filter((key) => !key.startsWith('@_'));
}

/** How many element children a `p:childTnLst` still declares. */
export function countTimeNodeChildren(childTnLst: XmlObject): number {
	let total = 0;
	for (const key of elementKeys(childTnLst)) {
		total += ensureArray(childTnLst[key]).length;
	}
	return total;
}

/** Read the `p:spTgt/@spid` an effect node's behaviour children point at. */
export function targetSpidOf(cTn: XmlObject): string | undefined {
	const childTnLst = cTn['p:childTnLst'];
	if (!isXmlObject(childTnLst)) {
		return undefined;
	}
	for (const key of elementKeys(childTnLst)) {
		for (const behaviourNode of ensureArray(childTnLst[key])) {
			const behaviour = behaviourNode['p:cBhvr'];
			if (!isXmlObject(behaviour)) {
				continue;
			}
			const target = behaviour['p:tgtEl'];
			const shapeTarget = isXmlObject(target) ? target['p:spTgt'] : undefined;
			const spid = isXmlObject(shapeTarget) ? shapeTarget['@_spid'] : undefined;
			if (spid !== undefined && spid !== null && String(spid).length > 0) {
				return String(spid);
			}
		}
	}
	return undefined;
}

function walkContainers(
	holder: XmlObject,
	chain: TimingContainerRef[],
	out: EffectNodeRef[],
): void {
	for (const key of CONTAINER_KEYS) {
		for (const node of ensureArray(holder[key])) {
			const nextChain = [...chain, { holder, key, node }];
			const cTn = node['p:cTn'];
			if (!isXmlObject(cTn)) {
				continue;
			}
			const presetClass = cTn['@_presetClass'];
			if (typeof presetClass === 'string' && presetClass.length > 0) {
				out.push({ cTn, spid: targetSpidOf(cTn), presetClass, chain: nextChain });
			}
			const childTnLst = cTn['p:childTnLst'];
			if (isXmlObject(childTnLst)) {
				walkContainers(childTnLst, nextChain, out);
			}
		}
	}
}

/** Every effect node in a `p:timing` tree, in document order. */
export function indexEffectNodes(rawTiming: XmlObject): EffectNodeRef[] {
	const tnLst = rawTiming['p:tnLst'];
	if (!isXmlObject(tnLst)) {
		return [];
	}
	const out: EffectNodeRef[] = [];
	walkContainers(tnLst, [], out);
	return out;
}

/** Largest `@id` anywhere in the timing tree, so new nodes can allocate above it. */
export function maxTimeNodeId(rawTiming: XmlObject): number {
	let max = 0;
	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const entry of value) {
				visit(entry);
			}
			return;
		}
		if (!isXmlObject(value)) {
			return;
		}
		const id = value['@_id'];
		if (id !== undefined && id !== null) {
			const parsed = Number.parseInt(String(id), 10);
			if (Number.isFinite(parsed) && parsed > max) {
				max = parsed;
			}
		}
		for (const key of Object.keys(value)) {
			visit(value[key]);
		}
	};
	visit(rawTiming);
	return max;
}

/** Drop `node` from `holder[key]`, collapsing the array back to a lone object. */
function detach(holder: XmlObject, key: string, node: XmlObject): void {
	const remaining = ensureArray(holder[key]).filter((entry) => entry !== node);
	if (remaining.length === 0) {
		delete holder[key];
	} else {
		holder[key] = remaining.length === 1 ? remaining[0]! : remaining;
	}
}

/** Append a container node under `holder[key]`, preserving existing siblings. */
export function appendContainer(holder: XmlObject, key: string, node: XmlObject): void {
	const existing = ensureArray(holder[key]);
	existing.push(node);
	holder[key] = existing.length === 1 ? existing[0]! : existing;
}

/**
 * `nodeType` values whose container must survive going empty: the timing root
 * and the main sequence are structural anchors PowerPoint expects to find, and
 * an empty `p:seq` is schema-valid because `p:childTnLst` is optional.
 */
const STRUCTURAL_NODE_TYPES = new Set(['tmRoot', 'mainSeq']);

/**
 * Remove an effect node and every container this removal emptied.
 *
 * Only the recorded ancestors are considered, and the walk stops at the first
 * ancestor that still has children, so unrelated empty structures elsewhere in
 * the deck are never touched.
 */
export function removeEffectNode(ref: EffectNodeRef): void {
	const chain = ref.chain;
	const own = chain[chain.length - 1];
	if (!own) {
		return;
	}
	detach(own.holder, own.key, own.node);

	for (let index = chain.length - 2; index >= 0; index -= 1) {
		const link = chain[index]!;
		const cTn = link.node['p:cTn'];
		if (!isXmlObject(cTn)) {
			return;
		}
		const childTnLst = cTn['p:childTnLst'];
		if (!isXmlObject(childTnLst) || countTimeNodeChildren(childTnLst) > 0) {
			return;
		}
		// `CT_TLTimeNodeList` requires at least one child, so an emptied list is
		// deleted rather than left behind as `<p:childTnLst/>`.
		delete cTn['p:childTnLst'];
		const nodeType = cTn['@_nodeType'];
		if (typeof nodeType === 'string' && STRUCTURAL_NODE_TYPES.has(nodeType)) {
			return;
		}
		detach(link.holder, link.key, link.node);
	}
}

/** The `p:cTn` of the tree's `mainSeq`, or `undefined` when it has none. */
export function findMainSequenceCTn(rawTiming: XmlObject): XmlObject | undefined {
	const tnLst = rawTiming['p:tnLst'];
	if (!isXmlObject(tnLst)) {
		return undefined;
	}
	let found: XmlObject | undefined;
	const visit = (holder: XmlObject): void => {
		for (const key of CONTAINER_KEYS) {
			for (const node of ensureArray(holder[key])) {
				const cTn = node['p:cTn'];
				if (!isXmlObject(cTn)) {
					continue;
				}
				if (cTn['@_nodeType'] === 'mainSeq') {
					found ??= cTn;
					return;
				}
				const childTnLst = cTn['p:childTnLst'];
				if (isXmlObject(childTnLst)) {
					visit(childTnLst);
				}
			}
		}
	};
	visit(tnLst);
	return found;
}

/** The `p:cTn` of the tree's `mainSeq`, creating the sequence when absent. */
export function ensureMainSequence(
	rawTiming: XmlObject,
	allocateId: () => number,
	buildMainSequence: (id: number) => XmlObject,
): XmlObject | undefined {
	const tnLst = rawTiming['p:tnLst'];
	if (!isXmlObject(tnLst)) {
		return undefined;
	}
	const found = findMainSequenceCTn(rawTiming);
	if (found) {
		return found;
	}

	// No main sequence: hang a fresh one off the timing root (or, failing that,
	// off `p:tnLst` itself) so the effect still has a home.
	const rootCTn = ensureArray(tnLst['p:par'])
		.map((node) => node['p:cTn'])
		.find((cTn): cTn is XmlObject => isXmlObject(cTn) && cTn['@_nodeType'] === 'tmRoot');
	const seqNode = buildMainSequence(allocateId());
	const seqCTn = seqNode['p:cTn'];
	if (!isXmlObject(seqCTn)) {
		return undefined;
	}
	if (rootCTn) {
		const childTnLst = isXmlObject(rootCTn['p:childTnLst'])
			? (rootCTn['p:childTnLst'] as XmlObject)
			: {};
		rootCTn['p:childTnLst'] = childTnLst;
		appendContainer(childTnLst, 'p:seq', seqNode);
	} else {
		appendContainer(tnLst, 'p:seq', seqNode);
	}
	return seqCTn;
}

/**
 * Reorder every `p:par` sibling of a `p:childTnLst` by an arbitrary rank,
 * moving each node to the slot implied by `rankOf`. A node absent from
 * `rankOf` keeps its original relative position (its own index is used as a
 * fallback rank), so groups nobody asked to move never appear to shuffle
 * around each other. Node content is never touched: only the array order
 * changes, which is why a deck's own untouched effect stays byte-identical
 * apart from its position.
 */
export function reorderContainersByRank(
	childTnLst: XmlObject,
	key: string,
	rankOf: ReadonlyMap<XmlObject, number>,
): void {
	const nodes = ensureArray(childTnLst[key]);
	if (nodes.length < 2) {
		return;
	}
	const indexed = nodes.map((node, index) => ({
		node,
		rank: rankOf.get(node) ?? index,
		index,
	}));
	indexed.sort((left, right) => left.rank - right.rank || left.index - right.index);
	const sorted = indexed.map((entry) => entry.node);
	childTnLst[key] = sorted.length === 1 ? sorted[0]! : sorted;
}
