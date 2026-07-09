/**
 * Internal helpers for the template engine.
 *
 * Handles placeholder resolution, conditional evaluation, and token
 * replacement in single strings. Cross-segment replacement, element
 * traversal, and placeholder extraction live in
 * `template-engine-segments.ts`.
 *
 * @module sdk/template-engine-helpers
 */

import type { TemplateData } from './template-engine-types';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Matches `{{...}}` tokens, including block tags.
 *
 * The content class deliberately excludes `{` (not just `}`): allowing a
 * bare `[^}]+` here lets the greedy match re-scan an unbounded number of
 * characters from every `{{` start position in strings full of unmatched
 * braces (e.g. `"{{{{{{{{"`), which is quadratic in input length. Since no
 * legitimate placeholder key or block tag ever contains a literal `{`,
 * excluding it makes a failed match fail immediately instead of
 * backtracking, keeping the scan linear.
 */
export const PLACEHOLDER_RE = /\{\{([^{}]+)\}\}/g;

/** Matches an `{{#each <key>}}` opening tag. */
export const EACH_OPEN_RE = /^\s*#each\s+([\w.]+)\s*$/;

/** Matches `{{/each}}`. */
export const EACH_CLOSE_RE = /^\s*\/each\s*$/;

/** Matches an `{{#if <key>}}` opening tag. */
export const IF_OPEN_RE = /^\s*#if\s+(!?[\w.]+)\s*$/;

/** Matches `{{/if}}`. */
export const IF_CLOSE_RE = /^\s*\/if\s*$/;

// ---------------------------------------------------------------------------
// Path resolution & condition evaluation
// ---------------------------------------------------------------------------

/**
 * Resolve a dot-notation path against a data object.
 *
 * @example
 * ```ts
 * resolvePath({ company: { name: "Acme" } }, "company.name");
 * // => "Acme"
 * ```
 */
export function resolvePath(
	data: TemplateData,
	path: string,
): string | number | boolean | TemplateData | TemplateData[] | undefined {
	const parts = path.trim().split('.');
	let current: unknown = data;
	for (const part of parts) {
		if (current === null || typeof current !== 'object') {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}
	return current as string | number | boolean | TemplateData | TemplateData[] | undefined;
}

/**
 * Evaluate a condition key as a truthy/falsy value.
 *
 * Supports negation with a leading `!` (e.g. `{{#if !showChart}}`).
 */
export function evaluateCondition(data: TemplateData, key: string): boolean {
	const negate = key.startsWith('!');
	const actualKey = negate ? key.slice(1).trim() : key.trim();
	const value = resolvePath(data, actualKey);
	const truthy = isTruthy(value);
	return negate ? !truthy : truthy;
}

/**
 * Determine if a resolved value is "truthy" for conditional purposes.
 */
export function isTruthy(
	value: string | number | boolean | TemplateData | TemplateData[] | undefined,
): boolean {
	if (value === undefined || value === null) {
		return false;
	}
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'number') {
		return value !== 0;
	}
	if (typeof value === 'string') {
		return value.length > 0;
	}
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	// Non-null object is truthy
	return true;
}

// ---------------------------------------------------------------------------
// String-level token replacement
// ---------------------------------------------------------------------------

/**
 * Replace `{{placeholder}}` tokens in a single string, including
 * conditional `{{#if}}...{{/if}}` blocks (inline only -- not cross-segment).
 */
export function replaceTokensInString(text: string, data: TemplateData): string {
	// First, process inline conditional blocks: {{#if key}}content{{/if}}
	let result = processInlineConditionals(text, data);

	// Then, replace simple/nested placeholders
	result = result.replace(PLACEHOLDER_RE, (_match, key: string) => {
		const trimmed = key.trim();
		// Skip block tags that weren't consumed by conditional processing
		if (
			EACH_OPEN_RE.test(trimmed) ||
			EACH_CLOSE_RE.test(trimmed) ||
			IF_OPEN_RE.test(trimmed) ||
			IF_CLOSE_RE.test(trimmed)
		) {
			return _match;
		}
		const value = resolvePath(data, trimmed);
		if (value === undefined) {
			return _match;
		} // leave unresolved placeholders
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		// Objects/arrays can't be directly substituted into text
		return _match;
	});

	return result;
}

/**
 * Process inline `{{#if key}}...{{/if}}` blocks within a single string.
 * Supports nesting.
 */
export function processInlineConditionals(text: string, data: TemplateData): string {
	// Iteratively resolve innermost {{#if}}...{{/if}} blocks
	let result = text;
	let safety = 0;
	const MAX_ITERATIONS = 100;

	while (safety++ < MAX_ITERATIONS) {
		// Find the innermost {{#if ...}}...{{/if}} block (no nested #if inside).
		// The condition key is matched with the same restricted `!?[\w.]+`
		// class as IF_OPEN_RE, not a generic `[^}]+`, because `[^}]+` overlaps
		// with the preceding `\s+`: whitespace matches both classes, so the
		// engine can split "#if   key" between them in many different ways
		// before giving up on an unclosed tag, which is quadratic on inputs
		// like `"{{#if " + " ".repeat(n)`. Restricting the key class to
		// non-whitespace identifier characters removes that overlap entirely.
		const ifOpenPattern =
			/\{\{\s*#if\s+(!?[\w.]+)\s*\}\}((?:(?!\{\{\s*#if\s)(?!\{\{\s*\/if\s*\}\}).)*?)\{\{\s*\/if\s*\}\}/s;
		const match = ifOpenPattern.exec(result);
		if (!match) {
			break;
		}

		const conditionKey = match[1].trim();
		const blockContent = match[2];
		const show = evaluateCondition(data, conditionKey);

		result =
			result.slice(0, match.index) +
			(show ? blockContent : '') +
			result.slice(match.index + match[0].length);
	}

	return result;
}
