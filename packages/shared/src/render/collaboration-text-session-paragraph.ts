import type { TextSessionUnit } from './collaboration-text-session-delta';
import { mergeTextSessionObjectAttribute } from './collaboration-text-session-delta';

const paragraphKeys = ['bi', 'pl', 'pr', 'pi', 'pp'] as const;
type ParagraphPatch = Record<string, string | null>;

/** A paragraph can outlive its first character, but not all its observed identities. */
function readParagraphAttributes(
	previous: readonly TextSessionUnit[],
	source: number,
	readCurrent: (source: number) => Record<string, string> | undefined,
): Record<string, string> {
	const carrier = readCurrent(source);
	if (carrier) return carrier;
	// A separator may itself carry an empty paragraph; it cannot borrow from its
	// neighbour after deletion. Other carriers can relocate onto surviving body.
	if (previous[source].attributes.pb === '1') return {};
	let start = source;
	while (start > 0 && previous[start - 1].attributes.pb !== '1') start--;
	for (
		let index = start;
		index < previous.length && previous[index].attributes.pb !== '1';
		index++
	) {
		const current = readCurrent(index);
		if (current) return current;
	}
	return {};
}

/** Read source identities before deletion; character/run attributes never relocate. */
export function textSessionParagraphPatches(
	previous: readonly TextSessionUnit[],
	desired: readonly TextSessionUnit[],
	sources: readonly (number | null)[] | undefined,
	readCurrent: (source: number) => Record<string, string> | undefined,
): Map<number, ParagraphPatch> {
	const patches = new Map<number, ParagraphPatch>();
	const cache = new Map<number, Map<Record<string, string>, ParagraphPatch>>();
	for (const [index, source] of (sources ?? []).entries()) {
		if (source === null) {
			continue;
		}
		const after = desired[index].attributes;
		let byAttributes = cache.get(source);
		if (!byAttributes) {
			byAttributes = new Map();
			cache.set(source, byAttributes);
		}
		let patch = byAttributes.get(after);
		if (!patch) {
			const before = previous[source].attributes;
			const current = readParagraphAttributes(previous, source, readCurrent);
			patch = {};
			for (const key of paragraphKeys) {
				patch[key] =
					before[key] === after[key]
						? (current[key] ?? null)
						: key === 'pl'
							? (after[key] ?? null)
							: mergeTextSessionObjectAttribute(before[key], after[key], current[key]);
			}
			byAttributes.set(after, patch);
		}
		patches.set(index, patch);
	}
	return patches;
}

export function textSessionInsertionAttributes(
	attributes: Record<string, string>,
	paragraph: ParagraphPatch | undefined,
): Record<string, string> {
	const result = { ...attributes };
	for (const [key, value] of Object.entries(paragraph ?? {})) {
		if (value === null) {
			delete result[key];
		} else {
			result[key] = value;
		}
	}
	return result;
}
