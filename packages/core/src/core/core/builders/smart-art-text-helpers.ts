import type { XmlObject } from '../../types';

/**
 * Maximum number of SmartArt content nodes parsed from a single diagram.
 *
 * PowerPoint diagrams are practically bounded well below this; the cap exists
 * only as a guard against pathological / hostile input (a data model with
 * millions of synthetic points) rather than to truncate real presentations.
 * Raised from the historical value of 50, which silently dropped nodes from
 * large but legitimate org charts and process flows.
 */
export const MAX_SMARTART_NODES = 2000;

/**
 * Extract text content from a SmartArt point node.
 * Traverses the `dgm:t` element and collects text from all `a:t` elements
 * within the paragraph structure (`a:p` / `a:r` / `a:t`).
 */
export function extractTextFromPoint(point: XmlObject): string | undefined {
	const textValues: string[] = [];
	collectLocalTextValues(point, 't', textValues);
	const resolvedText = textValues.join('');
	return resolvedText.trim().length > 0 ? resolvedText.trim() : undefined;
}

/**
 * Iteratively collect text values from XML objects in document order.
 * Searches for elements with local name `targetName` and extracts
 * text from nested `a:t` elements.
 */
export function collectLocalTextValues(obj: unknown, targetName: string, out: string[]): void {
	const stack: Array<{ key?: string; value: unknown }> = [{ value: obj }];
	let visited = 0;
	while (stack.length > 0 && visited++ < 1_000_000) {
		const current = stack.pop()!;
		if (current.key && getLocalName(current.key) === targetName) {
			if (typeof current.value === 'string' || typeof current.value === 'number') {
				out.push(String(current.value));
				continue;
			}
		}
		if (Array.isArray(current.value)) {
			for (let index = current.value.length - 1; index >= 0; index--) {
				stack.push({ key: current.key, value: current.value[index] });
			}
		} else if (current.value && typeof current.value === 'object') {
			const entries = Object.entries(current.value as XmlObject);
			for (let index = entries.length - 1; index >= 0; index--) {
				stack.push({ key: entries[index][0], value: entries[index][1] });
			}
		}
	}
}

/**
 * Extract text from a paragraph structure.
 * Handles DrawingML text structure: `a:p` / `a:r` / `a:t`
 */
export function extractParagraphText(paragraph: XmlObject | undefined, out: string[]): void {
	if (!paragraph || typeof paragraph !== 'object') {
		return;
	}

	// Handle array of paragraphs
	if (Array.isArray(paragraph)) {
		for (const p of paragraph) {
			extractParagraphText(p, out);
		}
		return;
	}

	// Look for `a:p` elements
	const pList = paragraph['a:p'];
	if (pList) {
		extractParagraphText(pList as XmlObject, out);
		return;
	}

	// Look for `a:r` elements
	const runs = paragraph['a:r'];
	if (runs) {
		if (Array.isArray(runs)) {
			for (const run of runs) {
				const textNode = (run as XmlObject)['a:t'];
				if (textNode) {
					out.push(String(textNode));
				}
			}
		} else {
			const textNode = (runs as XmlObject)['a:t'];
			if (textNode) {
				out.push(String(textNode));
			}
		}
	}
}

/**
 * Extract local name from qualified XML tag name.
 * Converts "dgm:pt" → "pt", "a:p" → "p", etc.
 */
export function getLocalName(qualifiedName: string): string {
	const colonIndex = qualifiedName.indexOf(':');
	return colonIndex >= 0 ? qualifiedName.slice(colonIndex + 1) : qualifiedName;
}
