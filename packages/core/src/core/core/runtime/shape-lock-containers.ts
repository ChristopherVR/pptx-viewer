/**
 * @fileoverview Where each element family's lock element lives, and which
 * attributes its complex type actually permits.
 *
 * DrawingML does not use one lock element for everything. Each non-visual
 * properties node carries its own type, and they are NOT aliases of each
 * other: `a:grpSpLocks` (`CT_GroupLocking`, S20.1.2.2.21) accepts `@noUngrp`
 * and rejects `@noEditPoints` / `@noAdjustHandles` / `@noChangeArrowheads` /
 * `@noChangeShapeType` / `@noTextEdit`, while `a:picLocks`
 * (`CT_PictureLocking`, S20.1.2.2.31) and `a:cxnSpLocks`
 * (`CT_ConnectorLocking`, S20.1.2.2.11) take the shared `AG_Locking` set plus,
 * for pictures only, `@noCrop`. Only `a:spLocks` (`CT_ShapeLocking`,
 * S20.1.2.2.34) has `@noTextEdit`.
 *
 * The writer used to apply one flat attribute list to every container, so a
 * picture or connector whose locks were edited was emitted with a
 * `@noTextEdit` its type does not declare, and groups had no branch at all.
 */
import type { PptxShapeLocks, XmlObject } from '../../types';

/** Model property -> lock attribute name, for every lock this model carries. */
const LOCK_ATTRIBUTE: Readonly<Record<ShapeLockProperty, string>> = {
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
};

/**
 * The lock flags this model represents. `txBox` is deliberately absent: it is
 * an attribute of `p:cNvSpPr` itself, not of the `a:spLocks` child, and is
 * written by the shape XML factory.
 */
export type ShapeLockProperty = Exclude<keyof PptxShapeLocks, 'txBox'>;

/** `AG_Locking`: the attribute group every lock type below is built on. */
const AG_LOCKING: readonly ShapeLockProperty[] = [
	'noGrouping',
	'noSelect',
	'noRotation',
	'noChangeAspect',
	'noMove',
	'noResize',
	'noEditPoints',
	'noAdjustHandles',
	'noChangeArrowheads',
	'noChangeShapeType',
];

/** Where one element family's lock element hangs, and what it may carry. */
export interface ShapeLockContainerSpec {
	/** The `p:nvXxxPr` wrapper. */
	readonly nvKey: string;
	/** The `p:cNvXxxPr` node the lock element is a child of. */
	readonly cNvKey: string;
	/** The lock element name. */
	readonly lockTag: string;
	/** Model properties this lock type declares. */
	readonly permitted: readonly ShapeLockProperty[];
}

/**
 * Keyed by the `p:spTree` bucket tag an element serializes into, which is what
 * {@link PptxHandlerRuntimeElementActions.getTreeBucketKeyForElementType}
 * returns.
 *
 * `p:graphicFrame` is absent on purpose: `a:graphicFrameLocks`
 * (`CT_GraphicalObjectFrameLocking`) is not parsed into the model anywhere, so
 * serializing from an always-undefined `element.locks` would delete whatever
 * the authored file had rather than round-trip it.
 */
export const SHAPE_LOCK_CONTAINERS: Readonly<Record<string, ShapeLockContainerSpec>> = {
	'p:sp': {
		nvKey: 'p:nvSpPr',
		cNvKey: 'p:cNvSpPr',
		lockTag: 'a:spLocks',
		permitted: [...AG_LOCKING, 'noTextEdit'],
	},
	'p:pic': {
		nvKey: 'p:nvPicPr',
		cNvKey: 'p:cNvPicPr',
		lockTag: 'a:picLocks',
		permitted: AG_LOCKING,
	},
	'p:cxnSp': {
		nvKey: 'p:nvCxnSpPr',
		cNvKey: 'p:cNvCxnSpPr',
		lockTag: 'a:cxnSpLocks',
		permitted: AG_LOCKING,
	},
	'p:grpSp': {
		nvKey: 'p:nvGrpSpPr',
		cNvKey: 'p:cNvGrpSpPr',
		lockTag: 'a:grpSpLocks',
		// CT_GroupLocking omits the shape-editing half of AG_Locking; `@noUngrp`
		// is its own addition and has no model property, so it survives as a
		// carried-over attribute rather than being written from the model.
		permitted: ['noGrouping', 'noSelect', 'noRotation', 'noChangeAspect', 'noMove', 'noResize'],
	},
};

/** Every attribute the model owns, so carry-over can skip them. */
const MODELLED_ATTRIBUTES: ReadonlySet<string> = new Set(Object.values(LOCK_ATTRIBUTE));

/**
 * Build the replacement lock node for one container.
 *
 * Attributes the model does not describe (`a:grpSpLocks/@noUngrp`,
 * `a:picLocks/@noCrop`) and any `a:extLst` are carried over from `existing`:
 * rewriting the node from the model alone dropped them the first time any
 * other lock on the same shape was edited. Modelled attributes that this
 * container does not permit are NOT carried over, so a `@noTextEdit` that only
 * ever got onto a `a:picLocks` because the writer applied one flat list is
 * corrected rather than preserved.
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
	if (locks) {
		for (const prop of spec.permitted) {
			const value = locks[prop];
			if (value !== undefined) {
				node[LOCK_ATTRIBUTE[prop]] = value ? '1' : '0';
			}
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
