import type { YTextEditableLike } from './collaboration-text-merge';
import type { TextSessionPositions } from './collaboration-text-session';
import type { TextSessionUnit } from './collaboration-text-session-delta';
import {
	textSessionAttributePatch,
	textSessionAttributesEqual,
	textSessionUnits,
} from './collaboration-text-session-delta';
import {
	textSessionInsertionAttributes,
	textSessionParagraphPatches,
} from './collaboration-text-session-paragraph';

export interface ObservedTextSessionUnit<Position> extends TextSessionUnit {
	start: Position;
	end: Position;
}

/** Apply a validated identity plan inside the session's guarded transaction. */
export function applyTextSessionPlan<Position>(
	text: YTextEditableLike,
	positions: TextSessionPositions<Position>,
	previous: ObservedTextSessionUnit<Position>[],
	desired: TextSessionUnit[],
	indices: readonly (number | null)[],
	emptyBoundary: Position,
	paragraphSources?: readonly (number | null)[],
): ObservedTextSessionUnit<Position>[] | undefined {
	const range = (unit: ObservedTextSessionUnit<Position>) => {
		const start = positions.resolve(unit.start);
		const end = positions.resolve(unit.end);
		return start !== null && end !== null && end > start ? { start, end } : undefined;
	};
	const sourceUnits = paragraphSources && textSessionUnits(text.toDelta());
	if (paragraphSources && !sourceUnits) {
		return undefined;
	}
	const paragraphPatches = textSessionParagraphPatches(
		previous,
		desired,
		paragraphSources,
		(source) => {
			const current = range(previous[source]);
			return current ? sourceUnits?.[current.start]?.attributes : undefined;
		},
	);
	const batches: Array<{ from: number; to: number; boundary: Position }> = [];
	for (let index = 0; index < indices.length;) {
		if (indices[index] !== null) {
			index++;
			continue;
		}
		const from = index;
		while (index < indices.length && indices[index] === null) {
			index++;
		}
		const oldStart = from === 0 ? 0 : indices[from - 1]! + 1;
		const boundary = previous[oldStart]?.start ?? previous.at(-1)?.end ?? emptyBoundary;
		if (positions.resolve(boundary) === null) {
			return undefined;
		}
		batches.push({ from, to: index, boundary });
	}
	const retained = new Set(indices);
	// Only omitted observed identities are removed, never peer insertions between them.
	const deletedRanges = previous
		.filter((_, index) => !retained.has(index))
		.map(range)
		.filter((value) => value !== undefined)
		.sort((a, b) => a.start - b.start);
	const deletions: Array<{ start: number; end: number }> = [];
	for (const next of deletedRanges) {
		const last = deletions.at(-1);
		if (last && last.end === next.start) {
			last.end = next.end;
		} else {
			deletions.push(next);
		}
	}
	for (const deletion of deletions.reverse()) {
		text.delete(deletion.start, deletion.end - deletion.start);
	}
	if (positions.refresh?.() === false) {
		return undefined;
	}
	const inserted = new Map<number, ObservedTextSessionUnit<Position>>();
	let precedingInsert: ObservedTextSessionUnit<Position> | undefined;
	for (const batch of batches) {
		const boundary = positions.resolve(batch.boundary);
		const minimum = precedingInsert ? positions.resolve(precedingInsert.end) : 0;
		if (boundary === null || minimum === null) {
			return undefined;
		}
		// Dead CRDT neighbours can share one gap. Preserve the desired run order.
		const start = Math.max(boundary, minimum);
		let offset = start;
		for (let index = batch.from; index < batch.to;) {
			let end = index + 1;
			while (
				end < batch.to &&
				desired[end].attributes === desired[index].attributes &&
				paragraphPatches.get(end) === paragraphPatches.get(index)
			) {
				end++;
			}
			text.insert(
				offset,
				desired
					.slice(index, end)
					.map((unit) => unit.text)
					.join(''),
				textSessionInsertionAttributes(desired[index].attributes, paragraphPatches.get(index)),
			);
			offset += end - index;
			index = end;
		}
		if (positions.refresh?.() === false) {
			return undefined;
		}
		for (let index = batch.from; index < batch.to; index++) {
			const position = start + index - batch.from;
			inserted.set(index, {
				...desired[index],
				start: positions.capture(position, 0),
				end: positions.capture(position + 1, -1),
			});
		}
		precedingInsert = inserted.get(batch.to - 1);
	}
	const liveUnits = textSessionUnits(text.toDelta());
	const formats: Array<{ start: number; end: number; patch: Record<string, string | null> }> = [];
	for (const [index, oldIndex] of indices.entries()) {
		if (oldIndex === null) {
			continue;
		}
		const unit = previous[oldIndex];
		const paragraph = paragraphPatches.get(index);
		if (!paragraph && textSessionAttributesEqual(unit.attributes, desired[index].attributes)) {
			continue;
		}
		const current = range(unit);
		if (!current) {
			continue;
		}
		const patch = {
			...textSessionAttributePatch(
				unit.attributes,
				desired[index].attributes,
				liveUnits?.[current.start]?.attributes ?? {},
			),
			...paragraph,
		};
		for (const key of Object.keys(patch)) {
			if (patch[key] === (liveUnits?.[current.start]?.attributes[key] ?? null)) {
				delete patch[key];
			}
		}
		if (Object.keys(patch).length > 0) {
			const last = formats.at(-1);
			if (
				last &&
				last.end === current.start &&
				JSON.stringify(last.patch) === JSON.stringify(patch)
			) {
				last.end = current.end;
			} else {
				formats.push({ ...current, patch });
			}
		}
	}
	for (const format of formats) {
		text.format(format.start, format.end - format.start, format.patch);
	}
	return indices.map((oldIndex, index) => ({
		...(oldIndex === null ? inserted.get(index)! : previous[oldIndex]),
		attributes: desired[index].attributes,
	}));
}
