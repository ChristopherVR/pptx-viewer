/**
 * Trailing spaces at the end of a right-aligned or centred paragraph.
 *
 * PowerPoint ignores a paragraph's trailing spaces when it aligns the line:
 * `"Right aligned trailing spaces      "` with `algn="r"` puts the `s` of
 * `spaces` on the right margin (COM-verified, audit-text slide 18). The text
 * block renders with `white-space: pre-wrap`, where Chromium keeps those
 * preserved spaces in the line it aligns, so the visible text sat a space
 * run's width short of the margin. Dropping them from the render model (the
 * document itself is untouched) gives PowerPoint's placement.
 *
 * @module paragraph-trailing-space
 */

/** The run fields this pass reads; anything with extras is left alone. */
export interface TrimmableRun {
	text: string;
	equation?: unknown;
	tabLines?: unknown;
	scriptRuns?: unknown;
	ruby?: unknown;
	underlineWordPieces?: unknown;
	/** A hanging punctuation mark's advance (`text-east-asian-breaks`), never trimmed. */
	hangingSpace?: boolean;
}

/** Whether a CSS `text-align` value aligns against the end or the centre. */
function alignsTrailingEdge(cssAlign: string | undefined, rtl: boolean): boolean {
	if (cssAlign === 'center' || cssAlign === 'justify') {
		return true;
	}
	if (cssAlign === 'right' || cssAlign === 'end') {
		return !rtl || cssAlign === 'end';
	}
	return rtl && (cssAlign === 'left' || cssAlign === 'end');
}

/**
 * Drop the paragraph-final whitespace from `runs` when the paragraph's
 * alignment would otherwise let it push the visible text off the margin.
 * Returns `runs` itself when nothing changes.
 */
export function trimParagraphTrailingSpaces<T extends TrimmableRun>(
	runs: T[],
	cssAlign: string | undefined,
	rtl: boolean,
): T[] {
	if (!alignsTrailingEdge(cssAlign, rtl)) {
		return runs;
	}
	const out = [...runs];
	let changed = false;
	while (out.length > 0) {
		const last = out[out.length - 1];
		if (
			last.equation ||
			last.tabLines ||
			last.scriptRuns ||
			last.ruby ||
			last.underlineWordPieces ||
			last.hangingSpace ||
			!/[ 　]$/u.test(last.text) ||
			last.text.includes('\n') ||
			(out.length === 1 && /^[ 　]*$/u.test(last.text))
		) {
			break;
		}
		const trimmed = last.text.replace(/[ 　]+$/u, '');
		changed = true;
		if (trimmed.length > 0) {
			out[out.length - 1] = { ...last, text: trimmed };
			break;
		}
		out.pop();
	}
	return changed ? out : runs;
}
