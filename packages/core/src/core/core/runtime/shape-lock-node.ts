/**
 * @fileoverview The attribute half of the lock model: which lock attribute
 * each `PptxShapeLocks` property maps to, and the two functions that move a
 * lock element between the model and its markup for ONE container spec.
 *
 * The container table itself (where each family's lock element hangs and
 * what its complex type permits) lives in `shape-lock-containers.ts`; this
 * module is split out of it only to keep both files within the size budget.
 */
import type { PptxShapeLocks, XmlObject } from '../../types';
import type { ShapeLockContainerSpec } from './shape-lock-containers';

/**
 * The lock flags this model represents. `txBox` is deliberately absent: it is
 * an attribute of `p:cNvSpPr` itself, not of the `a:spLocks` child, and is
 * written by the shape XML factory.
 */
export type ShapeLockProperty = Exclude<keyof PptxShapeLocks, 'txBox'>;

/** Model property -> lock attribute name, for every lock this model carries. */
export const LOCK_ATTRIBUTE: Readonly<Record<ShapeLockProperty, string>> = {
	noGrouping: '@_noGrp',
	noRotation: '@_noRot',
	noMove: '@_noMove',
	noResize: '@_noResize',
	noTextEdit: '@_noTextEdit',
	noSelect: '@_noSelect',
	noChangeAspect: '@_noChangeAspect',
	noEditPoints: '@_noEditPoints',
	noAdjustHandles: '@_noAdjustHandles',
	noChangeArrowheads: '@_noChangeArrowheads',
	noChangeShapeType: '@_noChangeShapeType',
	noDrilldown: '@_noDrilldown',
	noCrop: '@_noCrop',
};

/** Every attribute the model owns, so carry-over can skip them. */
const MODELLED_ATTRIBUTES: ReadonlySet<string> = new Set(Object.values(LOCK_ATTRIBUTE));

/**
 * Modelled locks whose authored value survives when the model is silent about
 * them (`undefined`), instead of being treated as "cleared".
 *
 * `noCrop` is here because not every picture parse path reads it yet: the
 * regular `p:pic` parser goes through `parseShapeLocks` in
 * `PptxHandlerRuntimeShapeBodyParsing`, which has a fixed attribute list
 * without `@noCrop`. A picture loaded that way reaches the writer with
 * `locks.noCrop === undefined`, and deleting the attribute on that evidence
 * would erase an authored crop lock on the first save of any other lock.
 */
const CARRIED_WHEN_UNSET: ReadonlySet<ShapeLockProperty> = new Set<ShapeLockProperty>(['noCrop']);

/**
 * Build the replacement lock node for one container.
 *
 * Attributes the model does not describe (`a:grpSpLocks/@noUngrp`) and any
 * `a:extLst` are carried over from `existing`: rewriting the node from the
 * model alone dropped them the first time any other lock on the same shape
 * was edited. Modelled attributes that this container does not permit are NOT
 * carried over, so a `@noTextEdit` that only ever got onto a `a:picLocks`
 * because the writer applied one flat list is corrected rather than
 * preserved. Modelled, permitted attributes the model leaves `undefined` are
 * removed, except the ones in {@link CARRIED_WHEN_UNSET}.
 *
 * @returns the node to write, or `undefined` when nothing is left to write and
 *   the caller should delete the element.
 */
export function buildShapeLockNode(
	locks: PptxShapeLocks | undefined,
	spec: ShapeLockContainerSpec,
	existing: XmlObject | undefined,
): XmlObject | undefined {
	const node: XmlObject = {};
	for (const [key, value] of Object.entries(existing ?? {})) {
		if (!MODELLED_ATTRIBUTES.has(key)) {
			node[key] = value;
		}
	}
	for (const prop of spec.permitted) {
		const value = locks?.[prop];
		if (value !== undefined) {
			node[LOCK_ATTRIBUTE[prop]] = value ? '1' : '0';
		} else if (CARRIED_WHEN_UNSET.has(prop) && existing?.[LOCK_ATTRIBUTE[prop]] !== undefined) {
			node[LOCK_ATTRIBUTE[prop]] = existing[LOCK_ATTRIBUTE[prop]];
		}
	}
	return Object.keys(node).length > 0 ? node : undefined;
}

/**
 * Parse a lock element into the model, restricted to the attributes its type
 * declares. Mirrors {@link buildShapeLockNode} so a container round-trips.
 */
export function parseShapeLockNode(
	node: XmlObject | undefined,
	spec: ShapeLockContainerSpec,
): PptxShapeLocks | undefined {
	if (!node) {
		return undefined;
	}
	const locks: PptxShapeLocks = {};
	let hasAny = false;
	for (const prop of spec.permitted) {
		const raw = node[LOCK_ATTRIBUTE[prop]];
		if (raw === undefined) {
			continue;
		}
		const value = String(raw).trim().toLowerCase();
		locks[prop] = value === '1' || value === 'true';
		hasAny = true;
	}
	return hasAny ? locks : undefined;
}
