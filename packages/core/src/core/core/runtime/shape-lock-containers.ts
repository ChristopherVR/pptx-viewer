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
 * S20.1.2.2.34) has `@noTextEdit`. `a:graphicFrameLocks`
 * (`CT_GraphicalObjectFrameLocking`, S20.1.2.2.19) is the narrowest of the
 * five: it takes `@noGrp` / `@noDrilldown` / `@noSelect` / `@noChangeAspect` /
 * `@noMove` / `@noResize` and nothing else - no rotation, no text editing, no
 * geometry editing, because a frame's payload owns those.
 *
 * The writer used to apply one flat attribute list to every container, so a
 * picture or connector whose locks were edited was emitted with a
 * `@noTextEdit` its type does not declare, and groups had no branch at all.
 */
import type { PptxShapeLocks, XmlObject } from '../../types';
import type { ShapeLockProperty } from './shape-lock-node';
import { parseShapeLockNode } from './shape-lock-node';

export type { ShapeLockProperty } from './shape-lock-node';
export { buildShapeLockNode, LOCK_ATTRIBUTE, parseShapeLockNode } from './shape-lock-node';

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
 * Every entry here is both parsed and written. That pairing is the whole
 * contract: the writer treats an absent `element.locks` as "the user cleared
 * the locks" and deletes the node, so adding a container to this table without
 * a parser for it does not round-trip a lock - it ERASES one on first save.
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
		// `CT_PictureLocking` is the only type that adds `@noCrop` to AG_Locking.
		permitted: [...AG_LOCKING, 'noCrop'],
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
	'p:graphicFrame': {
		nvKey: 'p:nvGraphicFramePr',
		cNvKey: 'p:cNvGraphicFramePr',
		lockTag: 'a:graphicFrameLocks',
		// `CT_GraphicalObjectFrameLocking` is NOT `AG_Locking`: it has no
		// `@noRot`, no `@noTextEdit` and none of the geometry-editing flags, and
		// it is the only type that declares `@noDrilldown`. Aliasing it onto the
		// shape list would emit five attributes the schema rejects.
		permitted: ['noGrouping', 'noDrilldown', 'noSelect', 'noChangeAspect', 'noMove', 'noResize'],
	},
};

/**
 * The lock container an element's markup actually has, preferring the shape of
 * the node over the element's declared type.
 *
 * The two disagree in real files, and the type is the wrong authority when
 * they do. Media is the clearest case: PowerPoint writes a video as a
 * `p:pic` (poster blip + `a:videoFile`), but `media` buckets as
 * `p:graphicFrame`, so trusting the type would rebuild `a:graphicFrameLocks`
 * on a node whose real locks live in `a:picLocks` - deleting the authored
 * ones. Loaded ink is the mirror image: it buckets as `p:sp` but arrives as a
 * graphic frame.
 *
 * @param shape the element's XML node
 * @param bucketKey the `p:spTree` bucket for the element's type, used only
 *   when the node carries no recognisable non-visual properties wrapper
 */
export function resolveShapeLockContainer(
	shape: XmlObject | undefined,
	bucketKey: string,
): ShapeLockContainerSpec | undefined {
	if (shape) {
		for (const spec of Object.values(SHAPE_LOCK_CONTAINERS)) {
			if (asNode(shape[spec.nvKey])) {
				return spec;
			}
		}
	}
	return SHAPE_LOCK_CONTAINERS[bucketKey];
}

/**
 * Narrow a parsed XML value to an element node.
 *
 * fast-xml-parser collapses an EMPTY element to the string `''`, not to `{}`.
 * `<p:cNvSpPr/>` - the commonest spelling in any real deck, because it is what
 * a shape with no locks yet looks like - therefore reads as a string, and every
 * `xmlPath(...)` walk through it returned `undefined`.
 */
function asNode(value: unknown): XmlObject | undefined {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

/**
 * Read one element's locks straight off its markup.
 *
 * This is the parse half of the contract described on
 * {@link SHAPE_LOCK_CONTAINERS}: every family the writer rebuilds must be read
 * back through here, or the first save wipes what the author wrote. Callers
 * pass the spec for the node they hold (a graphic-frame parser knows it has a
 * graphic frame), so the walk `p:nvXxxPr` -> `p:cNvXxxPr` -> lock element is
 * written once rather than at each parse site.
 */
export function parseShapeLocksFromNode(
	shape: XmlObject | undefined,
	spec: ShapeLockContainerSpec,
): PptxShapeLocks | undefined {
	const nv = asNode(shape?.[spec.nvKey]);
	const container = asNode(nv?.[spec.cNvKey]);
	return parseShapeLockNode(asNode(container?.[spec.lockTag]), spec);
}

/**
 * The `p:cNvXxxPr` node the lock element hangs on, creating it when the markup
 * has none and `create` is set.
 *
 * Two markup realities make this more than a property lookup:
 *
 *  - `<p:cNvSpPr/>` parses to `''` (see {@link asNode}). Reading through it
 *    yielded `undefined`, so the writer concluded there was nowhere to put the
 *    lock and skipped it - which meant locking a shape that was not ALREADY
 *    locked never reached the file, for every family at once.
 *  - `CT_NonVisualXxxProperties` is a SEQUENCE (`cNvPr`, `cNvXxxPr`, `nvPr`).
 *    Assigning a missing `p:cNvSpPr` onto the node would append it after
 *    `p:nvPr` and emit an out-of-order package, so the wrapper is rebuilt in
 *    place (same object identity, because callers hold the cached `rawXml`).
 *
 * @returns the container, or `undefined` when the element has no non-visual
 *   properties wrapper at all and there is therefore nothing to hang a lock on
 */
export function resolveLockContainerNode(
	shape: XmlObject,
	spec: ShapeLockContainerSpec,
	create: boolean,
): XmlObject | undefined {
	const nv = asNode(shape[spec.nvKey]);
	if (!nv) {
		return undefined;
	}
	const existing = asNode(nv[spec.cNvKey]);
	if (existing || !create) {
		return existing;
	}
	const created: XmlObject = {};
	const rebuilt: XmlObject = {};
	if ('p:cNvPr' in nv) {
		rebuilt['p:cNvPr'] = nv['p:cNvPr'];
	}
	rebuilt[spec.cNvKey] = created;
	for (const [key, value] of Object.entries(nv)) {
		if (key !== 'p:cNvPr' && key !== spec.cNvKey) {
			rebuilt[key] = value;
		}
	}
	for (const key of Object.keys(nv)) {
		delete nv[key];
	}
	Object.assign(nv, rebuilt);
	return created;
}
