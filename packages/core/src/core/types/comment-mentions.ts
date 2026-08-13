/**
 * `@`-mention metadata for modern (`p188`) threaded comments.
 *
 * @module pptx-types/comment-mentions
 */

import type { XmlObject } from './common';

/**
 * A single `@`-mention inside a modern comment body.
 *
 * Offsets index into the comment's FLATTENED plain text: every `a:t` value
 * below `p188:txBody` concatenated, with paragraphs joined by `\n`. That is the
 * same string `PptxComment.text` carries, so an edit to `text` invalidates
 * every offset after the edit point and the serializer re-bases them.
 *
 * The markup Office uses for a mention is `CT_Mention` (documented for the
 * SpreadsheetML `2018/threadedcomments` part): `mentionpersonId`, `mentionId`,
 * `startIndex` and `length`. The PowerPoint `2018/8/main` schema does not
 * publish a mention element at all, so `rawXml` is retained and re-emitted
 * attribute-for-attribute: a producer that spells the attributes differently
 * still round-trips.
 *
 * @example
 * ```ts
 * const mention: PptxCommentMention = {
 *   personId: "{2CB2E9D0-D392-EB21-5D46-FBA34C1295E6}",
 *   authorName: "Bob Example",
 *   startIndex: 3,
 *   length: 11,
 * };
 * // => "Hi Bob Example can you check this".slice(3, 14) === "Bob Example"
 * ```
 */
export interface PptxCommentMention {
	/** `mentionId`: GUID identifying this mention instance. */
	id?: string;
	/** `mentionpersonId`: the `p188:author` id of the mentioned person. */
	personId: string;
	/** Display name resolved from the author list at parse time, when known. */
	authorName?: string;
	/** Character offset of the mentioned span in the flattened plain text. */
	startIndex: number;
	/** Character length of the mentioned span. */
	length: number;
	/**
	 * `uri` of the `p188:ext` this mention list was read from. Undefined means
	 * the list is a direct child of `p188:cm`, which is where it is written for
	 * newly authored mentions.
	 */
	containerUri?: string;
	/** Original `p188:mention` node, retained for unknown-attribute preservation. */
	rawXml?: XmlObject;
}
