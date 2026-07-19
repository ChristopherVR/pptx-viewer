/**
 * Human-readable diffing of a staged slides mutation, used by
 * {@link ProposalStore} to describe a pending write before it is applied.
 *
 * The diff is intentionally coarse: it reports slide-level and element-level
 * additions / removals / modifications rather than a character-precise patch,
 * which is enough for a chat surface to say "what will this change?".
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

function elementLabel(el: PptxElement): string {
	const text = 'text' in el && typeof el.text === 'string' ? el.text.trim() : '';
	const snippet = text ? `: "${text.slice(0, 24)}${text.length > 24 ? '...' : ''}"` : '';
	return `${el.type} ${el.id}${snippet}`;
}

/** Compare two element arrays for one slide, appending change lines. */
function diffElements(
	index: number,
	before: PptxElement[],
	after: PptxElement[],
	out: string[],
): void {
	const beforeById = new Map(before.map((e) => [e.id, e]));
	const afterById = new Map(after.map((e) => [e.id, e]));

	for (const el of after) {
		if (!beforeById.has(el.id)) {
			out.push(`Slide ${index + 1}: add ${elementLabel(el)}`);
		}
	}
	for (const el of before) {
		if (!afterById.has(el.id)) {
			out.push(`Slide ${index + 1}: remove ${elementLabel(el)}`);
		}
	}
	for (const el of after) {
		const prev = beforeById.get(el.id);
		if (prev && JSON.stringify(prev) !== JSON.stringify(el)) {
			out.push(`Slide ${index + 1}: modify ${elementLabel(el)}`);
		}
	}
}

/**
 * Produce a list of human-readable change lines describing the transition from
 * `before` to `after`. Returns an empty array when nothing changed.
 */
export function diffSlides(before: PptxSlide[], after: PptxSlide[]): string[] {
	const out: string[] = [];

	if (after.length > before.length) {
		out.push(`Add ${after.length - before.length} slide(s) (total ${after.length}).`);
	} else if (after.length < before.length) {
		out.push(`Remove ${before.length - after.length} slide(s) (total ${after.length}).`);
	}

	const beforeById = new Map(before.map((s) => [s.id, s]));
	const pairCount = Math.min(before.length, after.length);
	for (let i = 0; i < pairCount; i++) {
		const nextSlide = after[i];
		const prevSlide = beforeById.get(nextSlide.id) ?? before[i];
		if (!prevSlide) {
			continue;
		}
		diffElements(i, prevSlide.elements, nextSlide.elements, out);
		if ((prevSlide.notes ?? '') !== (nextSlide.notes ?? '')) {
			out.push(`Slide ${i + 1}: update speaker notes`);
		}
		if (prevSlide.backgroundColor !== nextSlide.backgroundColor) {
			out.push(`Slide ${i + 1}: change background`);
		}
	}

	if (out.length === 0) {
		out.push('No detectable changes.');
	}
	return out;
}

/**
 * Rewrite one {@link diffSlides} line into plain language for a non-technical
 * reader, dropping the raw element id: `Slide 1: modify text el-9: "Title"`
 * becomes `Slide 1: update the text "Title"`. Lines without an element clause
 * (slide add/remove, notes, background) pass through unchanged. Safe to run on
 * any string; unrecognised shapes are returned as-is.
 */
export function humanizeDiffLine(line: string): string {
	return line.replace(
		/\b(add|remove|modify) (\w+) [^\s:]+(: )?/gu,
		(_match, verb: string, type: string, colon: string | undefined) => {
			const article = verb === 'add' ? 'a' : 'the';
			const friendlyVerb = verb === 'modify' ? 'update' : verb;
			// A following `: "snippet"` becomes a plain space so it reads
			// `update the text "Title"` rather than `update the text: "Title"`.
			return `${friendlyVerb} ${article} ${type}${colon ? ' ' : ''}`;
		},
	);
}
