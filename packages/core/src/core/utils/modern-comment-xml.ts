import type {
	PptxComment,
	PptxModernCommentAuthor,
	PptxModernCommentPart,
	XmlObject,
} from '../types';
import { MODERN_COMMENT_NAMESPACE } from './modern-comment-constants';

export * from './modern-comment-constants';

const localName = (key: string): string => key.split(':').pop() || key;

const child = (node: XmlObject | undefined, name: string): XmlObject | undefined => {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
};

const children = (node: XmlObject | undefined, name: string): XmlObject[] => {
	if (!node) {
		return [];
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	if (Array.isArray(value)) {
		return value as XmlObject[];
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
};

const textValues = (node: unknown): string[] => {
	if (!node || typeof node !== 'object') {
		return [];
	}
	const result: string[] = [];
	for (const [key, value] of Object.entries(node as XmlObject)) {
		if (localName(key) === 't' && (typeof value === 'string' || typeof value === 'number')) {
			result.push(String(value));
		} else if (!key.startsWith('@_')) {
			for (const entry of Array.isArray(value) ? value : [value]) {
				result.push(...textValues(entry));
			}
		}
	}
	return result;
};

export const extractModernCommentText = (node: XmlObject): string => {
	const body = child(node, 'txBody');
	if (!body) {
		return '';
	}
	const paragraphs = children(body, 'p');
	return (paragraphs.length > 0 ? paragraphs : [body])
		.map((paragraph) => textValues(paragraph).join(''))
		.join('\n');
};

const stringList = (value: unknown): string[] | undefined => {
	const items = String(value || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	return items.length > 0 ? items : undefined;
};

const optionalNumber = (value: unknown): number | undefined => {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const parseComment = (
	node: XmlObject,
	authorName: (id: string) => string | undefined,
	emuPerPx: number,
): PptxComment => {
	const id = String(node['@_id'] || '').trim();
	const authorId = String(node['@_authorId'] || '').trim();
	const status = String(node['@_status'] || 'active')
		.trim()
		.toLowerCase();
	const position = child(node, 'pos');
	const replies = children(child(node, 'replyLst'), 'reply').map((reply) =>
		parseComment(reply, authorName, emuPerPx),
	);
	return {
		id,
		text: extractModernCommentText(node),
		format: 'modern',
		authorId: authorId || undefined,
		author: authorName(authorId) || (authorId ? `Author ${authorId}` : undefined),
		createdAt: String(node['@_created'] || '').trim() || undefined,
		status: ['active', 'resolved', 'closed'].includes(status)
			? (status as PptxComment['status'])
			: undefined,
		resolved: status === 'resolved' || status === 'closed' ? true : undefined,
		x: position ? optionalNumber(position['@_x'])! / emuPerPx : undefined,
		y: position ? optionalNumber(position['@_y'])! / emuPerPx : undefined,
		tags: stringList(node['@_tags']),
		likes: stringList(node['@_likes']),
		startDate: String(node['@_startDate'] || '').trim() || undefined,
		dueDate: String(node['@_dueDate'] || '').trim() || undefined,
		assignedTo: stringList(node['@_assignedTo']),
		complete: optionalNumber(node['@_complete']),
		priority: optionalNumber(node['@_priority']),
		title: String(node['@_title'] || '').trim() || undefined,
		replies: replies.length > 0 ? replies : undefined,
		rawXml: node,
	};
};

export function parseModernCommentPart(
	data: XmlObject,
	part: Omit<PptxModernCommentPart, 'rawXml'>,
	authorName: (id: string) => string | undefined,
	emuPerPx: number,
): { comments: PptxComment[]; part: PptxModernCommentPart } {
	const root = child(data, 'cmLst');
	return {
		comments: children(root, 'cm').map((node) => parseComment(node, authorName, emuPerPx)),
		part: { ...part, rawXml: root },
	};
}

export function parseModernAuthors(data: XmlObject): {
	authors: PptxModernCommentAuthor[];
	root?: XmlObject;
} {
	const root = child(data, 'authorLst');
	return {
		root,
		authors: children(root, 'author').map((node) => ({
			id: String(node['@_id'] || '').trim(),
			name: String(node['@_name'] || '').trim(),
			initials: String(node['@_initials'] || '').trim() || undefined,
			userId: String(node['@_userId'] || '').trim(),
			providerId: String(node['@_providerId'] || '').trim(),
			rawXml: node,
		})),
	};
}

const copyAttributes = (raw: XmlObject | undefined): XmlObject => {
	const result: XmlObject = {};
	for (const [key, value] of Object.entries(raw || {})) {
		if (key.startsWith('@_')) {
			result[key] = value;
		}
	}
	return result;
};

const rawChildrenExcept = (raw: XmlObject | undefined, excluded: Set<string>): XmlObject => {
	const result: XmlObject = {};
	for (const [key, value] of Object.entries(raw || {})) {
		if (!key.startsWith('@_') && !excluded.has(localName(key))) {
			result[key] = value;
		}
	}
	return result;
};

const isoDate = (value: string | undefined): string => {
	const parsed = Date.parse(String(value || ''));
	return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
};

const textBody = (text: string): XmlObject => ({
	'a:bodyPr': {},
	'a:lstStyle': {},
	'a:p': String(text)
		.split('\n')
		.map((line) => ({ 'a:r': { 'a:rPr': {}, 'a:t': line } })),
});

const buildComment = (
	comment: PptxComment,
	resolveAuthorId: (comment: PptxComment) => string,
	emuPerPx: number,
	isReply = false,
): XmlObject => {
	const raw = comment.rawXml;
	const status = comment.status || (comment.resolved ? 'resolved' : 'active');
	const node: XmlObject = {
		...copyAttributes(raw),
		'@_id': comment.id,
		'@_authorId': resolveAuthorId(comment),
		'@_status': status,
		'@_created': isoDate(comment.createdAt),
	};
	for (const [attribute, value] of [
		['tags', comment.tags?.join(' ')],
		['likes', comment.likes?.join(' ')],
		['startDate', comment.startDate],
		['dueDate', comment.dueDate],
		['assignedTo', comment.assignedTo?.join(' ')],
		['complete', comment.complete],
		['priority', comment.priority],
		['title', comment.title],
	] as const) {
		if (value === undefined) {
			delete node[`@_${attribute}`];
		} else {
			node[`@_${attribute}`] = String(value);
		}
	}
	const excluded = new Set(['pos', 'replyLst', 'txBody', 'extLst']);
	Object.assign(node, rawChildrenExcept(raw, excluded));
	const hasAnchor = Object.keys(node).some((key) =>
		[
			'sldMkLst',
			'sldLayoutMkLst',
			'sldMasterMkLst',
			'deMkLst',
			'txBodyMkLst',
			'txMkLst',
			'tcMkLst',
			'trMkLst',
			'gridColMkLst',
			'unknownAnchor',
		].includes(localName(key)),
	);
	if (!isReply && !hasAnchor) {
		node['p188:unknownAnchor'] = {};
	}
	if (!isReply && (comment.x !== undefined || comment.y !== undefined)) {
		node['p188:pos'] = {
			'@_x': String(Math.round((comment.x || 0) * emuPerPx)),
			'@_y': String(Math.round((comment.y || 0) * emuPerPx)),
		};
	}
	if (!isReply && comment.replies?.length) {
		node['p188:replyLst'] = {
			'p188:reply': comment.replies.map((reply) =>
				buildComment(reply, resolveAuthorId, emuPerPx, true),
			),
		};
	}
	const originalBody = child(raw, 'txBody');
	node['p188:txBody'] =
		originalBody && extractModernCommentText(raw!) === comment.text
			? originalBody
			: textBody(comment.text);
	const extension = child(raw, 'extLst');
	if (extension) {
		node['p188:extLst'] = extension;
	}
	return node;
};

export function buildModernCommentPart(
	comments: PptxComment[],
	rawRoot: XmlObject | undefined,
	resolveAuthorId: (comment: PptxComment) => string,
	emuPerPx: number,
): XmlObject {
	return {
		'p188:cmLst': {
			...copyAttributes(rawRoot),
			...rawChildrenExcept(rawRoot, new Set(['cm'])),
			'@_xmlns:p188': MODERN_COMMENT_NAMESPACE,
			'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
			'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			'p188:cm': comments.map((comment) => buildComment(comment, resolveAuthorId, emuPerPx)),
		},
	};
}

export function buildModernAuthorPart(
	authors: PptxModernCommentAuthor[],
	rawRoot?: XmlObject,
): XmlObject {
	return {
		'p188:authorLst': {
			...copyAttributes(rawRoot),
			...rawChildrenExcept(rawRoot, new Set(['author'])),
			'@_xmlns:p188': MODERN_COMMENT_NAMESPACE,
			'p188:author': authors.map((author) => ({
				...author.rawXml,
				'@_id': author.id,
				'@_name': author.name,
				'@_initials': author.initials,
				'@_userId': author.userId,
				'@_providerId': author.providerId,
			})),
		},
	};
}
