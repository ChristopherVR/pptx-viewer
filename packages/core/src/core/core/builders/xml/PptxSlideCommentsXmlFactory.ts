import type { PptxComment, XmlObject } from '../../../types';
import {
	buildLegacyThreadingExtLst,
	flattenLegacyCommentThread,
	legacyCommentExtLst,
	parseLegacyThreadingParent,
} from '../../../utils/legacy-comment-threading';
import { getCommentXmlNamespaces, withoutChildrenByLocalName } from './comment-xml-helpers';
import type { IPptxSlideCommentsXmlFactory, PptxSlideCommentsXmlFactoryInit } from './types';

/** A legacy comment's own resolved `@authorId`/`@idx`, keyed by `comment.id`. */
type LegacyCommentKeys = Map<string, { authorId: string; idx: string }>;

export class PptxSlideCommentsXmlFactory implements IPptxSlideCommentsXmlFactory {
	public createXmlElement(init: PptxSlideCommentsXmlFactoryInit): XmlObject {
		const namespaces = getCommentXmlNamespaces(init.conformance);
		// A comment carrying replies (added since this deck's legacy comments
		// were last threaded, or read back from `p15:threadingInfo` unchanged)
		// is flattened depth-first: one `p:cm` per comment, in root-then-replies
		// order.
		const flatComments = flattenLegacyCommentThread(init.slideComments);
		const ownKeys: LegacyCommentKeys = new Map();
		flatComments.forEach((comment, index) => {
			const authorId = init.saveState.resolveCommentAuthorId(comment.author);
			const idx = init.saveState.resolveCommentIndex(authorId, comment.id, index);
			ownKeys.set(comment.id, { authorId, idx: String(idx) });
		});
		return {
			'p:cmLst': {
				'@_xmlns:a': namespaces.drawing,
				'@_xmlns:r': namespaces.relationships,
				'@_xmlns:p': namespaces.presentation,
				'p:cm': flatComments.map((comment) => this.createCommentNode(init, comment, ownKeys)),
			},
		};
	}

	private createCommentNode(
		init: PptxSlideCommentsXmlFactoryInit,
		comment: PptxComment,
		ownKeys: LegacyCommentKeys,
	): XmlObject {
		const own = ownKeys.get(comment.id);
		const authorId = own?.authorId ?? init.saveState.resolveCommentAuthorId(comment.author);
		const commentIndex =
			own?.idx ?? String(init.saveState.resolveCommentIndex(authorId, comment.id, 0));
		const createdAtIso = this.resolveCreatedAt(comment.createdAt);
		const x = init.saveState.toEmu(comment.x, 0);
		const y = init.saveState.toEmu(comment.y, 0);

		const node: XmlObject = {
			...withoutChildrenByLocalName(comment.rawXml ?? {}, new Set(['pos', 'text', 'extLst'])),
			'@_authorId': authorId,
			'@_dt': createdAtIso,
			'@_idx': commentIndex,
			'p:pos': {
				'@_x': String(x),
				'@_y': String(y),
			},
			'p:text': String(comment.text || ''),
		};
		this.applyResolvedState(node, comment);
		this.applyThreadingExtension(node, comment, ownKeys);
		return node;
	}

	/**
	 * Rebuild the `p15:threadingInfo` extension (see
	 * `utils/legacy-comment-threading`) from `comment.parentId`, resolved
	 * against the parent's OWN `@authorId`/`@idx` pair rather than the
	 * parent's model id (which `p15:parentCm` has no way to carry). Every
	 * other extension the comment's `rawXml` carried is preserved unchanged.
	 */
	private applyThreadingExtension(
		node: XmlObject,
		comment: PptxComment,
		ownKeys: LegacyCommentKeys,
	): void {
		const parentKeys = comment.parentId ? ownKeys.get(comment.parentId) : undefined;
		// Preserve the reply's own original `timeZoneBias`, if it already had
		// one, rather than always re-defaulting to "0".
		const originalBias = parseLegacyThreadingParent(comment.rawXml)?.timeZoneBias;
		const extLst = buildLegacyThreadingExtLst(
			legacyCommentExtLst(comment.rawXml),
			parentKeys
				? { authorId: parentKeys.authorId, idx: parentKeys.idx, timeZoneBias: originalBias }
				: undefined,
		);
		if (extLst) {
			node['p:extLst'] = extLst;
		} else {
			delete node['p:extLst'];
		}
	}

	/**
	 * Reflect the (possibly edited) `resolved` flag onto the legacy comment
	 * node. PowerPoint's legacy comment schema has no standard resolved marker,
	 * but the parser reads a non-standard `@_done` / `@_resolved` attribute, so
	 * we re-emit the current state rather than leaving the stale value carried
	 * over from `rawXml`. The original attribute name is preserved when present.
	 */
	private applyResolvedState(
		node: XmlObject,
		comment: PptxSlideCommentsXmlFactoryInit['slideComments'][number],
	): void {
		const raw = comment.rawXml as XmlObject | undefined;
		const hadResolvedAttr = raw?.['@_resolved'] !== undefined;
		const hadDoneAttr = raw?.['@_done'] !== undefined;
		const key = hadResolvedAttr && !hadDoneAttr ? '@_resolved' : '@_done';
		delete node['@_done'];
		delete node['@_resolved'];
		if (comment.resolved === true) {
			node[key] = '1';
		} else if (hadResolvedAttr || hadDoneAttr) {
			// The source marked this comment resolved; an edit cleared it, so
			// emit an explicit unresolved marker instead of silently dropping it.
			node[key] = '0';
		}
	}

	private resolveCreatedAt(createdAt: string | undefined): string {
		const candidate = String(createdAt || '').trim();
		if (candidate.length === 0 || Number.isNaN(Date.parse(candidate))) {
			return new Date().toISOString();
		}
		return new Date(candidate).toISOString();
	}
}
