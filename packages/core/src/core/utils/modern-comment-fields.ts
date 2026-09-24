import type { PptxComment } from '../types';

/** Attribute normalisation for a `p188:cm` / `p188:reply` node. */

/**
 * `@created`, preferring the model value but never stamping "now" over a
 * timestamp this code merely failed to parse.
 *
 * A valid, already-authored timestamp is returned EXACTLY as written, never
 * reformatted. Reformatting a valid string through `Date.parse` ->
 * `toISOString()` always renders in UTC, which silently shifted the clock
 * time by the local machine's offset whenever the source string had no
 * explicit UTC/offset marker (e.g. `2024-01-15T10:30:00`, parsed as LOCAL
 * time): a comment authored at 10:30 came back stamped 15:30 on a machine
 * five hours behind UTC, on a save that never touched the comment at all.
 */
export function modernCommentCreated(value: string | undefined, fallback: unknown): string {
	const candidate = String(value ?? '').trim();
	if (candidate.length > 0 && !Number.isNaN(Date.parse(candidate))) {
		return candidate;
	}
	const original = String(fallback ?? '').trim();
	return original.length > 0 ? original : new Date().toISOString();
}

/**
 * `@status` reconciled against the model's `resolved` flag.
 *
 * The shared comment-list toggle flips only `resolved`, so preferring the
 * untouched `status` made un-resolving a thread round-trip straight back to
 * `status="resolved"`.
 *
 * Returns `undefined` (meaning: omit the attribute) rather than the literal
 * `'active'` when nothing was edited and the source never authored `@status`
 * in the first place (`hasRawStatus` false): PowerPoint's own schema default
 * for a missing `@status` IS "active", so materialising the attribute here
 * turned every untouched, never-resolved comment into a diff on a clean
 * save. A brand-new comment (no raw XML to preserve the absence of) still
 * gets it written out explicitly.
 */
export function modernCommentStatus(
	comment: PptxComment,
	hasRaw: boolean,
	hasRawStatus: boolean,
): string | undefined {
	if (comment.resolved === undefined) {
		if (comment.status !== undefined) {
			return comment.status;
		}
		// Untouched: only surface a status when the source authored one, or
		// there is no source to preserve the absence of (a brand-new
		// comment). The two branches below are reached only for an actual
		// edit (the resolve/unresolve toggle sets `resolved` explicitly), so
		// they keep materialising a concrete value: an edit is worth writing
		// regardless of what the source originally had.
		return !hasRaw || hasRawStatus ? 'active' : undefined;
	}
	if (comment.resolved) {
		return comment.status === 'closed' ? 'closed' : 'resolved';
	}
	return comment.status === 'resolved' || comment.status === 'closed'
		? 'active'
		: comment.status || 'active';
}
