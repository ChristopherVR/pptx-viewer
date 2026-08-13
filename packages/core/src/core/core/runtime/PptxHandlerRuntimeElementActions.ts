import { XmlObject, PptxElement } from '../../types';
import type { PptxAction, PptxShapeLocks } from '../../types';
import { xmlPath } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeTableStyles';
import { buildShapeLockNode, SHAPE_LOCK_CONTAINERS } from './shape-lock-containers';

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

	protected getCnvPrNode(shape: XmlObject, key: string): XmlObject | undefined {
		if (key === 'p:pic') {
			return xmlPath(shape, 'p:nvPicPr', 'p:cNvPr');
		}
		if (key === 'p:cxnSp') {
			return xmlPath(shape, 'p:nvCxnSpPr', 'p:cNvPr');
		}
		if (key === 'p:graphicFrame') {
			return xmlPath(shape, 'p:nvGraphicFramePr', 'p:cNvPr');
		}
		if (key === 'p:grpSp') {
			return xmlPath(shape, 'p:nvGrpSpPr', 'p:cNvPr');
		}
		return xmlPath(shape, 'p:nvSpPr', 'p:cNvPr');
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
	 * (connectors) or `a:grpSpLocks` (groups) onto that family's own
	 * `p:cNvXxxPr` container, restricted to the attributes that container's
	 * type declares. See {@link module:shape-lock-containers} for why the four
	 * are not interchangeable, and for the one family
	 * (`a:graphicFrameLocks`) deliberately left out.
	 */
	protected serializeShapeLocks(shape: XmlObject, el: PptxElement): void {
		const spec = SHAPE_LOCK_CONTAINERS[this.getTreeBucketKeyForElementType(el.type)];
		if (!spec) {
			return;
		}
		const container = xmlPath(shape, spec.nvKey, spec.cNvKey);
		if (!container) {
			return;
		}

		const locks: PptxShapeLocks | undefined =
			'locks' in el ? (el.locks as PptxShapeLocks | undefined) : undefined;
		const next = buildShapeLockNode(locks, spec, container[spec.lockTag] as XmlObject | undefined);
		if (next) {
			container[spec.lockTag] = next;
		} else {
			delete container[spec.lockTag];
		}
	}
}
