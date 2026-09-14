import type { XmlObject } from '../../types';
import { MAX_SHAPE_ID, parseShapeId, remapShapeIdReferences } from '../../utils/shape-ids';

/**
 * Shape ID uniqueness validator for OOXML slide shape trees.
 *
 * OpenXML requires that every `p:cNvPr/@id` within a single slide's
 * `p:spTree` is unique and a UInt32 (`ST_DrawingElementId`). Duplicate or
 * out-of-range IDs can corrupt files in MS Office. This validator scans the
 * tree and reassigns every duplicate, unassigned (`0`) or invalid ID.
 */

/** Recursively collect all cNvPr nodes from a shape tree. */
function collectCnvPrNodes(
	node: XmlObject,
	results: XmlObject[],
	ensureArray: (value: unknown) => unknown[],
): void {
	// Check direct cNvPr references in nvSpPr, nvPicPr, nvCxnSpPr, nvGrpSpPr, nvGraphicFramePr
	const nvContainers = [
		'p:nvSpPr',
		'p:nvPicPr',
		'p:nvCxnSpPr',
		'p:nvGrpSpPr',
		'p:nvGraphicFramePr',
		'p:nvContentPartPr',
	];
	for (const nvKey of nvContainers) {
		const nvNode = node[nvKey] as XmlObject | undefined;
		if (nvNode?.['p:cNvPr']) {
			results.push(nvNode['p:cNvPr'] as XmlObject);
		}
	}
	// A real `p:contentPart`'s non-visual properties are `p14:`-qualified, not
	// `p:`-qualified (verified against PowerPoint's own SaveAs output; see
	// `mc-capabilities.ts`), so a content part's id lives at
	// `p14:nvContentPartPr/p14:cNvPr`. Missing this left the id invisible to
	// this validator: it could no longer detect (or dedupe) a collision
	// between an authored content part and an ordinary shape, so a freshly
	// drawn stroke could silently reuse another shape's id and produce a
	// package PowerPoint's own reader rejects as corrupted.
	const p14ContentPartNv = node['p14:nvContentPartPr'] as XmlObject | undefined;
	if (p14ContentPartNv?.['p14:cNvPr']) {
		results.push(p14ContentPartNv['p14:cNvPr'] as XmlObject);
	}

	// Recurse into shape lists
	const shapeLists = ['p:sp', 'p:pic', 'p:cxnSp', 'p:graphicFrame', 'p:grpSp', 'p:contentPart'];
	for (const listKey of shapeLists) {
		const children = ensureArray(node[listKey]) as XmlObject[];
		for (const child of children) {
			collectCnvPrNodes(child, results, ensureArray);
		}
	}

	// Ink and other Office extensions place their real element and fallback
	// shape inside mc:AlternateContent branches. Those nodes still occupy the
	// slide's non-visual ID space and must participate in duplicate
	// detection, or a Draw operation can introduce a repeated id that makes
	// desktop PowerPoint repair or reject the deck.
	for (const alternate of ensureArray(node['mc:AlternateContent']) as XmlObject[]) {
		for (const branchKey of ['mc:Choice', 'mc:Fallback']) {
			for (const branch of ensureArray(alternate[branchKey]) as XmlObject[]) {
				collectCnvPrNodes(branch, results, ensureArray);
			}
		}
	}
}

/** Outcome of one shape-tree repair. */
export interface ShapeIdRepairResult {
	/** Number of `p:cNvPr/@id` declarations that were rewritten. */
	reassigned: number;
	/**
	 * Old raw id text -> fresh id, one entry per rewritten declaration. A
	 * later duplicate of the same old id overwrites the earlier entry, so a
	 * reference to a duplicated id follows the LAST shape renumbered (the one
	 * a paste brought in alongside its connector).
	 */
	ids: Map<string, string>;
}

export interface IPptxShapeIdValidator {
	validateAndDeduplicateIds(
		spTree: XmlObject,
		ensureArray: (value: unknown) => unknown[],
		referenceRoot?: XmlObject,
	): number;
	repairShapeIds(
		spTree: XmlObject,
		ensureArray: (value: unknown) => unknown[],
		referenceRoot?: XmlObject,
	): ShapeIdRepairResult;
}

/**
 * Hands out fresh ids above the largest valid one already in the tree and,
 * once the UInt32 ceiling is reached, falls back to the lowest free gap.
 */
class ShapeIdAllocator {
	private gapCursor = 1;

	constructor(
		private readonly used: Set<number>,
		private maxId: number,
	) {}

	next(): number {
		if (this.maxId < MAX_SHAPE_ID) {
			this.maxId += 1;
			this.used.add(this.maxId);
			return this.maxId;
		}
		while (this.gapCursor <= MAX_SHAPE_ID && this.used.has(this.gapCursor)) {
			this.gapCursor += 1;
		}
		if (this.gapCursor > MAX_SHAPE_ID) {
			throw new Error('No free DrawingML shape id left in this shape tree.');
		}
		this.used.add(this.gapCursor);
		return this.gapCursor;
	}
}

/**
 * Validates shape IDs in a slide's spTree and reassigns duplicates.
 * Returns the number of IDs that were reassigned.
 */
export class PptxShapeIdValidator implements IPptxShapeIdValidator {
	public validateAndDeduplicateIds(
		spTree: XmlObject,
		ensureArray: (value: unknown) => unknown[],
		referenceRoot: XmlObject = spTree,
	): number {
		return this.repairShapeIds(spTree, ensureArray, referenceRoot).reassigned;
	}

	/**
	 * Same repair, but also returns the old-id -> new-id map so a caller can
	 * replay it onto state that lives outside `referenceRoot` (the live element
	 * model, a cached `rawTiming`, typed ActiveX controls).
	 */
	public repairShapeIds(
		spTree: XmlObject,
		ensureArray: (value: unknown) => unknown[],
		referenceRoot: XmlObject = spTree,
	): ShapeIdRepairResult {
		const ids = new Map<string, string>();
		const cNvPrNodes: XmlObject[] = [];
		collectCnvPrNodes(spTree, cNvPrNodes, ensureArray);

		if (cNvPrNodes.length === 0) {
			return { reassigned: 0, ids };
		}

		// Collect all valid, unique IDs; everything else gets a fresh one. A
		// non-integer, negative, decimal or > 0xFFFFFFFF value is schema-invalid
		// (`ST_DrawingElementId` is a UInt32) and must never seed the "max so
		// far": a timestamp-sized id would otherwise be incremented into more
		// invalid ids.
		const usedIds = new Set<number>();
		const invalid: XmlObject[] = [];
		let maxId = 0;

		for (const cNvPr of cNvPrNodes) {
			const id = parseShapeId(cNvPr['@_id'], true);
			if (id === undefined || id === 0 || usedIds.has(id)) {
				invalid.push(cNvPr);
				continue;
			}
			usedIds.add(id);
			if (id > maxId) {
				maxId = id;
			}
		}

		// Reassign. A connector bound to one of these shapes (`a:stCxn` /
		// `a:endCxn` @_id) or an animation targeting it (`p:spTgt/@spid`)
		// references the OLD id, so every reassignment is remembered and
		// replayed onto `referenceRoot`; otherwise a dedup here silently
		// detaches the connector's endpoint or drops the effect (or worse,
		// re-targets it at whatever shape now holds the old id).
		const allocator = new ShapeIdAllocator(usedIds, maxId);
		for (const cNvPr of invalid) {
			const oldId = String(cNvPr['@_id'] ?? '').trim();
			const fresh = String(allocator.next());
			cNvPr['@_id'] = fresh;
			if (oldId.length > 0) {
				ids.set(oldId, fresh);
			}
		}

		remapShapeIdReferences(referenceRoot, ids);

		return { reassigned: invalid.length, ids };
	}
}
