import type { PptxComment } from '../types';

/**
 * Which comment vocabulary a comment has to be written in.
 *
 * The legacy PresentationML comment list (`p:cmLst` / `CT_CommentList`) has no
 * native reply concept: `CT_Comment` is `pos` + `text` plus attributes. A
 * reply chain can still round-trip through it via the Office 2013
 * `p15:threadingInfo` extension (see `utils/legacy-comment-threading`), which
 * records each reply's parent as an (`authorId`, `idx`) pair rather than
 * nesting - so carrying `replies` is, by itself, no longer a reason to
 * promote. `@`-mentions still are: legacy `CT_Comment` has nowhere to record
 * a mention's person id or its span, so any comment in the thread that owns
 * one (or is itself already in the modern format) promotes the WHOLE thread
 * to the modern Office 2021 threaded-comment part (`p188:cmLst`), which
 * models both natively.
 */

const GUID_PATTERN = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/iu;

/** Whether THIS comment, on its own, needs the modern vocabulary. */
function commentOwnsModernOnlyFeature(comment: PptxComment): boolean {
	return comment.format === 'modern' || (comment.mentions?.length ?? 0) > 0;
}

/**
 * Whether the legacy vocabulary is incapable of round-tripping this comment
 * OR any comment in its reply thread.
 */
export function commentRequiresModernFormat(comment: PptxComment): boolean {
	if (commentOwnsModernOnlyFeature(comment)) {
		return true;
	}
	return (comment.replies ?? []).some((reply) => commentRequiresModernFormat(reply));
}

/** Whether this comment belongs in the modern (`p188`) threaded-comment part. */
export function usesModernCommentFormat(comment: PptxComment): boolean {
	return comment.format === 'modern' || commentRequiresModernFormat(comment);
}

const hash32 = (input: string, seed: number): number => {
	let hash = seed >>> 0;
	for (let index = 0; index < input.length; index += 1) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
};

/**
 * Map an arbitrary comment id onto the brace-wrapped GUID shape the modern
 * comment part uses. Derived from the source id rather than random so that
 * saving the same deck twice keeps the same comment identity.
 */
export function toModernCommentId(id: string): string {
	const candidate = String(id || '').trim();
	if (GUID_PATTERN.test(candidate)) {
		return candidate.toUpperCase();
	}
	const hex = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
		.map((seed) => hash32(candidate, seed).toString(16).padStart(8, '0'))
		.join('')
		.toUpperCase();
	return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}}`;
}

/**
 * Convert a legacy comment (and its replies) into a modern one.
 *
 * The legacy `rawXml` is dropped deliberately: it is a `p:cm` subtree whose
 * children (`p:text`) and attributes (`@idx`, `@dt`) are meaningless in
 * `p188:cm` and would be copied through verbatim by the modern serializer.
 * Comments already in the modern format are returned untouched so their raw
 * subtree, mentions and extensions survive.
 */
export function promoteCommentToModern(comment: PptxComment): PptxComment {
	if (comment.format === 'modern') {
		return comment;
	}
	const promoted: PptxComment = {
		...comment,
		id: toModernCommentId(comment.id),
		format: 'modern',
		status: comment.status ?? (comment.resolved ? 'resolved' : 'active'),
		rawXml: undefined,
	};
	if (comment.replies?.length) {
		promoted.replies = comment.replies.map((reply) => promoteCommentToModern(reply));
	}
	return promoted;
}
