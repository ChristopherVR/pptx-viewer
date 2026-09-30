import type { PptxElementWithText, TextSegment } from 'pptx-viewer-core';

function editRange(segments: TextSegment[], start: number, end: number, replacement: string): void {
	let offset = 0;
	let inserted = false;
	for (const segment of segments) {
		const text = segment.text;
		const next = offset + text.length;
		if (!segment.bulletInfo?.ownedByParagraph && next > start && offset < end) {
			const from = Math.max(0, start - offset);
			const to = Math.min(text.length, end - offset);
			segment.text = text.slice(0, from) + (inserted ? '' : replacement) + text.slice(to);
			inserted = true;
		} else if (
			!inserted &&
			start === end &&
			offset <= start &&
			next >= start &&
			!segment.bulletInfo?.ownedByParagraph
		) {
			const at = start - offset;
			segment.text = text.slice(0, at) + replacement + text.slice(at);
			inserted = true;
		}
		offset = next;
	}
	if (!inserted && replacement) {
		segments.push({ text: replacement, style: {} });
	}
}

/** Change text without discarding the paragraph metadata or synthetic bullet markers. */
function changedRange(
	before: string,
	text: string,
): { start: number; end: number; replacement: string } {
	let start = 0;
	while (start < before.length && start < text.length && before[start] === text[start]) {
		start++;
	}
	let suffix = 0;
	while (
		suffix < before.length - start &&
		suffix < text.length - start &&
		before[before.length - suffix - 1] === text[text.length - suffix - 1]
	) {
		suffix++;
	}
	return {
		start,
		end: before.length - suffix,
		replacement: text.slice(start, text.length - suffix),
	};
}

export function setElementText(element: PptxElementWithText, text: string): void {
	const segments = element.textSegments;
	if (segments?.length) {
		const before = segments.map((segment) => segment.text).join('');
		const oldLines = before.split('\n');
		const newLines = text.split('\n');
		if (oldLines.length === newLines.length) {
			let offset = before.length;
			for (let index = oldLines.length - 1; index >= 0; index--) {
				const line = oldLines[index];
				offset -= line.length;
				const edit = changedRange(line, newLines[index]);
				editRange(segments, offset + edit.start, offset + edit.end, edit.replacement);
				offset--;
			}
		} else {
			const edit = changedRange(before, text);
			editRange(segments, edit.start, edit.end, edit.replacement);
		}
		element.text = segments.map((segment) => segment.text).join('');
	} else {
		element.text = text;
	}
}

export function replaceElementText(
	element: PptxElementWithText,
	regex: RegExp,
	replacement: string,
): number {
	const before =
		element.text ?? element.textSegments?.map((segment) => segment.text).join('') ?? '';
	const matches = Array.from(before.matchAll(regex));
	if (before.replace(regex, replacement) === before) {
		return 0;
	}
	if (!element.textSegments?.length) {
		element.text = before.replace(regex, replacement);
		return matches.length;
	}
	for (const match of matches.reverse()) {
		const start = match.index;
		const end = start + match[0].length;
		// Run native replacement against the original string so captures,
		// lookarounds and replacement tokens retain their normal meaning.
		const single = new RegExp(regex.source, `${regex.flags.replace('g', '')}y`);
		single.lastIndex = start;
		const after = before.replace(single, replacement);
		editRange(
			element.textSegments,
			start,
			end,
			after.slice(start, after.length - (before.length - end)),
		);
	}
	element.text = element.textSegments.map((segment) => segment.text).join('');
	return matches.length;
}
