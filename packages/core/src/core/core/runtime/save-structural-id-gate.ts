/**
 * Pure helpers for the last-export structural-id gate
 * (`PptxHandlerRuntimeSaveStructuralIds`).
 *
 * The save pipeline passes an unedited slide through byte-for-byte on purpose
 * (`canSkipSlideSave`) and re-serializes untouched layouts and masters straight
 * out of their cached parse. Either way, a part that was ALREADY carrying a
 * schema-invalid `p:cNvPr/@id` (not a UInt32), a duplicate id, or a
 * mis-cased `p:ph/@type` when it was loaded stays that way forever if the user
 * never edits it. These helpers decide, cheaply and precisely, which parts in
 * the finished ZIP need that repair, so every valid part stays byte-identical.
 */
import type { PptxSlide, XmlObject } from '../../types';
import { isTemplateElementId } from '../../utils/group-ops';
import { canonicalPlaceholderType } from '../../utils/placeholder-validation';
import { parseShapeId, remapElementShapeIds, remapShapeIdReferences } from '../../utils/shape-ids';
import type { MasterPartRootTag } from './master-part-tags';

/** Root tag of every part kind whose `p:cSld/p:spTree` the gate inspects. */
export type StructuralPartRootTag = MasterPartRootTag | 'p:sld' | 'p:notes';

const PART_ROOT_BY_PATH: ReadonlyArray<readonly [RegExp, StructuralPartRootTag]> = [
	[/^ppt\/slides\/[^/]+\.xml$/u, 'p:sld'],
	[/^ppt\/slideLayouts\/[^/]+\.xml$/u, 'p:sldLayout'],
	[/^ppt\/slideMasters\/[^/]+\.xml$/u, 'p:sldMaster'],
	[/^ppt\/notesSlides\/[^/]+\.xml$/u, 'p:notes'],
	[/^ppt\/notesMasters\/[^/]+\.xml$/u, 'p:notesMaster'],
	[/^ppt\/handoutMasters\/[^/]+\.xml$/u, 'p:handoutMaster'],
];

/** The root tag for a ZIP entry the gate covers, or `undefined` for any other entry. */
export function structuralPartRootTag(path: string): StructuralPartRootTag | undefined {
	return PART_ROOT_BY_PATH.find(([pattern]) => pattern.test(path))?.[1];
}

/** `p:cSld/p:spTree` under a part root, if present. */
export function spTreeOfPartRoot(root: XmlObject | undefined): XmlObject | undefined {
	const cSld = root?.['p:cSld'] as XmlObject | undefined;
	return cSld?.['p:spTree'] as XmlObject | undefined;
}

const CNVPR_ID_RE = /<(?:p|p14):cNvPr\b[^>]*?\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;
const PH_TYPE_RE = /<p:ph\b[^>]*?\stype\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;

export interface StructuralPartScan {
	/**
	 * A `p:cNvPr/@id` that is not a UInt32, or one that is declared twice. A
	 * repeat is only a SUSPICION at this level: real PowerPoint declares an
	 * `mc:Choice` shape and its `mc:Fallback` twin under one id, and that is
	 * not a defect. `hasStructuralIdDefects` settles it on the parsed tree.
	 */
	suspectIds: boolean;
	/** A `p:ph/@type` that is a placeholder type spelled in the wrong case. */
	placeholderCasing: boolean;
}

/**
 * Cheap string pre-scan of a serialized part. Parts that pass both checks are
 * never parsed, so the common case costs one regex pass and no bytes change.
 */
export function prescanStructuralPart(xml: string): StructuralPartScan {
	let suspectIds = false;
	const seen = new Set<number>();
	for (const match of xml.matchAll(CNVPR_ID_RE)) {
		const id = parseShapeId(match[1] ?? match[2], true);
		if (id === undefined || seen.has(id)) {
			suspectIds = true;
			break;
		}
		seen.add(id);
	}
	let placeholderCasing = false;
	for (const match of xml.matchAll(PH_TYPE_RE)) {
		const raw = match[1] ?? match[2] ?? '';
		const canonical = canonicalPlaceholderType(raw);
		if (canonical !== undefined && canonical !== raw) {
			placeholderCasing = true;
			break;
		}
	}
	return { suspectIds, placeholderCasing };
}

const NV_CONTAINERS: ReadonlyArray<readonly [string, string]> = [
	['p:nvSpPr', 'p:cNvPr'],
	['p:nvPicPr', 'p:cNvPr'],
	['p:nvCxnSpPr', 'p:cNvPr'],
	['p:nvGrpSpPr', 'p:cNvPr'],
	['p:nvGraphicFramePr', 'p:cNvPr'],
	['p:nvContentPartPr', 'p:cNvPr'],
	['p14:nvContentPartPr', 'p14:cNvPr'],
];
const SHAPE_LISTS = ['p:sp', 'p:pic', 'p:cxnSp', 'p:graphicFrame', 'p:grpSp', 'p:contentPart'];

/**
 * Count every declared id under `node` into `counts`; returns `false` as soon
 * as a declaration is not a UInt32. `mc:AlternateContent` branches are
 * alternative renderings of the SAME shapes, so an envelope contributes each
 * id once (the largest per-branch count), never once per branch.
 */
function countDeclaredIds(
	node: XmlObject,
	counts: Map<number, number>,
	ensureArray: (value: unknown) => unknown[],
): boolean {
	for (const [nvTag, cNvPrTag] of NV_CONTAINERS) {
		const cNvPr = (node[nvTag] as XmlObject | undefined)?.[cNvPrTag] as XmlObject | undefined;
		if (!cNvPr) {
			continue;
		}
		const id = parseShapeId(cNvPr['@_id'], true);
		if (id === undefined) {
			return false;
		}
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	for (const listKey of SHAPE_LISTS) {
		for (const child of ensureArray(node[listKey]) as XmlObject[]) {
			if (!countDeclaredIds(child, counts, ensureArray)) {
				return false;
			}
		}
	}
	for (const envelope of ensureArray(node['mc:AlternateContent']) as XmlObject[]) {
		const merged = new Map<number, number>();
		for (const branchKey of ['mc:Choice', 'mc:Fallback']) {
			for (const branch of ensureArray(envelope[branchKey]) as XmlObject[]) {
				const branchCounts = new Map<number, number>();
				if (!countDeclaredIds(branch, branchCounts, ensureArray)) {
					return false;
				}
				for (const [id, count] of branchCounts) {
					merged.set(id, Math.max(merged.get(id) ?? 0, count));
				}
			}
		}
		for (const [id, count] of merged) {
			counts.set(id, (counts.get(id) ?? 0) + count);
		}
	}
	return true;
}

/**
 * Whether a shape tree (with its `mc:AlternateContent` envelopes intact, i.e.
 * freshly parsed from the serialized part) declares an id that is not a
 * UInt32, or declares one id for two different shapes.
 */
export function hasStructuralIdDefects(
	spTree: XmlObject,
	ensureArray: (value: unknown) => unknown[],
): boolean {
	const counts = new Map<number, number>();
	if (!countDeclaredIds(spTree, counts, ensureArray)) {
		return true;
	}
	for (const count of counts.values()) {
		if (count > 1) {
			return true;
		}
	}
	return false;
}

/**
 * Replay a shape-id reassignment onto everything a slide keeps OUTSIDE the
 * serialized part: its own (non-template) elements, the cached `rawTiming`
 * the animation writer re-emits, and the typed ActiveX controls
 * `applyActiveXControlsToSlide` rebuilds `p:controls` from. Template
 * (`layout-` / `master-`) copies belong to another part's id space and are
 * left alone.
 */
export function applyShapeIdMapToSlide(slide: PptxSlide, ids: ReadonlyMap<string, string>): void {
	if (ids.size === 0) {
		return;
	}
	remapElementShapeIds(
		slide.elements.filter((element) => !isTemplateElementId(element.id)),
		ids,
	);
	if (slide.rawTiming) {
		remapShapeIdReferences(slide.rawTiming, ids);
	}
	for (const control of slide.activeXControls ?? []) {
		const replacement = control.shapeId === undefined ? undefined : ids.get(control.shapeId.trim());
		if (replacement !== undefined) {
			control.shapeId = replacement;
		}
	}
}
