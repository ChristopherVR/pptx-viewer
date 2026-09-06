/**
 * Pure helpers for serialising a `GroupPptxElement` back to `<p:grpSp>`.
 *
 * These live outside the runtime mixin so they can be unit-tested directly
 * (the mixin chain has a circular import when loaded standalone) and so
 * `PptxHandlerRuntimeSaveShapeXml` stays a thin orchestrator.
 *
 * Two ECMA-376 rules drive everything here:
 *
 * 1. `CT_GroupShape` (§19.3.1.45) is `nvGrpSpPr, grpSpPr, (sp | grpSp |
 *    graphicFrame | cxnSp | pic | contentPart)*, extLst?`. A chart, table,
 *    SmartArt, OLE object or media child is a `p:graphicFrame` - emitting it
 *    under `p:sp` (which is `CT_Shape`, and may only carry `p:nvSpPr` /
 *    `p:spPr` / `p:style` / `p:txBody`) produces a package PowerPoint
 *    refuses to open.
 * 2. `p:nvGrpSpPr/p:cNvPr/@id` is the identity that `p:timing`'s
 *    `p:spTgt/@spid`, the Selection Pane and `a:hlinkClick` bind to.
 *    Regenerating it silently unbinds every animation targeting the group,
 *    so a group that came from the file keeps its original non-visual
 *    properties and its original `p:grpSpPr` (fill, effects, locks).
 */
import type { PptxElement, XmlObject } from '../../types';
import { assignOrderedXmlChildren } from './ordered-xml-children';

// Transform-building helpers (`a:xfrm`, `a:chOff`/`a:chExt`, and each
// child's `a:off`/`a:ext`) live in their own module to keep this file under
// the repo's 300-LOC guideline; re-exported here so existing callers of
// `save-group-shape-xml.ts` keep working unchanged.
export type {
	GroupTransformInput,
	GroupChildTransformInput,
	GroupOwnEmuOverride,
} from './save-group-transform-xml';
export { buildGroupTransformXml, applyGroupChildTransform } from './save-group-transform-xml';

/**
 * The tags a `<p:grpSp>` child may be written under. The first six are the
 * `CT_GroupShape` choice; the last four mirror the extension tags this
 * writer already emits as direct `<p:spTree>` children so a grouped 3D
 * model or zoom is not silently mangled into `<p:sp>`.
 */
export type GroupChildTag =
	| 'p:sp'
	| 'p:grpSp'
	| 'p:graphicFrame'
	| 'p:cxnSp'
	| 'p:pic'
	| 'p:contentPart'
	| 'p16:model3D'
	| 'pslz:sldZm'
	| 'psezm:sectionZm'
	| 'psuz:summaryZm';

/** Every tag a group child may be written under. */
export const GROUP_CHILD_TAGS: readonly GroupChildTag[] = [
	'p:sp',
	'p:grpSp',
	'p:graphicFrame',
	'p:cxnSp',
	'p:pic',
	'p:contentPart',
	'p16:model3D',
	'pslz:sldZm',
	'psezm:sectionZm',
	'psuz:summaryZm',
];

/**
 * Fallback bucket per `PptxElement` discriminant, used only when the child's
 * XML carries no structural marker of its own (an SDK-created element).
 */
const TAG_BY_ELEMENT_TYPE: Partial<Record<PptxElement['type'], GroupChildTag>> = {
	text: 'p:sp',
	shape: 'p:sp',
	ink: 'p:sp',
	connector: 'p:cxnSp',
	picture: 'p:pic',
	image: 'p:pic',
	group: 'p:grpSp',
	contentPart: 'p:contentPart',
	table: 'p:graphicFrame',
	chart: 'p:graphicFrame',
	smartArt: 'p:graphicFrame',
	ole: 'p:graphicFrame',
	media: 'p:graphicFrame',
	model3d: 'p16:model3D',
};

/**
 * Decide which `CT_GroupShape` child tag a group child must be written under.
 *
 * The child's own XML shape wins over its typed discriminant, because
 * several element types round-trip in more than one markup form: real
 * PowerPoint media is `p:pic`-shaped (poster blip + `a:videoFile`) rather
 * than a graphic frame, and loaded ink is a graphic frame rather than the
 * `p:sp` the SDK writer fabricates.
 *
 * @returns the tag, or `null` when the node cannot be placed safely (better
 *   to skip one child with a warning than to corrupt the whole package).
 */
export function classifyGroupChildTag(
	elementType: PptxElement['type'],
	xml: XmlObject,
): GroupChildTag | null {
	if (xml['p:nvGrpSpPr']) {
		return 'p:grpSp';
	}
	if (xml['p:nvPicPr']) {
		return 'p:pic';
	}
	if (xml['p:nvCxnSpPr']) {
		return 'p:cxnSp';
	}
	if (xml['p:nvGraphicFramePr'] || (xml['a:graphic'] && xml['p:xfrm'])) {
		return 'p:graphicFrame';
	}
	if (xml['p16:model3Drel']) {
		return 'p16:model3D';
	}
	if (xml['pslz:sldZmObj']) {
		return 'pslz:sldZm';
	}
	if (xml['psezm:sectionZmObj']) {
		return 'psezm:sectionZm';
	}
	if (xml['psuz:summaryZmObj']) {
		return 'psuz:summaryZm';
	}
	if (xml['p:nvSpPr']) {
		return 'p:sp';
	}
	return TAG_BY_ELEMENT_TYPE[elementType] ?? null;
}

/** Structured-clone an XML node so patching it never mutates the loaded tree. */
export function cloneXmlNode(node: XmlObject): XmlObject {
	return JSON.parse(JSON.stringify(node)) as XmlObject;
}

/**
 * Build `p:nvGrpSpPr`, preserving the original `p:cNvPr` (id, name, `@descr`,
 * `@hidden`, `a:hlinkClick`) and `a:grpSpLocks` when the group came from a
 * file. Only a group with no original markup gets a fabricated skeleton.
 *
 * `modelName` is the group's user-visible name. A defined value wins over the
 * original markup so a Selection Pane rename persists (groups return from the
 * element writer before `applyNameToCnvPr` runs, so the name has to be applied
 * here); `undefined` means "no opinion" and keeps whatever the file had.
 */
export function buildGroupNonVisualXml(
	rawGroupXml: XmlObject | undefined,
	modelName: string | undefined,
	fallbackName: string,
): XmlObject {
	const rawNv = rawGroupXml?.['p:nvGrpSpPr'] as XmlObject | undefined;
	if (!rawNv) {
		return {
			'p:cNvPr': { '@_id': '0', '@_name': modelName ?? fallbackName },
			'p:cNvGrpSpPr': {},
			'p:nvPr': {},
		};
	}
	const nv = cloneXmlNode(rawNv);
	const cNvPr = (nv['p:cNvPr'] as XmlObject | undefined) ?? {};
	if (typeof cNvPr['@_id'] !== 'string' || cNvPr['@_id'].length === 0) {
		cNvPr['@_id'] = '0';
	}
	if (modelName !== undefined) {
		cNvPr['@_name'] = modelName;
	} else if (typeof cNvPr['@_name'] !== 'string') {
		cNvPr['@_name'] = fallbackName;
	}
	nv['p:cNvPr'] = cNvPr;
	nv['p:cNvGrpSpPr'] ??= {};
	nv['p:nvPr'] ??= {};
	return nv;
}

/**
 * Build `p:grpSpPr`, keeping every original child (group fill, effects,
 * `a:scene3d`, `@bwMode`) and replacing only `a:xfrm`.
 *
 * `CT_GroupShapeProperties` is a sequence starting with `a:xfrm`, so the
 * transform is spread first rather than assigned onto the clone: assigning
 * onto a clone that had no `a:xfrm` would append it after `a:solidFill` and
 * emit an out-of-order (invalid) sequence.
 */
export function buildGroupPropertiesXml(
	rawGroupXml: XmlObject | undefined,
	xfrm: XmlObject,
): XmlObject {
	const rawProps = rawGroupXml?.['p:grpSpPr'] as XmlObject | undefined;
	if (!rawProps) {
		return { 'a:xfrm': xfrm };
	}
	const clone = cloneXmlNode(rawProps);
	delete clone['a:xfrm'];
	return { 'a:xfrm': xfrm, ...clone };
}

/** One classified group child, ready to be assigned onto the `p:grpSp`. */
export interface GroupChildEntry {
	readonly tag: GroupChildTag;
	readonly xml: XmlObject;
}

/**
 * Assign classified children onto the `p:grpSp` node in DOCUMENT order,
 * keeping `p:extLst` (if the group carried one) last.
 *
 * `CT_GroupShape` is a painter's-algorithm sequence, so one array per tag
 * restacks the group: a picture authored behind three shapes jumps in front of
 * them. `entries` must therefore arrive in `GroupPptxElement.children` order,
 * which is document order, and ordering is delegated to the repo's single
 * `#pptx-order-N` primitive rather than a second mechanism.
 *
 * `grpXml` must be a spine the caller owns (a fresh object, or a shallow
 * clone), never a node from the cached slide map: the markers are stripped at
 * serialization time, but they would still leak into a cached tree.
 */
export function appendGroupChildren(grpXml: XmlObject, entries: readonly GroupChildEntry[]): void {
	const extLst = grpXml['p:extLst'];
	if (extLst !== undefined) {
		delete grpXml['p:extLst'];
	}
	assignOrderedXmlChildren(
		grpXml,
		entries.map((entry) => ({ tag: entry.tag, node: entry.xml })),
	);
	if (extLst !== undefined) {
		grpXml['p:extLst'] = extLst;
	}
}
