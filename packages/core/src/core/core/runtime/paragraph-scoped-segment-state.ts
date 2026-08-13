import type { BulletInfo, TextSegment, TextStyle } from '../../types';

/**
 * The save path collapses a text body whose runs all share one style back onto
 * the flat `element.text` string, so an edit made to that string wins over
 * stale segments. That judgement is made by `areTextSegmentsUniform`, and it is
 * a **run-scope** judgement: "uniform" means every `a:rPr` would come out the
 * same.
 *
 * Paragraph-scope state is a different scope entirely and must survive the
 * collapse. In `CT_TextParagraph` terms:
 *
 * - **per RUN** (`a:rPr`, collapsible): typeface, size, bold/italic/underline,
 *   colour and fill, spacing/kerning, baseline, caps, language, hyperlink.
 * - **per PARAGRAPH** (`a:pPr` plus the paragraph terminator, NOT collapsible):
 *   `algn`, `marL`/`marR`/`indent`, `lvl`, `rtl`, `defTabSz`, `eaLnBrk`,
 *   `latinLnBrk`, `fontAlgn`, `hangingPunct`, `a:lnSpc`/`a:spcBef`/`a:spcAft`,
 *   `a:tabLst`, the bullet group, `a:defRPr`, `a:extLst`, and `a:endParaRPr`.
 *
 * All of the paragraph-scope facts ride on the FIRST segment of each paragraph
 * (`paragraphProperties`, `paragraphLevel`, `bulletInfo`,
 * `endParaRunProperties`), so discarding the segment list discarded them too
 * and the segmentless code path supplies none: every authored `a:pPr` came back
 * from a round-trip as a bare `<a:pPr/>`.
 *
 * This module re-attaches that state to whatever run list the collapse
 * produced, leaving the run collapse itself intact.
 */
interface ParagraphScopedState {
	paragraphProperties?: TextStyle;
	endParaRunProperties?: Record<string, unknown>;
	paragraphLevel?: number;
	bulletInfo?: BulletInfo;
}

/** Extract the paragraph-scope facts a paragraph's first segment carries. */
function paragraphStateOf(segment: TextSegment): ParagraphScopedState {
	const state: ParagraphScopedState = {};
	if (segment.paragraphProperties && Object.keys(segment.paragraphProperties).length > 0) {
		state.paragraphProperties = segment.paragraphProperties;
	}
	if (segment.endParaRunProperties && typeof segment.endParaRunProperties === 'object') {
		state.endParaRunProperties = segment.endParaRunProperties;
	}
	// `lvl="0"` is the schema default and is never written, so a zero level is
	// not state worth preserving.
	if (typeof segment.paragraphLevel === 'number' && segment.paragraphLevel > 0) {
		state.paragraphLevel = segment.paragraphLevel;
	}
	if (segment.bulletInfo) {
		state.bulletInfo = segment.bulletInfo;
	}
	return state;
}

function isEmptyState(state: ParagraphScopedState): boolean {
	return (
		state.paragraphProperties === undefined &&
		state.endParaRunProperties === undefined &&
		state.paragraphLevel === undefined &&
		state.bulletInfo === undefined
	);
}

function normalizeBreaks(value: string): string {
	return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function paragraphBreakCount(segment: TextSegment): number {
	// A soft line break stays INSIDE its paragraph even though its text is
	// "\n" - `createParagraphsFromTextContent` returns before the split.
	if (segment.isLineBreak) {
		return 0;
	}
	return normalizeBreaks(String(segment.text ?? '')).split('\n').length - 1;
}

function concatenatedText(segments: TextSegment[]): string {
	return normalizeBreaks(segments.map((segment) => String(segment.text ?? '')).join(''));
}

/**
 * Walk a segment list the way `createParagraphsFromTextContent` does and read
 * off each paragraph's state. Metadata is taken from the first segment of a
 * paragraph only, matching the builder's `capturedParagraphMeta` rule: a
 * segment that spans several paragraphs supplies state for the first of them.
 */
function collectParagraphStates(segments: TextSegment[]): ParagraphScopedState[] {
	const states: ParagraphScopedState[] = [];
	let current: ParagraphScopedState = {};
	let captured = false;
	for (const segment of segments) {
		if (!captured) {
			current = paragraphStateOf(segment);
			captured = true;
		}
		for (let index = 0; index < paragraphBreakCount(segment); index++) {
			states.push(current);
			current = {};
			captured = false;
		}
	}
	states.push(current);
	return states;
}

/**
 * One segment per paragraph of `text`, carrying no run style of its own so the
 * runs are still built from the element-level style. The trailing "\n" is what
 * splits the paragraphs, exactly as a parsed paragraph-break segment does.
 */
function synthesizeParagraphSegments(text: string): TextSegment[] {
	const lines = normalizeBreaks(text).split('\n');
	return lines.map((line, index) => ({
		text: index < lines.length - 1 ? `${line}\n` : line,
		style: {},
	}));
}

/** Stamp each paragraph's state onto the first segment of that paragraph. */
function assignParagraphStates(
	baseSegments: TextSegment[],
	states: ParagraphScopedState[],
): TextSegment[] {
	const result: TextSegment[] = [];
	let paragraphIndex = 0;
	let captured = false;
	for (const segment of baseSegments) {
		let next = segment;
		if (!captured) {
			captured = true;
			const state = states[paragraphIndex];
			if (state && !isEmptyState(state)) {
				next = { ...segment };
				if (state.paragraphProperties && next.paragraphProperties === undefined) {
					next.paragraphProperties = state.paragraphProperties;
				}
				if (state.endParaRunProperties && next.endParaRunProperties === undefined) {
					next.endParaRunProperties = state.endParaRunProperties;
				}
				if (state.paragraphLevel !== undefined && next.paragraphLevel === undefined) {
					next.paragraphLevel = state.paragraphLevel;
				}
				if (state.bulletInfo && next.bulletInfo === undefined) {
					next.bulletInfo = state.bulletInfo;
				}
			}
		}
		result.push(next);
		for (let index = 0; index < paragraphBreakCount(next); index++) {
			paragraphIndex++;
			captured = false;
		}
	}
	return result;
}

/**
 * Re-attach paragraph-scope state after the uniform-run collapse.
 *
 * @param baseSegments The run list the collapse produced: `undefined` for the
 *   plain flat-string path, or the style-remapped list when the existing
 *   `p:txBody` still held mixed run styles.
 * @param text The flat text the paragraphs will be rebuilt from.
 * @param sourceSegments The element's own segments, the only carrier of
 *   paragraph-scope state.
 * @returns `baseSegments` untouched when there is no paragraph-scope state to
 *   preserve (so bodies that never had any keep byte-identical output), the
 *   source segments when they hold structure the flat string cannot express,
 *   or a run list with the state stamped back on.
 */
export function preserveParagraphScopedState(
	baseSegments: TextSegment[] | undefined,
	text: string,
	sourceSegments: TextSegment[] | undefined,
): TextSegment[] | undefined {
	if (!sourceSegments || sourceSegments.length === 0) {
		return baseSegments;
	}
	const states = collectParagraphStates(sourceSegments);
	if (states.every(isEmptyState)) {
		return baseSegments;
	}
	// A soft line break (`a:br`) is paragraph-internal STRUCTURE rather than
	// state: the flat string spells it "\n", exactly as it spells a paragraph
	// terminator, so nothing rebuilt from that string can tell the two apart.
	// While the text still matches the segments there is no edit to honour, so
	// keep them verbatim instead of degrading every break into a paragraph
	// split.
	if (
		baseSegments === undefined &&
		sourceSegments.some((segment) => segment.isLineBreak) &&
		concatenatedText(sourceSegments) === normalizeBreaks(text)
	) {
		return sourceSegments;
	}
	return assignParagraphStates(baseSegments ?? synthesizeParagraphSegments(text), states);
}
