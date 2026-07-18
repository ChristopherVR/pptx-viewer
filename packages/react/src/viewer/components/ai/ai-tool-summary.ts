/**
 * Pure formatting helpers that turn a tool name + raw JSON args into a short,
 * human-readable summary line for the tool-call cards (e.g.
 * `update_text` -> "Update text"; `{ slideIndex: 2 }` -> "slide 3").
 */

/** Turn a snake_case tool name into a Title Case label. */
export function toolLabel(toolName: string): string {
	if (!toolName) {
		return 'Tool';
	}
	const words = toolName.replace(/[_-]+/gu, ' ').trim().split(/\s+/u);
	return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'string') {
		return value.length > 32 ? `"${value.slice(0, 32)}..."` : `"${value}"`;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (Array.isArray(value)) {
		return `[${value.length}]`;
	}
	return '{...}';
}

/** A compact `key: value` args summary, at most a few fields. */
export function summarizeToolArgs(input: unknown): string {
	if (input === null || typeof input !== 'object') {
		return '';
	}
	const entries = Object.entries(input as Record<string, unknown>).filter(
		([, v]) => v !== undefined && v !== null && v !== '',
	);
	if (entries.length === 0) {
		return '';
	}
	const parts: string[] = [];
	for (const [key, value] of entries.slice(0, 4)) {
		// Present zero-based slide/element indexes as human 1-based slide numbers.
		if (key === 'slideIndex' && typeof value === 'number') {
			parts.push(`slide ${value + 1}`);
			continue;
		}
		parts.push(`${key}: ${formatValue(value)}`);
	}
	if (entries.length > 4) {
		parts.push('...');
	}
	return parts.join(', ');
}
