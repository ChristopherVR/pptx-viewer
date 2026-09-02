/**
 * Legacy (PresentationML) comment reply threading via the Office 2013 `p15`
 * extension.
 *
 * The legacy `p:cmLst` / `CT_CommentList` vocabulary has no native reply
 * concept: `CT_Comment` is `pos` + `text` plus attributes. Before the Office
 * 2021 threaded-comment part (`p188:cmLst`) existed, PowerPoint recorded a
 * reply's parent via an extension on the comment itself:
 *
 * ```xml
 * <p:cm authorId="1" dt="...">
 *   <p:pos x="..." y="..."/>
 *   <p:text>Done.</p:text>
 *   <p:extLst>
 *     <p:ext uri="{C676402C-5697-4E1C-873F-D02D1690AC5C}">
 *       <p15:threadingInfo xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main" timeZoneBias="0">
 *         <p15:parentCm authorId="0" idx="0"/>
 *       </p15:threadingInfo>
 *     </p:ext>
 *   </p:extLst>
 * </p:cm>
 * ```
 *
 * `p15:parentCm` identifies the parent `p:cm` by the PAIR (`@authorId`,
 * `@idx`) rather than by a stable id, because legacy comments have none.
 * This module resolves that pair against the flat comment list on parse (to
 * build `PptxComment.parentId` / `.threadId` and the same nested `.replies`
 * shape the modern p188 reader produces) and rebuilds it on save from
 * whatever `parentId` the model currently carries.
 *
 * @module utils/legacy-comment-threading
 */
import type { PptxComment, XmlObject } from '../types';

/** `p:ext/@uri` for the Office 2013 comment-threading extension. */
export const LEGACY_THREADING_EXT_URI = '{C676402C-5697-4E1C-873F-D02D1690AC5C}';

const P15_NAMESPACE_URI = 'http://schemas.microsoft.com/office/powerpoint/2012/main';

/** A legacy `p15:parentCm` reference: which `p:cm` this comment replies to. */
export interface LegacyThreadingParentRef {
	authorId: string;
	idx: string;
	/** `p15:threadingInfo/@timeZoneBias`, preserved verbatim when present. */
	timeZoneBias?: string;
}

const localName = (key: string): string =>
	key.includes(':') ? key.slice(key.lastIndexOf(':') + 1) : key;

/** The first child of `node` whose (namespace-stripped) tag is `name`. */
function findChild(node: XmlObject | undefined, name: string): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

/** Every child of `node` whose (namespace-stripped) tag is `name`. */
function findChildren(node: XmlObject | undefined, name: string): XmlObject[] {
	if (!node) {
		return [];
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	if (Array.isArray(value)) {
		return value as XmlObject[];
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

/** A legacy `p:cm` node's `p:extLst` child, found by local name. */
export function legacyCommentExtLst(commentNode: XmlObject | undefined): XmlObject | undefined {
	return findChild(commentNode, 'extLst');
}

/**
 * Read `p15:threadingInfo/p15:parentCm` off a legacy `p:cm` node's
 * `p:extLst`, if present.
 */
export function parseLegacyThreadingParent(
	commentNode: XmlObject | undefined,
): LegacyThreadingParentRef | undefined {
	const extLst = legacyCommentExtLst(commentNode);
	for (const ext of findChildren(extLst, 'ext')) {
		if (String(ext['@_uri'] || '').trim() !== LEGACY_THREADING_EXT_URI) {
			continue;
		}
		const threadingInfo = findChild(ext, 'threadingInfo');
		const parentCm = findChild(threadingInfo, 'parentCm');
		if (!parentCm) {
			continue;
		}
		const authorId = String(parentCm['@_authorId'] || '').trim();
		const idx = String(parentCm['@_idx'] || '').trim();
		if (authorId.length === 0 || idx.length === 0) {
			continue;
		}
		const timeZoneBias = String(threadingInfo?.['@_timeZoneBias'] ?? '').trim();
		return { authorId, idx, ...(timeZoneBias.length > 0 ? { timeZoneBias } : {}) };
	}
	return undefined;
}

/**
 * Nest a flat legacy comment list into the same `{ replies: [...] }` shape
 * the modern p188 reader produces, using each comment's own `p15:parentCm`
 * reference (matched against every OTHER comment's own `@authorId`/`@idx`
 * pair, read off its preserved `rawXml`).
 *
 * Comments without a resolvable parent (no extension, or a dangling
 * reference to nothing in this list) are returned unchanged, at the top
 * level, exactly like today. `parentId` and `threadId` are populated on
 * every comment that IS part of a thread; `threadId` is the root
 * ancestor's id, shared by every member.
 */
export function nestLegacyCommentReplies(comments: PptxComment[]): PptxComment[] {
	const byOwnKey = new Map<string, PptxComment>();
	for (const comment of comments) {
		const raw = comment.rawXml;
		const authorId = String(raw?.['@_authorId'] || '').trim();
		const idx = String(raw?.['@_idx'] || raw?.['@_id'] || '').trim();
		if (authorId.length > 0 && idx.length > 0) {
			byOwnKey.set(`${authorId}:${idx}`, comment);
		}
	}

	const parentOf = new Map<string, PptxComment>();
	const childrenOf = new Map<string, PptxComment[]>();
	for (const comment of comments) {
		const ref = parseLegacyThreadingParent(comment.rawXml);
		if (!ref) {
			continue;
		}
		const parent = byOwnKey.get(`${ref.authorId}:${ref.idx}`);
		if (!parent || parent === comment) {
			// No such comment in this list, or a (malformed) self-reference:
			// leave this comment flat rather than dropping or mis-nesting it.
			continue;
		}
		comment.parentId = parent.id;
		parentOf.set(comment.id, parent);
		const siblings = childrenOf.get(parent.id) ?? [];
		siblings.push(comment);
		childrenOf.set(parent.id, siblings);
	}

	if (childrenOf.size === 0) {
		return comments;
	}

	const rootOf = (comment: PptxComment): PptxComment => {
		let current = comment;
		const seen = new Set<string>([comment.id]);
		for (;;) {
			const parent = parentOf.get(current.id);
			if (!parent || seen.has(parent.id)) {
				return current;
			}
			seen.add(parent.id);
			current = parent;
		}
	};
	for (const comment of comments) {
		if (parentOf.has(comment.id) || childrenOf.has(comment.id)) {
			comment.threadId = rootOf(comment).id;
		}
	}

	const nested = new Set<string>();
	const nest = (comment: PptxComment): PptxComment => {
		if (nested.has(comment.id)) {
			// Defends against a malformed (cyclic) parent chain; real decks never
			// produce one.
			return comment;
		}
		nested.add(comment.id);
		const kids = childrenOf.get(comment.id);
		if (kids && kids.length > 0) {
			comment.replies = kids.map(nest);
		}
		return comment;
	};

	const roots: PptxComment[] = [];
	for (const comment of comments) {
		if (!parentOf.has(comment.id)) {
			roots.push(nest(comment));
		}
	}
	return roots;
}

/**
 * The inverse of {@link nestLegacyCommentReplies}: flatten a (possibly
 * nested) legacy comment list back to one entry per `p:cm`, in depth-first
 * order (a root immediately followed by its own replies), ready to resolve
 * `@authorId`/`@idx` pairs for.
 */
export function flattenLegacyCommentThread(comments: PptxComment[]): PptxComment[] {
	const flat: PptxComment[] = [];
	const visit = (comment: PptxComment): void => {
		flat.push(comment);
		for (const reply of comment.replies ?? []) {
			visit(reply);
		}
	};
	for (const comment of comments) {
		visit(comment);
	}
	return flat;
}

/**
 * Build (or update) a legacy comment's `p:extLst`, replacing any existing
 * `p15:threadingInfo` extension with one that reflects `parent` and leaving
 * every other extension on the comment untouched (never duplicated).
 *
 * `parent` undefined removes the threading extension (the comment is no
 * longer, or never was, a reply); every other extension is still retained.
 */
export function buildLegacyThreadingExtLst(
	existingExtLst: XmlObject | undefined,
	parent: LegacyThreadingParentRef | undefined,
): XmlObject | undefined {
	const otherExts = findChildren(existingExtLst, 'ext').filter(
		(ext) => String(ext['@_uri'] || '').trim() !== LEGACY_THREADING_EXT_URI,
	);
	if (!parent) {
		if (otherExts.length === 0) {
			return undefined;
		}
		return { 'p:ext': otherExts.length === 1 ? otherExts[0] : otherExts };
	}
	const threadingExt: XmlObject = {
		'@_uri': LEGACY_THREADING_EXT_URI,
		'p15:threadingInfo': {
			'@_xmlns:p15': P15_NAMESPACE_URI,
			'@_timeZoneBias': parent.timeZoneBias ?? '0',
			'p15:parentCm': {
				'@_authorId': parent.authorId,
				'@_idx': parent.idx,
			},
		},
	};
	const allExts = [...otherExts, threadingExt];
	return { 'p:ext': allExts.length === 1 ? allExts[0] : allExts };
}
