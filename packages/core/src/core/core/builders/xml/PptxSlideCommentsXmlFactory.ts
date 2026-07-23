import type { XmlObject } from '../../../types';
import { getCommentXmlNamespaces, withoutChildrenByLocalName } from './comment-xml-helpers';
import type { IPptxSlideCommentsXmlFactory, PptxSlideCommentsXmlFactoryInit } from './types';

export class PptxSlideCommentsXmlFactory implements IPptxSlideCommentsXmlFactory {
	public createXmlElement(init: PptxSlideCommentsXmlFactoryInit): XmlObject {
		const namespaces = getCommentXmlNamespaces(init.conformance);
		return {
			'p:cmLst': {
				'@_xmlns:a': namespaces.drawing,
				'@_xmlns:r': namespaces.relationships,
				'@_xmlns:p': namespaces.presentation,
				'p:cm': init.slideComments.map((comment, index) =>
					this.createCommentNode(init, comment, index),
				),
			},
		};
	}

	private createCommentNode(
		init: PptxSlideCommentsXmlFactoryInit,
		comment: PptxSlideCommentsXmlFactoryInit['slideComments'][number],
		fallbackIndex: number,
	): XmlObject {
		const authorId = init.saveState.resolveCommentAuthorId(comment.author);
		const commentIndex = init.saveState.resolveCommentIndex(authorId, comment.id, fallbackIndex);
		const createdAtIso = this.resolveCreatedAt(comment.createdAt);
		const x = init.saveState.toEmu(comment.x, 0);
		const y = init.saveState.toEmu(comment.y, 0);

		const node: XmlObject = {
			...withoutChildrenByLocalName(comment.rawXml ?? {}, new Set(['pos', 'text'])),
			'@_authorId': authorId,
			'@_dt': createdAtIso,
			'@_idx': String(commentIndex),
			'p:pos': {
				'@_x': String(x),
				'@_y': String(y),
			},
			'p:text': String(comment.text || ''),
		};
		this.applyResolvedState(node, comment);
		return node;
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
