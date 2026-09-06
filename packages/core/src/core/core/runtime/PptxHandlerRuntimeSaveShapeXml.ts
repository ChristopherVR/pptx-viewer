import { XmlObject } from '../../types';
import type {
	ChartPptxElement,
	InkPptxElement,
	GroupPptxElement,
	OlePptxElement,
	PptxElement,
	TablePptxElement,
} from '../../types';
import { resolveGroupChildBoxEmu, resolveGroupTightRewrap } from './group-tight-rewrap';
import type { GroupChildSpaceOwner } from './group-xfrm-preservation';
import type { SaveSlideContext } from './PptxHandlerRuntimeSaveElementEmbedding';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveElements';
import type { SlideShapeCollectors } from './PptxHandlerRuntimeSaveElementWriter';
import {
	createGroupChildCollectors,
	pickGroupChildFromCollectors,
} from './save-group-child-collectors';
import { groupChildInheritedFill } from './save-group-fill';
import type { GroupChildEntry, GroupOwnEmuOverride } from './save-group-shape-xml';
import {
	appendGroupChildren,
	applyGroupChildTransform,
	buildGroupNonVisualXml,
	buildGroupPropertiesXml,
	buildGroupTransformXml,
	classifyGroupChildTag,
} from './save-group-shape-xml';
import { buildChartGraphicFrameXml, buildTableGraphicFrameXml } from './save-shape-xml-frames';
import { buildInkShapeXml } from './save-shape-xml-ink';
import {
	applyOleTypedFieldUpdatesXml,
	buildOleGraphicFrameXml,
	OLE_IMAGE_RELATIONSHIP_TYPE,
	OLE_OBJECT_RELATIONSHIP_TYPE,
	resolveOleEmbedRelationshipIdFromRels,
} from './save-shape-xml-ole';

/** Relationship type for chart parts. */
export const CHART_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';

/** Content type for a chart part in `[Content_Types].xml`. */
export const CHART_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

/** The save context a group child needs to serialise like a top-level shape. */
export type GroupChildSaveContext = SaveSlideContext;

/**
 * Structural view of the element writer that lives further down the mixin
 * chain. `buildGroupShapeXml` is defined in an ancestor mixin, so
 * `processSlideElement` is present at runtime but not in this class's static
 * type; this interface names the one method needed without widening to `any`.
 */
interface GroupChildElementWriter {
	processSlideElement(
		el: PptxElement,
		collectors: SlideShapeCollectors,
		ctx: GroupChildSaveContext,
	): void;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** See `save-shape-xml-frames.ts`'s `buildTableGraphicFrameXml`. */
	protected createTableGraphicFrameXml(el: TablePptxElement): XmlObject {
		return buildTableGraphicFrameXml(el, PptxHandlerRuntime.EMU_PER_PX);
	}

	/** See `save-shape-xml-frames.ts`'s `buildChartGraphicFrameXml`. */
	protected createChartGraphicFrameXml(
		el: ChartPptxElement,
		relId: string,
		extended = false,
	): XmlObject {
		return buildChartGraphicFrameXml(el, PptxHandlerRuntime.EMU_PER_PX, relId, extended);
	}

	/** See `save-shape-xml-ole.ts`'s `buildOleGraphicFrameXml`. */
	protected createOleGraphicFrameXml(el: OlePptxElement, embedRelationshipId: string): XmlObject {
		return buildOleGraphicFrameXml(el, PptxHandlerRuntime.EMU_PER_PX, embedRelationshipId);
	}

	/** See `save-shape-xml-ole.ts`'s `applyOleTypedFieldUpdatesXml`. */
	protected applyOleTypedFieldUpdates(shape: XmlObject, el: OlePptxElement): void {
		applyOleTypedFieldUpdatesXml(shape, el);
	}

	/** See `save-shape-xml-ole.ts`'s `resolveOleEmbedRelationshipIdFromRels`. */
	protected resolveOleEmbedRelationshipId(
		slideRelationships: XmlObject[],
		oleTarget: string | undefined,
	): string | undefined {
		return resolveOleEmbedRelationshipIdFromRels(slideRelationships, oleTarget);
	}

	/** Constants are exposed so the element-writer mixin can reuse them. */
	protected static readonly OLE_OBJECT_RELATIONSHIP_TYPE = OLE_OBJECT_RELATIONSHIP_TYPE;
	protected static readonly OLE_IMAGE_RELATIONSHIP_TYPE = OLE_IMAGE_RELATIONSHIP_TYPE;

	/** See `save-shape-xml-ink.ts`'s `buildInkShapeXml`. */
	protected createInkShapeXml(el: InkPptxElement): XmlObject {
		return buildInkShapeXml(el, PptxHandlerRuntime.EMU_PER_PX);
	}

	/**
	 * Build a `p:grpSp` XML object from a {@link GroupPptxElement}.
	 *
	 * Children are stored with coordinates relative to the group origin and
	 * are routed to the `CT_GroupShape` child tag their markup actually
	 * requires (see {@link classifyGroupChildTag}). A group loaded from a
	 * file keeps its original `p:nvGrpSpPr` (so `p:timing`'s `p:spTgt/@spid`
	 * still resolves) and its original `p:grpSpPr` fill / effects / locks.
	 *
	 * @param ownEmuOverride - This group's own `a:off`/`a:ext` EMU, already
	 *   resolved by the ENCLOSING group's own {@link resolveGroupChildBoxEmu}
	 *   call (treating this group as one of its children). Only ever set for
	 *   a NESTED group being recursed into from below; `undefined` (the
	 *   default) is correct at depth 0. See `group-xfrm-preservation.ts`'s
	 *   module doc for why a nested group must not re-derive this itself.
	 */
	protected buildGroupShapeXml(
		group: GroupPptxElement,
		ctx?: GroupChildSaveContext,
		ownEmuOverride?: GroupOwnEmuOverride,
	): XmlObject | null {
		// If the group still has rawXml and children haven't changed, reuse it
		if (group.rawXml && group.children.length === 0) {
			return group.rawXml;
		}

		const EMU = PptxHandlerRuntime.EMU_PER_PX;
		const rawGroupXml = group.rawXml as XmlObject | undefined;
		// A direct child that moved/resized (or a nested child group whose own
		// subtree changed) triggers PowerPoint's own bounding-box auto-fit:
		// `rewrap` overrides this group's own `a:off`/`a:ext`/`a:chOff`/
		// `a:chExt` below; `undefined` otherwise, preserving them verbatim
		// exactly as before - see `group-tight-rewrap.ts`.
		const rewrap = resolveGroupTightRewrap(group, EMU);
		const xfrm = buildGroupTransformXml(group, EMU, ownEmuOverride, rewrap);
		// `group` itself already carries the `GroupChildSpaceOwner` shape its
		// DIRECT children are inverted against (its captured chOff/chExt plus
		// its OWN immutable widthEmu/heightEmu - see the module doc in
		// `group-xfrm-preservation.ts` for why that must stay immutable).
		const childSpace: GroupChildSpaceOwner = group;

		const grpXml: XmlObject = {
			'p:nvGrpSpPr': buildGroupNonVisualXml(rawGroupXml, group.name, group.id),
			'p:grpSpPr': buildGroupPropertiesXml(rawGroupXml, xfrm),
		};
		const rawExtLst = rawGroupXml?.['p:extLst'];
		if (rawExtLst !== undefined) {
			grpXml['p:extLst'] = rawExtLst;
		}

		// What an `<a:grpFill/>` child of THIS group inherits: the group's own
		// fill when it has one, otherwise whatever the group itself inherited.
		// Chaining here is what lets the fill writer tell "still following the
		// group" from "recoloured by the user" at any nesting depth.
		const childCtx: GroupChildSaveContext | undefined = ctx
			? {
					...ctx,
					inheritedGroupFill: groupChildInheritedFill(group, ctx.inheritedGroupFill),
					preserveGroupChildSpace: childSpace,
				}
			: undefined;

		const entries: GroupChildEntry[] = [];
		for (const child of group.children) {
			const entry = childCtx
				? this.serializeGroupChildViaElementWriter(child, childCtx)
				: this.serializeGroupChildFromRawXml(child, childSpace);
			if (entry) {
				entries.push(entry);
			}
		}

		appendGroupChildren(grpXml, entries);
		return grpXml;
	}

	/**
	 * Serialise one group child through the ordinary element writer, so a
	 * model-level edit to a shape inside a group (text, fill, stroke, geometry,
	 * effects, locks, alt text, image crop, re-embedded media) reaches the file
	 * exactly as it does for a top-level shape.
	 *
	 * Nested groups are recursed here rather than handed to the element writer,
	 * so the save context survives to every nesting depth.
	 */
	private serializeGroupChildViaElementWriter(
		child: GroupPptxElement['children'][number],
		ctx: GroupChildSaveContext,
	): GroupChildEntry | null {
		if (child.type === 'group') {
			// Resolve THIS nested group's own `a:off`/`a:ext` EMU, in the
			// ENCLOSING group's child space, BEFORE recursing: its own
			// `buildGroupShapeXml` call needs it to set its own transform.
			// `resolveGroupChildBoxEmu` (`group-tight-rewrap.ts`) resolves THIS
			// group's own re-wrapped box first when its own subtree changed,
			// instead of inverting its possibly-stale relative geometry.
			const ownEmuOverride = ctx.preserveGroupChildSpace
				? resolveGroupChildBoxEmu(child, ctx.preserveGroupChildSpace, PptxHandlerRuntime.EMU_PER_PX)
				: undefined;
			const xml = this.buildGroupShapeXml(child, ctx, ownEmuOverride);
			if (!xml) {
				return null;
			}
			// A nested group never reaches `processSlideElement` (this branch
			// recurses instead, so the save context survives), so it never got the
			// lock pass a top-level group gets there. `buildGroupNonVisualXml`
			// carries the ORIGINAL `a:grpSpLocks` over verbatim, which looks
			// correct until the model is edited: locking a group inside a group
			// was silently dropped on save.
			this.serializeShapeLocks(xml, child);
			return { tag: 'p:grpSp', xml };
		}
		const collectors: SlideShapeCollectors = createGroupChildCollectors();
		// `processSlideElement` is implemented further down the mixin chain
		// (`PptxHandlerRuntimeSaveElementWriter`), which is why it is reached
		// through a structural view rather than `this` directly.
		(this as unknown as GroupChildElementWriter).processSlideElement(child, collectors, ctx);
		return pickGroupChildFromCollectors(collectors);
	}

	/**
	 * Fallback used when no save context is available: pass the child's own
	 * markup through and patch only its transform. Preserves everything, but
	 * cannot pick up model-level edits.
	 */
	private serializeGroupChildFromRawXml(
		child: GroupPptxElement['children'][number],
		childSpace?: GroupChildSpaceOwner,
	): GroupChildEntry | null {
		// `childSpace` is the ENCLOSING group's resolved child space. Computed
		// ONCE via `resolveGroupChildBoxEmu` (`group-tight-rewrap.ts`, which
		// recurses into a nested group's own re-wrap first) and reused both as
		// `ownEmuOverride` below and as `applyGroupChildTransform`'s
		// `precomputed` value, so the two never disagree.
		const emu = childSpace
			? resolveGroupChildBoxEmu(child, childSpace, PptxHandlerRuntime.EMU_PER_PX)
			: undefined;
		const ownEmuOverride = child.type === 'group' ? emu : undefined;
		const xml = this.buildGroupChildXml(child, ownEmuOverride);
		if (!xml) {
			return null;
		}
		applyGroupChildTransform(xml, child, PptxHandlerRuntime.EMU_PER_PX, childSpace, emu);

		const tag = classifyGroupChildTag(child.type, xml);
		if (!tag) {
			// Emitting an unplaceable node under `p:sp` is what produced
			// schema-invalid packages; skipping one child is recoverable,
			// a repair prompt on the whole deck is not.
			this.compatibilityService.reportWarning({
				code: 'SAVE_GROUP_CHILD_SKIPPED',
				message: `Group child '${child.id}' (${child.type}) has no valid CT_GroupShape slot and was skipped during save.`,
				scope: 'save',
				elementId: child.id,
			});
			return null;
		}
		return { tag, xml };
	}

	/** Resolve (or fabricate) the XML node for a single group child. */
	private buildGroupChildXml(
		child: GroupPptxElement['children'][number],
		ownEmuOverride?: GroupOwnEmuOverride,
	): XmlObject | undefined {
		if (child.type === 'group') {
			return this.buildGroupShapeXml(child, undefined, ownEmuOverride) ?? undefined;
		}
		const xml = child.rawXml as XmlObject | undefined;
		if (xml) {
			return xml;
		}
		if (child.type === 'text' || child.type === 'shape') {
			return this.createElementXml(child);
		}
		if (child.type === 'connector') {
			return this.createConnectorXml(child);
		}
		if (child.type === 'ink') {
			return this.createInkShapeXml(child);
		}
		if (child.type === 'table') {
			return this.createTableGraphicFrameXml(child);
		}
		return undefined;
	}
}
