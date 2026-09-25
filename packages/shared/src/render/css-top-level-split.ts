/**
 * `css-top-level-split` - split a CSS value at separators that sit outside any
 * parentheses. An `animation` shorthand's easing can be `cubic-bezier(0.2, 0,
 * 0.4, 1)` or `linear(0, 0.1 25%, 1)`, whose nested commas and spaces a plain
 * `split(',')` or `split(/\s+/)` would tear apart.
 *
 * @module render/css-top-level-split
 */

function splitTopLevel(value: string, isSeparator: (character: string) => boolean): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character === '(') {
			depth += 1;
		} else if (character === ')') {
			depth = Math.max(0, depth - 1);
		} else if (depth === 0 && isSeparator(character)) {
			parts.push(value.slice(start, index).trim());
			start = index + 1;
		}
	}
	parts.push(value.slice(start).trim());
	return parts.filter((part) => part.length > 0);
}

/** Split a comma-separated CSS list (e.g. `animation` tracks) at top level. */
export function splitCssList(value: string): string[] {
	return splitTopLevel(value, (character) => character === ',');
}

/** Split one CSS list item into its whitespace-separated top-level tokens. */
export function splitCssTokens(value: string): string[] {
	return splitTopLevel(value, (character) => /\s/u.test(character));
}
