import type { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import type { IPptxSlideRelationshipRegistry } from '../core/builders';
import type { PptxComment, PptxModernCommentAuthor, PptxSlide, XmlObject } from '../types';
import {
	buildModernAuthorPart,
	buildModernCommentPart,
	MODERN_AUTHOR_CONTENT_TYPE,
	MODERN_AUTHOR_RELATIONSHIP,
	MODERN_COMMENT_CONTENT_TYPE,
	MODERN_COMMENT_RELATIONSHIP,
} from './modern-comment-xml';

const RELATIONSHIPS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const ensureArray = <T>(value: T | T[] | undefined): T[] =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

const resolvePartPath = (source: string, target: string): string => {
	const segments = source.split('/');
	segments.pop();
	for (const segment of target.replace(/\\/g, '/').split('/')) {
		if (!segment || segment === '.') {
			continue;
		}
		if (segment === '..') {
			segments.pop();
		} else {
			segments.push(segment);
		}
	}
	return segments.join('/');
};

const relationshipTarget = (slidePath: string, partPath: string): string => {
	const source = slidePath.split('/');
	source.pop();
	const target = partPath.split('/');
	while (source.length > 0 && target.length > 0 && source[0] === target[0]) {
		source.shift();
		target.shift();
	}
	return `${'../'.repeat(source.length)}${target.join('/')}`;
};

const modernComments = (slide: PptxSlide): PptxComment[] =>
	(slide.comments || []).filter((comment) => comment.format === 'modern');

export interface SaveModernSlideCommentsInput {
	slide: PptxSlide;
	zip: JSZip;
	xmlBuilder: XMLBuilder;
	relationships: IPptxSlideRelationshipRegistry;
	resolveAuthorId: (comment: PptxComment) => string;
	emuPerPx: number;
	nextPartPath: () => string;
}

export function saveModernSlideComments(init: SaveModernSlideCommentsInput): void {
	const previous = init.relationships.removeRelationshipsByType(MODERN_COMMENT_RELATIONSHIP);
	const priorPath =
		init.slide.modernCommentPart?.path ||
		(previous.target ? resolvePartPath(init.slide.id, previous.target) : undefined);
	const comments = modernComments(init.slide);
	if (comments.length === 0) {
		if (priorPath) {
			init.zip.remove(priorPath);
		}
		init.slide.modernCommentPart = undefined;
		return;
	}
	const path = priorPath || init.nextPartPath();
	const relationshipId = previous.relationshipId || init.relationships.nextRelationshipId();
	init.zip.file(
		path,
		init.xmlBuilder.build(
			buildModernCommentPart(
				comments,
				init.slide.modernCommentPart?.rawXml,
				init.resolveAuthorId,
				init.emuPerPx,
			),
		),
	);
	init.relationships.upsertRelationship(
		relationshipId,
		MODERN_COMMENT_RELATIONSHIP,
		relationshipTarget(init.slide.id, path),
	);
	init.slide.modernCommentPart = {
		path,
		relationshipId,
		rawXml: init.slide.modernCommentPart?.rawXml,
	};
}

const nextRelationshipId = (relationships: XmlObject[]): string => {
	const used = new Set(relationships.map((entry) => String(entry['@_Id'] || '')));
	let index = 1;
	while (used.has(`rId${index}`)) {
		index += 1;
	}
	return `rId${index}`;
};

const updateOverride = (
	overrides: XmlObject[],
	contentType: string,
	activePaths: string[],
): XmlObject[] => {
	const active = new Set(activePaths.map((path) => `/${path.replace(/^\//, '')}`));
	const retained = overrides.filter(
		(entry) =>
			String(entry['@_ContentType'] || '') !== contentType ||
			active.has(String(entry['@_PartName'] || '')),
	);
	for (const path of active) {
		if (!retained.some((entry) => entry['@_PartName'] === path)) {
			retained.push({ '@_PartName': path, '@_ContentType': contentType });
		}
	}
	return retained;
};

export interface PersistModernCommentPackageInput {
	slides: PptxSlide[];
	zip: JSZip;
	parser: XMLParser;
	xmlBuilder: XMLBuilder;
	authors: PptxModernCommentAuthor[];
	authorRoot?: XmlObject;
	authorPartPath?: string;
	authorRelationshipId?: string;
}

export async function persistModernCommentPackage(
	init: PersistModernCommentPackageInput,
): Promise<{ authorPartPath?: string; authorRelationshipId?: string }> {
	const activeCommentPaths = init.slides
		.filter((slide) => modernComments(slide).length > 0)
		.map((slide) => slide.modernCommentPart?.path)
		.filter((path): path is string => Boolean(path));
	const hasComments = activeCommentPaths.length > 0;
	const authorPath = init.authorPartPath || 'ppt/authors/author1.xml';
	const relsPath = 'ppt/_rels/presentation.xml.rels';
	const relsXml = await init.zip.file(relsPath)?.async('string');
	const relsData = relsXml
		? (init.parser.parse(relsXml) as XmlObject)
		: { Relationships: { '@_xmlns': RELATIONSHIPS_NS, Relationship: [] } };
	const relsRoot = (relsData['Relationships'] || {}) as XmlObject;
	const relationships = ensureArray(
		relsRoot['Relationship'] as XmlObject | XmlObject[] | undefined,
	);
	const existing = relationships.find(
		(entry) => String(entry['@_Type'] || '') === MODERN_AUTHOR_RELATIONSHIP,
	);
	const retained = relationships.filter(
		(entry) => String(entry['@_Type'] || '') !== MODERN_AUTHOR_RELATIONSHIP,
	);
	let relationshipId: string | undefined;
	if (hasComments) {
		init.zip.file(
			authorPath,
			init.xmlBuilder.build(buildModernAuthorPart(init.authors, init.authorRoot)),
		);
		relationshipId =
			init.authorRelationshipId || String(existing?.['@_Id'] || '') || nextRelationshipId(retained);
		retained.push({
			...(existing || {}),
			'@_Id': relationshipId,
			'@_Type': MODERN_AUTHOR_RELATIONSHIP,
			'@_Target': authorPath.replace(/^ppt\//, ''),
		});
	} else {
		init.zip.remove(authorPath);
	}
	relsRoot['@_xmlns'] ||= RELATIONSHIPS_NS;
	relsRoot['Relationship'] = retained;
	relsData['Relationships'] = relsRoot;
	init.zip.file(relsPath, init.xmlBuilder.build(relsData));

	const contentTypesXml = await init.zip.file('[Content_Types].xml')?.async('string');
	if (contentTypesXml) {
		const data = init.parser.parse(contentTypesXml) as XmlObject;
		const root = (data['Types'] || {}) as XmlObject;
		let overrides = ensureArray(root['Override'] as XmlObject | XmlObject[] | undefined);
		overrides = updateOverride(overrides, MODERN_COMMENT_CONTENT_TYPE, activeCommentPaths);
		overrides = updateOverride(
			overrides,
			MODERN_AUTHOR_CONTENT_TYPE,
			hasComments ? [authorPath] : [],
		);
		root['Override'] = overrides;
		data['Types'] = root;
		init.zip.file('[Content_Types].xml', init.xmlBuilder.build(data));
	}
	return hasComments ? { authorPartPath: authorPath, authorRelationshipId: relationshipId } : {};
}
