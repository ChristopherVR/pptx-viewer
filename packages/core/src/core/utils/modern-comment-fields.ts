import type { PptxComment } from '../types';

/** Attribute normalisation for a `p188:cm` / `p188:reply` node. */

/**
 * `@created`, preferring the model value but never stamping "now" over a
 * timestamp this code merely failed to parse.
 */
export function modernCommentCreated(value: string | undefined, fallback: unknown): string {
	const parsed = Date.parse(String(value || ''));
	if (!Number.isNaN(parsed)) {
		return new Date(parsed).toISOString();
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
 */
export function modernCommentStatus(comment: PptxComment): string {
	if (comment.resolved === undefined) {
		return comment.status || 'active';
	}
	if (comment.resolved) {
		return comment.status === 'closed' ? 'closed' : 'resolved';
	}
	return comment.status === 'resolved' || comment.status === 'closed'
		? 'active'
		: comment.status || 'active';
}
