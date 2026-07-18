/**
 * Minimal regex tokenizer for the landing page's code cards. Escapes HTML,
 * then wraps comments (.c), strings (.s), tag names (.t), and keywords (.k)
 * in spans. Not a real parser; the landing samples are written to stay
 * inside what it handles (no template literals, no block comments).
 */

const KEYWORDS = [
	'import',
	'from',
	'export',
	'const',
	'let',
	'function',
	'return',
	'await',
	'async',
	'new',
	'if',
	'else',
	'for',
	'of',
	'class',
	'extends',
	'readonly',
	'null',
	'true',
	'false',
	'this',
].join('|');

const TOKEN = new RegExp(
	// comment | 'string' | "string" | escaped tag open | keyword
	`(\\/\\/[^\\n]*)|('(?:[^'\\\\\\n]|\\\\.)*')|("(?:[^"\\\\\\n]|\\\\.)*")|(&lt;\\/?[A-Za-z][\\w.-]*)|(\\b(?:${KEYWORDS})\\b)`,
	'g',
);

export function highlight(source: string): string {
	const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return escaped.replace(TOKEN, (match, comment, single, double, tag, keyword) => {
		if (comment) {
			return `<span class="c">${comment}</span>`;
		}
		if (single || double) {
			return `<span class="s">${match}</span>`;
		}
		if (tag) {
			return `<span class="t">${tag}</span>`;
		}
		if (keyword) {
			return `<span class="k">${keyword}</span>`;
		}
		return match;
	});
}
