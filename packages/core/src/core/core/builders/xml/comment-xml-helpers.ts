import type { XmlObject } from '../../../types';
import type { OoxmlConformanceClass } from '../../../utils';

export interface CommentXmlNamespaces {
	presentation: string;
	drawing: string;
	relationships: string;
}

export function getCommentXmlNamespaces(conformance: OoxmlConformanceClass): CommentXmlNamespaces {
	if (conformance === 'strict') {
		return {
			presentation: 'http://purl.oclc.org/ooxml/presentationml/main',
			drawing: 'http://purl.oclc.org/ooxml/drawingml/main',
			relationships: 'http://purl.oclc.org/ooxml/officeDocument/relationships',
		};
	}
	return {
		presentation: 'http://schemas.openxmlformats.org/presentationml/2006/main',
		drawing: 'http://schemas.openxmlformats.org/drawingml/2006/main',
		relationships: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
	};
}

export function withoutChildrenByLocalName(source: XmlObject, names: Set<string>): XmlObject {
	const result: XmlObject = { ...source };
	for (const key of Object.keys(result)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const localName = key.includes(':') ? key.slice(key.lastIndexOf(':') + 1) : key;
		if (names.has(localName)) {
			delete result[key];
		}
	}
	return result;
}
