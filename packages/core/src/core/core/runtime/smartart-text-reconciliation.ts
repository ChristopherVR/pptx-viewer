import type { PptxSmartArtTextParagraph, PptxSmartArtTextParagraphItem } from '../../types';
import { smartArtParagraphsText } from './smartart-text-paragraphs';

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function itemText(item: PptxSmartArtTextParagraphItem): string | undefined {
	if (item.kind === 'run') {
		return item.run.text;
	}
	return item.kind === 'field' ? item.text : undefined;
}

function setItemText(item: PptxSmartArtTextParagraphItem, text: string): void {
	if (item.kind === 'run') {
		item.run.text = text;
	} else if (item.kind === 'field') {
		item.text = text;
	}
}

function commonEdges(before: string, after: string): { prefix: number; suffix: number } {
	let prefix = 0;
	while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
		prefix++;
	}
	let suffix = 0;
	while (
		suffix < before.length - prefix &&
		suffix < after.length - prefix &&
		before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
	) {
		suffix++;
	}
	return { prefix, suffix };
}

function separators(text: string): string {
	return [...text].filter((character) => character === '\n' || character === '\t').join('');
}

function textRegions(paragraphs: PptxSmartArtTextParagraph[]): PptxSmartArtTextParagraphItem[][] {
	const regions: PptxSmartArtTextParagraphItem[][] = [];
	let current: PptxSmartArtTextParagraphItem[] = [];
	for (const paragraph of paragraphs) {
		for (const item of paragraph.items) {
			if (item.kind === 'tab' || item.kind === 'break') {
				regions.push(current);
				current = [];
			} else if (itemText(item) !== undefined) {
				current.push(item);
			}
		}
		regions.push(current);
		current = [];
	}
	return regions;
}

function desiredRegions(text: string): string[] {
	return text.split(/[\t\n]/u);
}

function reconcileRegion(items: PptxSmartArtTextParagraphItem[], desired: string): void {
	if (items.length === 0) {
		return;
	}
	const texts = items.map((item) => itemText(item) ?? '');
	const before = texts.join('');
	if (before === desired) {
		return;
	}
	const { prefix, suffix } = commonEdges(before, desired);
	const removeStart = prefix;
	const removeEnd = before.length - suffix;
	const insertion = desired.slice(prefix, desired.length - suffix);
	let offset = 0;
	const affected: Array<{ index: number; start: number; end: number; removed: number }> = [];
	for (let index = 0; index < texts.length; index++) {
		const start = offset;
		const end = start + texts[index].length;
		const localStart = Math.max(0, removeStart - start);
		const localEnd = Math.min(texts[index].length, removeEnd - start);
		if (localEnd > localStart) {
			affected.push({ index, start: localStart, end: localEnd, removed: localEnd - localStart });
		}
		offset = end;
	}
	if (affected.length === 0) {
		let owner = 0;
		let cursor = 0;
		for (let index = 0; index < texts.length; index++) {
			if (removeStart <= cursor + texts[index].length) {
				owner = index;
				break;
			}
			cursor += texts[index].length;
		}
		affected.push({
			index: owner,
			start: removeStart - cursor,
			end: removeStart - cursor,
			removed: 0,
		});
	}
	let insertionOffset = 0;
	for (let affectedIndex = 0; affectedIndex < affected.length; affectedIndex++) {
		const entry = affected[affectedIndex];
		const isLast = affectedIndex === affected.length - 1;
		const take = isLast
			? insertion.length - insertionOffset
			: Math.min(entry.removed, insertion.length - insertionOffset);
		const allocated = insertion.slice(insertionOffset, insertionOffset + Math.max(0, take));
		insertionOffset += Math.max(0, take);
		const original = texts[entry.index];
		setItemText(
			items[entry.index],
			original.slice(0, entry.start) + allocated + original.slice(entry.end),
		);
	}
}

function reconcileWithoutStructuralChange(
	paragraphs: PptxSmartArtTextParagraph[],
	desired: string,
): void {
	const regions = textRegions(paragraphs);
	const targets = desiredRegions(desired);
	for (let index = 0; index < regions.length; index++) {
		reconcileRegion(regions[index], targets[index] ?? '');
	}
}

type Atom =
	| { kind: 'text'; paragraph: number; item: number; character: number }
	| { kind: 'item'; paragraph: number; item: number }
	| { kind: 'paragraph'; paragraph: number };

function atoms(paragraphs: PptxSmartArtTextParagraph[]): Atom[] {
	const result: Atom[] = [];
	for (let paragraph = 0; paragraph < paragraphs.length; paragraph++) {
		for (let item = 0; item < paragraphs[paragraph].items.length; item++) {
			const entry = paragraphs[paragraph].items[item];
			const text = itemText(entry);
			if (text !== undefined) {
				for (let character = 0; character < text.length; character++) {
					result.push({ kind: 'text', paragraph, item, character });
				}
			} else if (entry.kind === 'tab' || entry.kind === 'break') {
				result.push({ kind: 'item', paragraph, item });
			}
		}
		if (paragraph < paragraphs.length - 1) {
			result.push({ kind: 'paragraph', paragraph });
		}
	}
	return result;
}

function removeRange(paragraphs: PptxSmartArtTextParagraph[], start: number, end: number): void {
	const selected = atoms(paragraphs).slice(start, end);
	for (const atom of selected.reverse()) {
		if (atom.kind === 'text') {
			const item = paragraphs[atom.paragraph]?.items[atom.item];
			const text = item ? itemText(item) : undefined;
			if (item && text !== undefined) {
				setItemText(item, text.slice(0, atom.character) + text.slice(atom.character + 1));
			}
		} else if (atom.kind === 'item') {
			paragraphs[atom.paragraph]?.items.splice(atom.item, 1);
		} else {
			const left = paragraphs[atom.paragraph];
			const right = paragraphs[atom.paragraph + 1];
			if (left && right) {
				left.items.push(...right.items);
				left.endParaRPr = right.endParaRPr ?? left.endParaRPr;
				paragraphs.splice(atom.paragraph + 1, 1);
			}
		}
	}
}

function textTemplate(paragraph: PptxSmartArtTextParagraph): PptxSmartArtTextParagraphItem {
	const existing = paragraph.items.find((item) => itemText(item) !== undefined);
	return existing ? clone(existing) : { kind: 'run', run: { text: '' } };
}

function insertAt(paragraphs: PptxSmartArtTextParagraph[], offset: number, value: string): void {
	const location = atoms(paragraphs)[offset - 1];
	let paragraphIndex = location?.paragraph ?? 0;
	let itemIndex =
		location?.kind === 'paragraph'
			? paragraphs[paragraphIndex].items.length
			: (location?.item ?? -1);
	let textOffset = location?.kind === 'text' ? location.character + 1 : undefined;
	for (const part of value.split(/([\t\n])/u).filter((segment) => segment.length > 0)) {
		const paragraph = (paragraphs[paragraphIndex] ??= { items: [] });
		let splitRight: PptxSmartArtTextParagraphItem | undefined;
		if ((part === '\t' || part === '\n') && textOffset !== undefined) {
			const item = paragraph.items[itemIndex];
			const text = item ? itemText(item) : undefined;
			if (item && text !== undefined && textOffset > 0 && textOffset < text.length) {
				splitRight = clone(item);
				setItemText(item, text.slice(0, textOffset));
				setItemText(splitRight, text.slice(textOffset));
				paragraph.items.splice(itemIndex + 1, 0, splitRight);
			}
		}
		if (part === '\t') {
			paragraph.items.splice(++itemIndex, 0, { kind: 'tab' });
			if (splitRight) {
				itemIndex++;
				textOffset = 0;
			} else {
				textOffset = undefined;
			}
		} else if (part === '\n') {
			const rightItems = paragraph.items.splice(itemIndex + 1);
			const next = clone(paragraph);
			next.items = rightItems;
			paragraphs.splice(paragraphIndex + 1, 0, next);
			paragraphIndex++;
			itemIndex = -1;
			textOffset = undefined;
		} else {
			let item = paragraph.items[itemIndex];
			if (!item || itemText(item) === undefined) {
				item = textTemplate(paragraph);
				setItemText(item, '');
				paragraph.items.splice(++itemIndex, 0, item);
			}
			const text = itemText(item) ?? '';
			const insertionPoint = textOffset ?? text.length;
			setItemText(item, text.slice(0, insertionPoint) + part + text.slice(insertionPoint));
			textOffset = insertionPoint + part.length;
		}
	}
}

/** Reconcile legacy flat text into the typed paragraph structure. */
export function reconcileSmartArtTextParagraphs(
	paragraphs: PptxSmartArtTextParagraph[],
	desired: string,
): PptxSmartArtTextParagraph[] {
	const result = clone(paragraphs);
	const before = smartArtParagraphsText(result);
	if (before === desired) {
		return result;
	}
	if (separators(before) === separators(desired)) {
		reconcileWithoutStructuralChange(result, desired);
		return result;
	}
	const { prefix, suffix } = commonEdges(before, desired);
	removeRange(result, prefix, before.length - suffix);
	insertAt(result, prefix, desired.slice(prefix, desired.length - suffix));
	return result.length > 0 ? result : [{ items: [] }];
}
