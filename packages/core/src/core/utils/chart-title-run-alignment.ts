/**
 * Realign a stale multi-run chart title's per-run texts onto an edited flat
 * title string, so an edit to `PptxChartData.title` alone (leaving
 * `titleRuns` untouched) does not orphan every run after the one that
 * changed. Split out of `chart-title-serializer.ts` to keep that file under
 * the repo's file-size guideline.
 *
 * @module utils/chart-title-run-alignment
 */

import type { PptxChartTitleRun } from '../types';

/**
 * Realign a stale `titleRuns` array's texts onto an edited flat `title`
 * string, when the edit is localized (an append, an insertion, or a rewrite
 * of one run) rather than an unrelated full rewrite.
 *
 * The caller has edited `model.title` directly without touching `titleRuns`
 * (every pre-existing chart-title consumer's edit shape), so `titleRuns`
 * still holds the OLD per-run texts. Naively patching just the first run
 * leaves every subsequent run with its now-orphaned stale text, so a two-run
 * title edited by appending text came back as the edited text glued to the
 * original SECOND run's unrelated text.
 *
 * Walks `oldTexts` left to right, matching each one as a literal anchor in
 * `newText` starting exactly where the previous anchor ended. A run whose old
 * text is not found there is a "changed" run: it absorbs everything between
 * the previous anchor and wherever the NEXT run's old text resurfaces (its
 * own literal text is otherwise gone, replaced by the edit). Any run between
 * two anchors that only differs in position (never happens if the walk is
 * left-to-right and anchors are non-overlapping) is left untouched. Trailing
 * text after the last anchor lands on the last run (an append).
 *
 * Returns `undefined` when a later run's text cannot be relocated at all
 * (an unrelated rewrite unrelated to any run boundary), signalling the
 * caller to fall back to the coarse single-run patch.
 */
export function distributeTitleRunsText(
	oldTexts: readonly string[],
	newText: string,
): string[] | undefined {
	if (oldTexts.length === 0) {
		return undefined;
	}
	const result: string[] = new Array(oldTexts.length).fill('');
	let pos = 0;
	let index = 0;
	while (index < oldTexts.length) {
		const text = oldTexts[index] ?? '';
		if (newText.startsWith(text, pos)) {
			result[index] = text;
			pos += text.length;
			index++;
			continue;
		}
		// This run's text no longer appears right here: find the next run whose
		// old text resurfaces later in `newText`, and let this run (and any
		// further non-matching runs before that point) absorb the gap.
		let resumeAt = -1;
		let anchorIndex = -1;
		for (let candidate = index + 1; candidate < oldTexts.length; candidate++) {
			const candidateText = oldTexts[candidate];
			if (!candidateText) {
				continue;
			}
			const found = newText.indexOf(candidateText, pos);
			if (found !== -1) {
				resumeAt = found;
				anchorIndex = candidate;
				break;
			}
		}
		if (anchorIndex === -1) {
			// No later run boundary survives: cannot realign, this is an
			// unrelated rewrite from this run's boundary onward.
			return undefined;
		}
		result[index] = newText.slice(pos, resumeAt);
		for (let cleared = index + 1; cleared < anchorIndex; cleared++) {
			result[cleared] = '';
		}
		pos = resumeAt;
		index = anchorIndex;
	}
	if (pos < newText.length) {
		result[result.length - 1] += newText.slice(pos);
	}
	return result;
}

/**
 * Resolve the runs a stale multi-run title should serialize as, after the
 * caller edited only the flat `title` string.
 *
 * Tries {@link distributeTitleRunsText} first: when the new text still
 * contains every unaffected run's original text in order, every run and its
 * formatting survive, realigned onto the new text. Only when no such
 * alignment exists at all (an unrelated full rewrite) does this collapse the
 * title to a SINGLE run carrying `staleRuns`' first run's formatting and the
 * whole new text, dropping the other runs. That is what PowerPoint itself
 * does when you retype a chart title, and it replaces the old, strictly
 * worse fallback of patching only the first run's TEXT in place while every
 * additional run's text stayed on the slide, stale.
 *
 * `staleRuns` must be non-empty; callers only reach this once a multi-run
 * `titleRuns` array is already known to exist.
 */
export function realignOrCollapseTitleRuns(
	staleRuns: readonly PptxChartTitleRun[],
	newTitle: string,
): PptxChartTitleRun[] {
	const distributed = distributeTitleRunsText(
		staleRuns.map((run) => run.text),
		newTitle,
	);
	if (distributed) {
		return staleRuns.map((run, index) => ({ ...run, text: distributed[index] ?? '' }));
	}
	return [{ ...staleRuns[0], text: newTitle }];
}
