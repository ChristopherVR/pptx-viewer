import type { XmlObject } from '../../../types';
import { getCommentXmlNamespaces, withoutChildrenByLocalName } from './comment-xml-helpers';
import type { IPptxCommentAuthorsXmlFactory, PptxCommentAuthorsXmlFactoryInit } from './types';

export class PptxCommentAuthorsXmlFactory implements IPptxCommentAuthorsXmlFactory {
	public createXmlElement(init: PptxCommentAuthorsXmlFactoryInit): XmlObject {
		const namespaces = getCommentXmlNamespaces(init.conformance);
		const root = withoutChildrenByLocalName(
			init.saveState.getCommentAuthorsRootXml() ?? {},
			new Set(['cmAuthor']),
		);
		return {
			'p:cmAuthorLst': {
				...root,
				'@_xmlns:a': namespaces.drawing,
				'@_xmlns:r': namespaces.relationships,
				'@_xmlns:p': namespaces.presentation,
				'p:cmAuthor': init.saveState.getUsedCommentAuthors().map((author) => ({
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
