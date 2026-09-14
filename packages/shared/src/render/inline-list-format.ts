import type { TextSegment } from 'pptx-viewer-core';

import { isBulletMarkerSegment } from './bullet-toggle';
import { withInlineListDecorationDefaults } from './inline-list-decoration';
import {
	clearSingleTextDecoration,
	sharedTextDecorationAncestors,
	paintInlineListRun,
} from './inline-list-format-style';
import { inlineListSession, registerInlineListParagraphFormat } from './inline-list-seed';
import { readInlineListSelection, restoreInlineListBodySelection } from './inline-list-selection';
import { readInlineListSnapshot } from './inline-list-snapshot';
import type {
	InlineListReadResult,
	InlineListSeed,
	InlineTextEditSnapshot,
} from './inline-list-types';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';
import { resolveAutoFitFontScale } from './text-style-helpers';

interface RunRange {
	segment: TextSegment;
	start: number;
	end: number;
}
interface Paragraph {
	first?: TextSegment;
	runs: RunRange[];
	text: string;
}

function paragraphs(segments: TextSegment[]): Paragraph[] {
	const result: Paragraph[] = [{ runs: [], text: '' }];
	for (const segment of segments) {
		if (isParagraphSeparatorSegment(segment)) {
			result.push({ runs: [], text: '' });
			continue;
		}
		const paragraph = result.at(-1)!;
		const first = !paragraph.first;
		paragraph.first ??= segment;
		if (first && isBulletMarkerSegment(segment)) {
			continue;
		}
		const start = paragraph.text.length;
		paragraph.text += segment.text;
		paragraph.runs.push({ segment, start, end: paragraph.text.length });
	}
	return result;
}

/** Explicit model-format commands only. Never called to repair ordinary input. */
export function reconcileInlineListFormatting(
	seed: InlineListSeed,
	root: HTMLElement,
	formatted: InlineTextEditSnapshot,
): InlineListReadResult {
	const before = readInlineListSnapshot(seed, root);
	if (before.kind !== 'supported') {
		return before;
	}
	const unsupported = (reason: string): InlineListReadResult => ({
		kind: 'unsupported',
		reason,
		text: before.snapshot.text,
	});
	const session = inlineListSession(seed);
	if (
		!session ||
		formatted.elementId !== seed.elementId ||
		!formatted.textSegments ||
		formatted.text !== before.snapshot.text
	) {
		return unsupported('format-requires-current-body');
	}
	const next = paragraphs(formatted.textSegments);
	const previous = paragraphs(before.snapshot.textSegments!);
	const defaults = 'textStyle' in session.element ? session.element.textStyle : undefined;
	const blocks = Array.from(root.children);
	if (
		next.length !== blocks.length ||
		next.some((paragraph, index) => paragraph.text !== previous[index]?.text)
	) {
		return unsupported('format-paragraph-topology-changed');
	}
	const edits: Array<{
		node: Text;
		pieces: Array<{ text: string; segment: TextSegment }>;
		changed: boolean;
		unsafeAtomic: boolean;
	}> = [];
	const decorationAncestors = new Set<HTMLElement>();
	for (const [index, block] of blocks.entries()) {
		let position = 0;
		let invalid = false;
		const walk = (node: Node): void => {
			if (node.nodeType === 3) {
				const value = node.nodeValue ?? '';
				if (!value) {
					return;
				}
				const start = position;
				position += value.length;
				const desired = next[index].runs.filter((run) => run.end > start && run.start < position);
				const pieces = desired.map((run) => ({
					text: value.slice(
						Math.max(0, run.start - start),
						Math.min(value.length, run.end - start),
					),
					segment: run.segment,
				}));
				if (pieces.map((piece) => piece.text).join('') !== value) {
					invalid = true;
					return;
				}
				const old = previous[index].runs.filter((run) => run.end > start && run.start < position);
				for (const [property, decoration] of [
					['underline', 'underline'],
					['strikethrough', 'line-through'],
				] as const) {
					if (
						old.some(
							(run) => withInlineListDecorationDefaults(run.segment.style, defaults)[property],
						) &&
						pieces.some(
							(piece) => !withInlineListDecorationDefaults(piece.segment.style, defaults)[property],
						)
					) {
						for (const ancestor of sharedTextDecorationAncestors(node as Text, root, decoration)) {
							// The binding owns the outer editor's element-level style.
							if (ancestor === root) {
								invalid = true;
								return;
							}
							decorationAncestors.add(ancestor);
						}
					}
				}
				const unchanged =
					pieces.length === 1 &&
					old.length === 1 &&
					JSON.stringify(pieces[0].segment.style) === JSON.stringify(old[0].segment.style);
				const unsafeAtomic =
					desired.some(
						(run) => run.segment.fieldType || run.segment.equationXml || run.segment.rubyText,
					) &&
					(pieces.length !== 1 || node.parentNode?.childNodes.length !== 1);
				edits.push({ node: node as Text, pieces, changed: !unchanged, unsafeAtomic });
				return;
			}
			if (!(node instanceof HTMLElement)) {
				return;
			}
			if (node.hasAttribute('data-pptx-bullet-marker') || node.tagName === 'RT') {
				return;
			}
			if (node.tagName === 'BR') {
				if (next[index].text) {
					position += 1;
				}
				return;
			}
			if (
				node !== block &&
				!['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'A', 'FONT', 'RUBY'].includes(node.tagName)
			) {
				invalid = true;
				return;
			}
			for (const child of Array.from(node.childNodes)) {
				walk(child);
			}
		};
		walk(block);
		if (invalid || position !== next[index].text.length) {
			return unsupported('unsupported-format-run-topology');
		}
	}
	// Moving an ancestor's decoration onto its body runs preserves unaffected
	// siblings while allowing one selected word to opt out of the underline.
	const activeEdits = edits.filter(
		(edit) =>
			edit.changed || [...decorationAncestors].some((ancestor) => ancestor.contains(edit.node)),
	);
	if (activeEdits.some((edit) => edit.unsafeAtomic)) {
		return unsupported('unsupported-format-run-topology');
	}
	const savedSelection = readInlineListSelection(seed, root);
	const fontScale = resolveAutoFitFontScale(
		'textStyle' in session.element ? session.element.textStyle : undefined,
	);
	for (const ancestor of decorationAncestors) {
		ancestor.style.textDecoration = 'none';
		ancestor.style.textDecorationLine = 'none';
	}
	for (const { node, pieces } of activeEdits) {
		clearSingleTextDecoration(node, root);
		let remaining = node;
		for (const [index, piece] of pieces.entries()) {
			const after = index < pieces.length - 1 ? remaining.splitText(piece.text.length) : undefined;
			const existing = remaining.parentElement;
			const wrapper =
				pieces.length === 1 && existing?.tagName === 'SPAN' && existing.childNodes.length === 1
					? existing
					: root.ownerDocument.createElement('span');
			if (wrapper !== existing) {
				remaining.parentNode!.insertBefore(wrapper, remaining);
				wrapper.append(remaining);
			}
			paintInlineListRun(seed, wrapper, piece.segment, fontScale);
			if (after) {
				remaining = after;
			}
		}
	}
	for (const [index, block] of blocks.entries()) {
		const first = next[index].first;
		if (!next[index].text && first) {
			const emptyRun = block.querySelector<HTMLElement>('[data-pptx-list-run]');
			if (emptyRun) {
				paintInlineListRun(
					seed,
					emptyRun,
					{
						text: '',
						style:
							first.paragraphInsertionStyle ?? next[index].runs[0]?.segment.style ?? first.style,
					},
					fontScale,
				);
			}
		}
		(block as HTMLElement).dataset.pptxListParagraph = registerInlineListParagraphFormat(seed, {
			bulletInfo:
				first?.style.listType === 'none' ? { ...first.bulletInfo, none: true } : first?.bulletInfo,
			paragraphLevel: first?.paragraphLevel,
			paragraphProperties: first?.paragraphProperties,
		})!;
	}
	if (savedSelection.kind === 'supported' && savedSelection.bodyRange) {
		restoreInlineListBodySelection(seed, root, savedSelection.bodyRange);
	}
	return readInlineListSnapshot(seed, root);
}
