/**
 * THE shared predicate for "is this text segment a paragraph SEPARATOR",
 * i.e. not renderable content of either paragraph it sits between.
 *
 * A segment produced by a post-edit remap is tagged `isParagraphBreak: true`
 * explicitly. A segment produced by the initial slide-load parser
 * (`PptxHandlerRuntimeShapeParagraphContentParsing` in `pptx-viewer-core`)
 * instead carries a bare `text: '\n'` with NO flag at all: the parser only
 * tags a soft `<a:br/>` line break within a paragraph (`isLineBreak: true`,
 * ALSO `text: '\n'`), never the terminator between two `<a:p>` paragraphs.
 * Both shapes have to be recognised as "this is a break, not a glyph":
 * checking `isParagraphBreak` alone misses the (far more common) slide-load
 * case entirely.
 *
 * Every caller that groups a segment list into paragraphs must use this, not
 * a local `isParagraphBreak` check: `text-warp.ts`'s `groupIntoParagraphs`
 * used to check only `isParagraphBreak`, so a freshly-loaded (never
 * edit-remapped) multi-paragraph WordArt block never split at all - its
 * bare `'\n'` separator fell into the first paragraph's own run list and was
 * measured and rendered as its own glyph, which also flipped the vertical
 * ordering of a multi-line envelope (`buildGlyphEnvelope`'s `lineIndex`/
 * `lineCount` slicing assumes ONE paragraph per line).
 */
import type { TextSegment } from 'pptx-viewer-core';

export function isParagraphSeparatorSegment(segment: TextSegment): boolean {
	return Boolean(segment.isParagraphBreak) || (segment.text === '\n' && !segment.isLineBreak);
}
