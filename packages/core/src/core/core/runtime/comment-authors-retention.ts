/**
 * Decide whether a save keeps the source `ppt/commentAuthors.xml` although no
 * comment written this save references an author.
 *
 * The comment writer rebuilds the author list from the authors its comments
 * USE, and with none it removes the part plus its presentation relationship
 * and content-type override. That is right when this session removed the
 * comments those authors made: the list would otherwise name authors of
 * comments that no longer exist. But a deck can also ship an author list
 * with no legacy comment parts at all (for example an empty
 * `<p:cmAuthorLst/>` written by the generating tool, or authors whose
 * comments were deleted before the file was saved). Nothing this session did
 * touched that list, so dropping it is save residue, not an edit.
 *
 * Rule: keep the source part untouched when no author is used, the package
 * still holds the part, and the package held no legacy comment part when the
 * save began (so no comment, and therefore no author's last comment, was
 * deleted by this session).
 *
 * @module comment-authors-retention
 */

export interface CommentAuthorsRetentionInput {
	/** Whether any comment written by this save references an author. */
	hasUsedCommentAuthors: boolean;
	/** Whether the package currently contains `ppt/commentAuthors.xml`. */
	authorsPartPresent: boolean;
	/** Legacy `ppt/comments/commentN.xml` parts present when the save began. */
	existingLegacyCommentPartCount: number;
}

/** `true` when the source author list must be left exactly as it is. */
export function shouldKeepSourceCommentAuthors(input: CommentAuthorsRetentionInput): boolean {
	return (
		!input.hasUsedCommentAuthors &&
		input.authorsPartPresent &&
		input.existingLegacyCommentPartCount === 0
	);
}
