/**
 * Locate one `<p:grpSp>` inside a slide part's raw XML.
 *
 * `CT_GroupShape` is a painter's-algorithm sequence, but fast-xml-parser
 * buckets siblings BY TAG, so the parsed object cannot say whether a
 * `<p:grpSp>` came before or after its `<p:sp>` siblings. The repo already
 * solves this for `<p:spTree>` by rescanning the raw XML string
 * (`scanDirectChildElements`), which starts at the FIRST occurrence of the
 * container tag: fine for the one `p:spTree` in a slide, useless for the many
 * `p:grpSp`. Group parsing therefore passed `undefined` and fell back to
 * `buildTypeGroupedOrder`, which emits all `p:sp`, then all `p:pic`, then all
 * `p:grpSp`, ...
 *
 * That silently restacked every group with mixed child tags. PowerPoint (COM)
 * reports `solution-explorer.pptx` slide 5 as `!!Content, Group 3,
 * Rectangle 4`; type-grouped order returns `!!Content, Rectangle 4, Group 3`,
 * so the whole nested subtree paints in front of a shape it belongs behind.
 * Ten groups across the fixture corpus are affected.
 *
 * Rather than write a second scanner, this module finds the byte offset of a
 * specific group so the EXISTING scanner can be handed a slice that starts at
 * it. Identity comes from `p:nvGrpSpPr/p:cNvPr/@id`, which is unique within a
 * slide part and is the same id `p:timing` and the Selection Pane bind to.
 */

/**
 * Byte offset of the `<p:grpSp>` whose own `p:cNvPr/@id` is `cNvPrId`.
 *
 * @param slideXml - Raw XML of the slide part the group lives in.
 * @param cNvPrId - The group's non-visual id, as a string.
 * @returns The index of the `<` opening that group, or `undefined` when the
 *   group cannot be identified (no raw XML, no id, or no match). Callers must
 *   treat `undefined` as "fall back to the tag-grouped order".
 */
export function findGroupXmlOffset(slideXml: string, cNvPrId: string): number | undefined {
	if (cNvPrId.length === 0) {
		return undefined;
	}
	const opener = /<p:grpSp[\s>]/g;
	let match: RegExpExecArray | null;
	while ((match = opener.exec(slideXml))) {
		// `p:nvGrpSpPr` is the first child of `CT_GroupShape`, so the first
		// `p:cNvPr` after the open tag is always this group's own.
		const cNvPrIdx = slideXml.indexOf('<p:cNvPr', match.index);
		if (cNvPrIdx === -1) {
			return undefined;
		}
		const tagEnd = slideXml.indexOf('>', cNvPrIdx);
		if (tagEnd === -1) {
			return undefined;
		}
		const idMatch = /\bid="([^"]*)"/.exec(slideXml.slice(cNvPrIdx, tagEnd));
		if (idMatch && idMatch[1] === cNvPrId) {
			return match.index;
		}
	}
	return undefined;
}
