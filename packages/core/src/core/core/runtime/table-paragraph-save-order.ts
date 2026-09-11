import type { PptxTableCellTextRun, XmlObject } from '../../types';
import { xmlText } from '../../utils';
import { assignOrderedXmlChildren, setOwnXmlProperty } from './ordered-xml-children';
import { paragraphContentEntries } from './paragraph-sibling-order';
import { ensureItems, isGroupedByTag, isXmlObject } from './xml-child-scan';

const CONTENT_TAGS = new Set(['a:r', 'a:br', 'a:fld']);
const paragraphOrders = new WeakMap<XmlObject, readonly string[]>();

function runTag(run: PptxTableCellTextRun): string {
	return run.isLineBreak ? 'a:br' : run.isField ? 'a:fld' : 'a:r';
}

/** Do not infer positions for content the table run model cannot represent. */
function supportsOrder(paragraph: XmlObject, tags: readonly string[]): boolean {
	for (const [key, value] of Object.entries(paragraph)) {
		if (key.startsWith('@_') || key === 'a:pPr' || key === 'a:endParaRPr') {
			continue;
		}
		if (key === '#text' && String(value).trim() === '') {
			continue;
		}
		if (!CONTENT_TAGS.has(key)) {
			return false;
		}
	}
	return [...CONTENT_TAGS].every(
		(tag) =>
			tags.filter((candidate) => candidate === tag).length === ensureItems(paragraph[tag]).length,
	);
}

function matchesParagraph(paragraph: XmlObject, runs: readonly PptxTableCellTextRun[]): boolean {
	if (!supportsOrder(paragraph, runs.map(runTag))) {
		return false;
	}
	const consumed = new Map<string, number>();
	for (const run of runs) {
		const tag = runTag(run);
		const index = consumed.get(tag) ?? 0;
		const node = ensureItems(paragraph[tag])[index];
		if (node === undefined) {
			return false;
		}
		if (tag !== 'a:br' && (!isXmlObject(node) || (xmlText(node['a:t']) ?? '') !== run.text)) {
			return false;
		}
		consumed.set(tag, index + 1);
	}
	return true;
}

/**
 * #68 keeps an unedited cell's rich XML, but the parser grouped its children
 * by tag. The ordered run model supplies the missing sequence, including when
 * rawXml was cloned and no longer carries the load-time WeakMap annotation.
 * Register only exact matches after text/style updates; never rebuild content
 * from this display model or apply stale runs to a genuinely edited cell.
 */
export function recordTableParagraphOrder(
	xmlCell: XmlObject,
	textRuns: readonly PptxTableCellTextRun[] | undefined,
): void {
	const txBody = xmlCell['a:txBody'];
	const paragraphs = isXmlObject(txBody) ? ensureItems(txBody['a:p']) : [];
	for (const paragraph of paragraphs) {
		if (isXmlObject(paragraph)) {
			paragraphOrders.delete(paragraph);
		}
	}
	if (!textRuns) {
		return;
	}
	const runsByParagraph: PptxTableCellTextRun[][] = [[]];
	for (const run of textRuns) {
		if (run.isParagraphBreak) {
			runsByParagraph.push([]);
		} else {
			runsByParagraph.at(-1)!.push(run);
		}
	}
	if (runsByParagraph.length !== paragraphs.length) {
		return;
	}
	paragraphs.forEach((paragraph, index) => {
		const runs = runsByParagraph[index];
		const tags = runs.map(runTag);
		if (isXmlObject(paragraph) && !isGroupedByTag(tags) && matchesParagraph(paragraph, runs)) {
			paragraphOrders.set(paragraph, tags);
		}
	});
}

function orderedParagraph(paragraph: XmlObject, tags: readonly string[]): XmlObject {
	const result: XmlObject = {};
	for (const [key, value] of Object.entries(paragraph)) {
		if (!CONTENT_TAGS.has(key) && key !== 'a:pPr' && key !== 'a:endParaRPr') {
			setOwnXmlProperty(result, key, value);
		}
	}
	if (paragraph['a:pPr'] !== undefined) {
		result['a:pPr'] = paragraph['a:pPr'];
	}
	const consumed = new Map<string, number>();
	assignOrderedXmlChildren(
		result,
		tags.map((tag) => {
			const index = consumed.get(tag) ?? 0;
			consumed.set(tag, index + 1);
			return { tag, node: ensureItems(paragraph[tag])[index] };
		}),
	);
	if (paragraph['a:endParaRPr'] !== undefined) {
		result['a:endParaRPr'] = paragraph['a:endParaRPr'];
	}
	return result;
}

/**
 * Copy only paragraphs with a recorded order and their ancestor spine at the
 * slide/template serialization boundary. Marker keys must never reach cached
 * rawXml: tag-keyed readers and the next save still need every plain a:r.
 */
export function withOrderedTableParagraphs<T>(value: T, insideTable = false): T {
	if (Array.isArray(value)) {
		let result: unknown[] = value;
		value.forEach((item, index) => {
			const next = withOrderedTableParagraphs(item, insideTable);
			if (next !== item) {
				if (result === value) {
					result = [...value];
				}
				result[index] = next;
			}
		});
		return result as T;
	}
	if (!isXmlObject(value)) {
		return value;
	}
	let result: XmlObject = value;
	for (const [key, item] of Object.entries(value)) {
		if (key.startsWith('@_') || key === '#text') {
			continue;
		}
		const next = withOrderedTableParagraphs(item, insideTable || key === 'a:tbl');
		if (next !== item) {
			if (result === value) {
				result = { ...value };
			}
			setOwnXmlProperty(result, key, next);
		}
	}
	let tags = paragraphOrders.get(value);
	if (!tags && insideTable) {
		// Untouched template tables may be flushed from a separately parsed
		// cached part without visiting the element writer. That actual parsed
		// paragraph already carries its source order, unlike a rawXml clone.
		const { entries, authored } = paragraphContentEntries(value, CONTENT_TAGS);
		const sourceTags = entries.map(([tag]) => tag);
		if (authored && supportsOrder(value, sourceTags)) {
			tags = sourceTags;
		}
	}
	return (tags ? orderedParagraph(result, tags) : result) as T;
}
