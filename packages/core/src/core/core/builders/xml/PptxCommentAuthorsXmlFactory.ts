import type { XmlObject } from '../../../types';
import { getCommentXmlNamespaces, withoutChildrenByLocalName } from './comment-xml-helpers';
import type { IPptxCommentAuthorsXmlFactory, PptxCommentAuthorsXmlFactoryInit } from './types';

export class PptxCommentAuthorsXmlFactory implements IPptxCommentAuthorsXmlFactory {
	public createXmlElement(init: PptxCommentAuthorsXmlFactoryInit): XmlObject {
		const namespaces = getCommentXmlNamespaces(init.conformance);
		const originalRoot = init.saveState.getCommentAuthorsRootXml();
		const usedAuthors = init.saveState.getUsedCommentAuthors();
		// No comment currently references any author, but the deck HAD an
		// authors part: nothing about the registry changed, so pass it through
		// verbatim instead of rebuilding it from the (empty) used-authors list,
		// which erased every author's name/initials/colour the moment its last
		// comment was deleted or a slide with no comments was saved.
		if (usedAuthors.length === 0 && originalRoot !== undefined) {
			return {
				'p:cmAuthorLst': {
					...withoutChildrenByLocalName(originalRoot, new Set()),
					'@_xmlns:a': namespaces.drawing,
					'@_xmlns:r': namespaces.relationships,
					'@_xmlns:p': namespaces.presentation,
				},
			};
		}
		const root = withoutChildrenByLocalName(originalRoot ?? {}, new Set(['cmAuthor']));
		return {
			'p:cmAuthorLst': {
				...root,
				'@_xmlns:a': namespaces.drawing,
				'@_xmlns:r': namespaces.relationships,
				'@_xmlns:p': namespaces.presentation,
				'p:cmAuthor': usedAuthors.map((author) => ({
					...withoutChildrenByLocalName(author.rawXml ?? {}, new Set()),
					'@_id': author.authorId,
					'@_name': author.authorName,
					'@_initials': author.initials,
					'@_lastIdx': String(author.lastCommentIndex),
					'@_clrIdx': String(author.colorIndex),
				})),
			},
		};
	}
}
