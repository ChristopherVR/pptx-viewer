import type { XmlObject } from '../types';

/**
 * Run-preserving text edits for a modern (`p188`) comment body.
 *
 * Replacing the whole `p188:txBody` with a freshly built one-run-per-line body
 * throws away everything the model does not carry: run properties, hyperlinks,
 * and the run boundaries an `@`-mention is indexed against. Almost every edit
 * is a small text change, so the paragraphs are spliced in place instead:
 * unchanged lines are re-emitted verbatim, and a changed line keeps its runs
 * with only the differing middle rewritten.
 *
 * Mention metadata (`p188:mentionLst`) IS modelled, in
 * `modern-comment-mentions.ts`: this module keeps the runs an offset points
 * into stable, and the serializer re-bases the offsets themselves.
 */

const localName = (key: string): string => key.split(':').pop() || key;

const keyOf = (node: XmlObject, name: string): string | undefined =>
	Object.keys(node).find((key) => localName(key) === name);

const asNodes = (value: XmlObject[keyof XmlObject]): XmlObject[] => {
	if (Array.isArray(value)) {
		return value;
	}
	return value && typeof value === 'object' ? [value] : [];
};

const runText = (run: XmlObject): string | undefined => {
	const textKey = keyOf(run, 't');
	if (!textKey) {
		return undefined;
	}
	const value = run[textKey];
	return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
};

/** Every `a:t` value below a node, in key order: the flattened plain text. */
export function flattenBodyText(node: XmlObject | undefined): string[] {
	if (!node) {
		return [];
	}
	const paragraphKey = keyOf(node, 'p');
	const paragraphs = paragraphKey ? asNodes(node[paragraphKey]) : [];
	const collect = (value: XmlObject[keyof XmlObject]): string => {
		if (typeof value === 'string' || typeof value === 'number') {
			return String(value);
		}
		let text = '';
		for (const entry of asNodes(value)) {
			for (const [key, child] of Object.entries(entry)) {
				if (!key.startsWith('@_')) {
					text += collect(child);
				}
			}
		}
		return text;
	};
	return (paragraphs.length > 0 ? paragraphs : [node]).map((paragraph) => collect(paragraph));
}

const commonPrefixLength = (a: string, b: string): number => {
	const max = Math.min(a.length, b.length);
	let index = 0;
	while (index < max && a[index] === b[index]) {
		index += 1;
	}
	return index;
};

const commonSuffixLength = (a: string, b: string, limit: number): number => {
	let index = 0;
	while (index < limit && a[a.length - 1 - index] === b[b.length - 1 - index]) {
		index += 1;
	}
	return index;
};

const bareRun = (template: XmlObject | undefined, text: string): XmlObject => {
	const properties = template ? keyOf(template, 'rPr') : undefined;
	return {
		'a:rPr': properties && template ? (template[properties] as XmlObject) : {},
		'a:t': text,
	};
};

const flattenRuns = (paragraph: XmlObject): string => {
	const runKey = keyOf(paragraph, 'r');
	const runs = runKey ? asNodes(paragraph[runKey]) : [];
	return runs.map((run) => runText(run) ?? '').join('');
};

/**
 * Rewrite one paragraph's runs so their concatenated text becomes `line`,
 * keeping the leading/trailing runs that the edit did not touch. Returns
 * `undefined` when the paragraph carries text this splice cannot address
 * (fields, breaks), leaving the caller to fall back to a plain rebuild.
 */
function spliceParagraph(paragraph: XmlObject, line: string): XmlObject | undefined {
	const runKey = keyOf(paragraph, 'r');
	const runs = runKey ? asNodes(paragraph[runKey]) : [];
	const texts = runs.map(runText);
	if (texts.some((text) => text === undefined)) {
		return undefined;
	}
	const known = texts as string[];
	const original = known.join('');
	if (original === line) {
		return paragraph;
	}
	if (runs.length === 0) {
		return { ...paragraph, 'a:r': bareRun(undefined, line) };
	}

	const prefix = commonPrefixLength(original, line);
	const suffix = commonSuffixLength(
		original,
		line,
		Math.min(original.length, line.length) - prefix,
	);
	const middle = line.slice(prefix, line.length - suffix);
	const removedEnd = original.length - suffix;

	const rebuilt: XmlObject[] = [];
	let cursor = 0;
	let middleInserted = false;
	for (let index = 0; index < runs.length; index += 1) {
		const text = known[index];
		const start = cursor;
		const end = cursor + text.length;
		cursor = end;
		const head = text.slice(0, Math.max(0, Math.min(text.length, prefix - start)));
		const tail = text.slice(Math.max(0, Math.min(text.length, removedEnd - start)));
		let next = head + tail;
		if (!middleInserted && (prefix <= end || index === runs.length - 1)) {
			next = head + middle + tail;
			middleInserted = true;
		}
		if (next.length === 0) {
			continue;
		}
		const textKey = keyOf(runs[index], 't') ?? 'a:t';
		const nextRun: XmlObject = { ...runs[index] };
		nextRun[textKey] = next;
		rebuilt.push(nextRun);
	}
	if (rebuilt.length === 0) {
		rebuilt.push(bareRun(runs[0], line));
	}
	const result: XmlObject = { ...paragraph };
	result[runKey ?? 'a:r'] = rebuilt.length === 1 ? rebuilt[0] : rebuilt;
	return result;
}

const plainParagraph = (template: XmlObject | undefined, line: string): XmlObject => {
	const runKey = template ? keyOf(template, 'r') : undefined;
	const templateRun = template && runKey ? asNodes(template[runKey])[0] : undefined;
	return { 'a:r': bareRun(templateRun, line) };
};

const plainBody = (text: string): XmlObject => ({
	'a:bodyPr': {},
	'a:lstStyle': {},
	'a:p': String(text)
		.split('\n')
		.map((line) => ({ 'a:r': { 'a:rPr': {}, 'a:t': line } })),
});

/**
 * Produce the `txBody` for a modern comment whose plain text is `text`,
 * reusing `original` wherever the edit did not reach it.
 */
export function applyModernCommentText(original: XmlObject | undefined, text: string): XmlObject {
	if (!original) {
		return plainBody(text);
	}
	const paragraphKey = keyOf(original, 'p');
	const paragraphs = paragraphKey ? asNodes(original[paragraphKey]) : [];
	if (paragraphs.length === 0) {
		return plainBody(text);
	}
	const originalLines = flattenBodyText(original);
	if (originalLines.join('\n') === text) {
		return original;
	}

	const lines = String(text).split('\n');
	const rebuilt: XmlObject[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const source = paragraphs[index];
		if (!source) {
			rebuilt.push(plainParagraph(paragraphs[paragraphs.length - 1], lines[index]));
			continue;
		}
		// A paragraph whose runs do not account for all of its text (fields,
		// breaks) cannot be spliced safely; rebuild just that line.
		const spliced =
			originalLines[index] === flattenRuns(source)
				? spliceParagraph(source, lines[index])
				: undefined;
		rebuilt.push(spliced ?? plainParagraph(source, lines[index]));
	}

	const result: XmlObject = { ...original };
	result[paragraphKey ?? 'a:p'] = rebuilt.length === 1 ? rebuilt[0] : rebuilt;
	return result;
}
