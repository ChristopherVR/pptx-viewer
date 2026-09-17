import type { DeltaOp } from './collaboration-text-codec';
import { commonPrefixLength, commonSuffixLength } from './collaboration-text-merge';

export interface TextSessionUnit {
	text: string;
	attributes: Record<string, string>;
}

/** Browser edit range mapped to the editor's pre-input encoded coordinates. */
export interface LocalTextReplacement {
	from: number;
	to: number;
}

/** Desired UTF-16 units mapped to the editor's previously observed identities. */
export interface TextSessionCorrespondence {
	readonly retainedIndices: readonly (number | null)[];
	/** Old carriers for known paragraph attributes, independently of character identity. */
	readonly paragraphSources?: readonly (number | null)[];
}

export type LocalTextEdit = LocalTextReplacement | TextSessionCorrespondence;

const textBoundary = (text: string, index: number): boolean =>
	!(
		text.charCodeAt(index - 1) >= 0xd800 &&
		text.charCodeAt(index - 1) <= 0xdbff &&
		text.charCodeAt(index) >= 0xdc00 &&
		text.charCodeAt(index) <= 0xdfff
	);

/** A range disambiguates repeated text; reject a draft that changed outside it. */
export function textSessionReplacementSpan(
	before: string,
	after: string,
	{ from, to }: LocalTextReplacement,
): { prefix: number; suffix: number } | undefined {
	const suffix = before.length - to;
	const afterEnd = after.length - suffix;
	return Number.isInteger(from) &&
		Number.isInteger(to) &&
		from >= 0 &&
		to >= from &&
		to <= before.length &&
		afterEnd >= from &&
		before.slice(0, from) === after.slice(0, from) &&
		before.slice(to) === after.slice(afterEnd) &&
		textBoundary(before, from) &&
		textBoundary(before, to) &&
		textBoundary(after, from) &&
		textBoundary(after, afterEnd)
		? { prefix: from, suffix }
		: undefined;
}

/** Validate all identities before writes; null units are explicit new insertions. */
export function textSessionRetainedIndices(
	before: string,
	after: string,
	edit?: LocalTextEdit,
): (number | null)[] | undefined {
	let indices: (number | null)[];
	if (edit && 'retainedIndices' in edit) {
		indices = Array.from(edit.retainedIndices);
	} else {
		const explicit = edit && textSessionReplacementSpan(before, after, edit);
		if (edit && !explicit) {
			return undefined;
		}
		const prefix = explicit?.prefix ?? commonPrefixLength(before, after);
		const suffix = explicit?.suffix ?? commonSuffixLength(before, after, prefix);
		indices = Array.from({ length: after.length }, (_, index) =>
			index < prefix
				? index
				: index >= after.length - suffix
					? before.length - (after.length - index)
					: null,
		);
	}
	if (indices.length !== after.length) {
		return undefined;
	}
	let last = -1;
	for (const [index, retained] of indices.entries()) {
		if (retained === null) {
			continue;
		}
		if (
			!Number.isInteger(retained) ||
			retained <= last ||
			retained >= before.length ||
			before[retained] !== after[index] ||
			((!textBoundary(before, retained) || !textBoundary(after, index)) &&
				indices[index - 1] !== retained - 1) ||
			((!textBoundary(before, retained + 1) || !textBoundary(after, index + 1)) &&
				indices[index + 1] !== retained + 1)
		) {
			return undefined;
		}
		last = retained;
	}
	return indices;
}

/** Copy and validate optional carrier provenance before entering a transaction. */
export function textSessionPlan(
	before: string,
	after: string,
	edit?: LocalTextEdit,
): TextSessionCorrespondence | undefined {
	const retainedIndices = textSessionRetainedIndices(before, after, edit);
	if (!retainedIndices) {
		return undefined;
	}
	const sources = edit && 'retainedIndices' in edit ? edit.paragraphSources : undefined;
	if (sources === undefined) {
		return { retainedIndices };
	}
	const paragraphSources = Array.from(sources);
	if (
		paragraphSources.length !== after.length ||
		paragraphSources.some(
			(source) =>
				source !== null && (!Number.isInteger(source) || source < 0 || source >= before.length),
		)
	) {
		return undefined;
	}
	return { retainedIndices, paragraphSources };
}

export function textSessionAttributesEqual(
	a: Record<string, string>,
	b: Record<string, string>,
): boolean {
	return (
		Object.keys(a).length === Object.keys(b).length &&
		Object.keys(a).every((key) => a[key] === b[key])
	);
}

/** Encoded Y.Text coordinates, not native editor/body offsets. */
export function textSessionDeltaSupported(delta: readonly DeltaOp[]): boolean {
	return delta.every(
		(op) =>
			typeof op.insert === 'string' &&
			Object.values(op.attributes ?? {}).every((value) => typeof value === 'string'),
	);
}

/** Expand validated encoded runs into UTF-16 character identities. */
export function textSessionUnits(delta: readonly DeltaOp[]): TextSessionUnit[] | undefined {
	const units: TextSessionUnit[] = [];
	for (const op of delta) {
		if (typeof op.insert !== 'string') {
			return undefined;
		}
		const attributes: Record<string, string> = {};
		for (const [key, value] of Object.entries(op.attributes ?? {})) {
			if (typeof value !== 'string') {
				return undefined;
			}
			attributes[key] = value;
		}
		for (let index = 0; index < op.insert.length; index++) {
			units.push({ text: op.insert[index], attributes });
		}
	}
	return units;
}

/** Preserve remote keys when the local draft did not change them. */
export function textSessionAttributePatch(
	before: Record<string, string>,
	after: Record<string, string>,
	current: Record<string, string>,
): Record<string, string | null> {
	const patch: Record<string, string | null> = {};
	for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
		if (before[key] !== after[key]) {
			patch[key] =
				key === 's'
					? mergeTextSessionObjectAttribute(before[key], after[key], current[key])
					: (after[key] ?? null);
		}
	}
	return patch;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeObjectChanges(
	before: Record<string, unknown>,
	after: Record<string, unknown>,
	current: Record<string, unknown>,
): Record<string, unknown> {
	const merged = new Map(Object.entries(current));
	for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
		const oldValue = Object.hasOwn(before, key) ? before[key] : undefined;
		const nextValue = Object.hasOwn(after, key) ? after[key] : undefined;
		if (JSON.stringify(oldValue) === JSON.stringify(nextValue)) {
			continue;
		}
		const liveValue = merged.get(key);
		if (
			(oldValue === undefined || isObject(oldValue)) &&
			(nextValue === undefined || isObject(nextValue)) &&
			isObject(liveValue)
		) {
			const nested = mergeObjectChanges(oldValue ?? {}, nextValue ?? {}, liveValue);
			if (Object.keys(nested).length > 0) {
				merged.set(key, nested);
			} else {
				merged.delete(key);
			}
		} else if (nextValue === undefined) {
			merged.delete(key);
		} else {
			merged.set(key, nextValue);
		}
	}
	return Object.fromEntries(merged);
}

/** Codec JSON objects merge local property changes without overwriting peer keys. */
export function mergeTextSessionObjectAttribute(
	before: string | undefined,
	after: string | undefined,
	current: string | undefined,
): string | null {
	try {
		const oldValue: unknown = before ? JSON.parse(before) : {};
		const nextValue: unknown = after ? JSON.parse(after) : {};
		const liveValue: unknown = current ? JSON.parse(current) : {};
		if (isObject(oldValue) && isObject(nextValue) && isObject(liveValue)) {
			const merged = mergeObjectChanges(oldValue, nextValue, liveValue);
			return Object.keys(merged).length ? JSON.stringify(merged) : null;
		}
	} catch {
		/* Malformed legacy style attributes retain explicit replacement semantics. */
	}
	return after ?? null;
}
