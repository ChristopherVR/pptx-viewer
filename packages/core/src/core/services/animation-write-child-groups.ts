/**
 * Fold a list of tagged behaviour nodes (`_type` = `set` / `anim` /
 * `animEffect` / ...) into the keyed `p:childTnLst` object the XML builder
 * serialises. Nodes of one kind keep their relative order; the builder has
 * no way to interleave kinds, which is harmless because an effect's
 * children all start in parallel and each kind drives its own attributes.
 *
 * @module services/animation-write-child-groups
 */
import type { XmlObject } from '../types';

/** Serialisation order of the behaviour kinds inside `p:childTnLst`. */
const KIND_ORDER = [
	'set',
	'animEffect',
	'animClr',
	'animMotion',
	'anim',
	'animRot',
	'animScale',
] as const;

type BehaviorKind = (typeof KIND_ORDER)[number];

function isBehaviorKind(value: string | undefined): value is BehaviorKind {
	return (KIND_ORDER as ReadonlyArray<string>).includes(value ?? '');
}

/**
 * Build a `p:childTnLst` object from tagged nodes. Consumes each node's
 * `_type` tag; an untagged node is treated as a `p:animEffect`.
 */
export function groupBehaviorChildren(children: ReadonlyArray<XmlObject>): XmlObject {
	const groups = new Map<BehaviorKind, XmlObject[]>();
	for (const child of children) {
		const tag = child['_type'] as string | undefined;
		delete child['_type'];
		const kind: BehaviorKind = isBehaviorKind(tag) ? tag : 'animEffect';
		const list = groups.get(kind) ?? [];
		list.push(child);
		groups.set(kind, list);
	}
	const childTnLst: XmlObject = {};
	for (const kind of KIND_ORDER) {
		const list = groups.get(kind);
		if (list && list.length > 0) {
			childTnLst[`p:${kind}`] = list.length === 1 ? list[0] : list;
		}
	}
	return childTnLst;
}
