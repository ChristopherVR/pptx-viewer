import { XmlObject, PptxElement } from '../../types';
import type { PptxAction, PptxShapeLocks } from '../../types';
import { xmlPath } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeTableStyles';
import {
	buildShapeLockNode,
	resolveLockContainerNode,
	resolveShapeLockContainer,
} from './shape-lock-containers';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Write or remove a single `a:hlinkClick` / `a:hlinkHover` node on
	 * a `p:cNvPr` parent.
	 */
	protected serializeSingleAction(
		cNvPr: XmlObject,
		nodeName: string,
		action: PptxAction | undefined,
		resolveHyperlinkRelationshipId: (target: string) => string | undefined,
	): void {
		if (!action) {
			delete cNvPr[nodeName];
			return;
		}
		const node: XmlObject = {};
		let rId = action.rId;
		if (!rId && action.url) {
			rId = resolveHyperlinkRelationshipId(action.url) ?? undefined;
		}
		if (rId) {
			node['@_r:id'] = rId;
		}
		if (action.action) {
			node['@_action'] = action.action;
		}
		if (action.tooltip) {
			node['@_tooltip'] = action.tooltip;
		}
		if (action.highlightClick) {
			node['@_highlightClick'] = '1';
		}
		const soundRId = action.soundRId;
		if (soundRId) {
			node['a:snd'] = {
				'@_r:embed': soundRId,
			};
		}
		cNvPr[nodeName] = node;
	}

	/**
	 * The `p:spTree` child tag an element of this type is written under.
	 *
	 * `CT_GroupShape` gives a group its own `<p:grpSp>` slot, so a group is NOT
	 * a `<p:sp>`. Reporting one made every consumer of this key wrong for
	 * groups at once: the template writer looked for an inherited group in the
	 * `p:sp` bucket, never matched, and appended the whole `<p:grpSp>` there as
	 * a sibling shape, and the lock/action writers looked for a `p:nvSpPr` a
	 * group does not have.
	 */
	protected getTreeBucketKeyForElementType(type: PptxElement['type']): string {
		if (type === 'picture' || type === 'image') {
			return 'p:pic';
		}
		if (type === 'connector') {
			return 'p:cxnSp';
		}
		if (type === 'group') {
			return 'p:grpSp';
		}
		if (
			type === 'table' ||
			type === 'chart' ||
			type === 'smartArt' ||
			type === 'ole' ||
			type === 'media'
		) {
			return 'p:graphicFrame';
		}
		return 'p:sp';
	}

	/**
	 * The `p:cNvPr` an element's hyperlinks hang on.
	 *
	 * Resolved from the MARKUP, not from `el.type`, for exactly the reason
	 * {@link resolveShapeLockContainer} documents: the two disagree in real
	 * files. `media` buckets as `p:graphicFrame`, but PowerPoint writes a video
	 * as a `p:pic`, so looking for `p:nvGraphicFramePr` found nothing and the
	 * writer returned early - a hyperlink or an action on a video or an audio
	 * clip was accepted by the editor and then never reached the saved file.
	 * Loaded ink is the mirror image: it buckets as `p:sp` and arrives as a
	 * graphic frame or a `p:contentPart`. This is the unfixed sibling of the
	 * lock-container bug, and it shares the fix rather than restating it.
	 */
	protected getCnvPrNode(shape: XmlObject, key: string): XmlObject | undefined {
		// `p:contentPart` (ink) carries no lock container, so it is not in
		// SHAPE_LOCK_CONTAINERS and has to be recognised here.
		const contentPart = xmlPath(shape, 'p:nvContentPartPr', 'p:cNvPr');
		if (contentPart) {
			return contentPart;
		}
		const spec = resolveShapeLockContainer(shape, key);
		return xmlPath(shape, spec?.nvKey ?? 'p:nvSpPr', 'p:cNvPr');
	}

	/**
	 * Serialize shape-level actions back onto the `p:cNvPr` node, updating
	 * the `a:hlinkClick` and `a:hlinkHover` nodes on the element's
	 * non-visual properties.
	 */
	protected serializeElementActions(
		shape: XmlObject,
		el: PptxElement,
		resolveHyperlinkRelationshipId: (target: string) => string | undefined,
	): void {
		const key = this.getTreeBucketKeyForElementType(el.type);
		const cNvPr = this.getCnvPrNode(shape, key);
		if (!cNvPr) {
			return;
		}

		const actionClick =
			'actionClick' in el ? (el.actionClick as PptxAction | undefined) : undefined;
		const actionHover =
			'actionHover' in el ? (el.actionHover as PptxAction | undefined) : undefined;

		this.serializeSingleAction(cNvPr, 'a:hlinkClick', actionClick, resolveHyperlinkRelationshipId);
		this.serializeSingleAction(cNvPr, 'a:hlinkHover', actionHover, resolveHyperlinkRelationshipId);
	}

	/**
	 * Serialize shape lock attributes from an element back into the XML.
	 *
	 * Writes `a:spLocks` (shapes), `a:picLocks` (pictures), `a:cxnSpLocks`
	 * (connectors), `a:grpSpLocks` (groups) or `a:graphicFrameLocks` (tables,
	 * charts, SmartArt, OLE objects, media) onto that family's own `p:cNvXxxPr`
	 * container, restricted to the attributes that container's type declares.
	 * See {@link module:shape-lock-containers} for why the five are not
	 * interchangeable.
	 *
	 * The container is resolved from the MARKUP, not from `el.type`: PowerPoint
	 * writes media as a `p:pic` even though the type buckets as
	 * `p:graphicFrame`, and loaded ink as a graphic frame even though it buckets
	 * as `p:sp`. Trusting the type there would rebuild the wrong lock element
	 * and delete the authored one.
	 */
	protected serializeShapeLocks(shape: XmlObject, el: PptxElement): void {
		const spec = resolveShapeLockContainer(shape, this.getTreeBucketKeyForElementType(el.type));
		if (!spec) {
			return;
		}
		const locks: PptxShapeLocks | undefined =
			'locks' in el ? (el.locks as PptxShapeLocks | undefined) : undefined;

		// Read without creating: an element with no locks must not grow an empty
		// `p:cNvSpPr`. The container is only materialised once there is something
		// to write into it.
		const existing = resolveLockContainerNode(shape, spec, false);
		const next = buildShapeLockNode(locks, spec, existing?.[spec.lockTag] as XmlObject | undefined);
		if (!next) {
			if (existing) {
				delete existing[spec.lockTag];
			}
			return;
		}
		const container = existing ?? resolveLockContainerNode(shape, spec, true);
		if (container) {
			container[spec.lockTag] = next;
		}
	}
}
