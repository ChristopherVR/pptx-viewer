/**
 * `tag-collections` - pure list surgery for the inspector's Tags section
 * (`ppt/tags/*.xml`, PowerPoint's programmatic name/value metadata).
 *
 * WHY shared: a tag lives at a two-level address (which collection, then which
 * tag inside it) while the UI shows one flat list, so every add/edit/delete has
 * to map a flat row back onto the nested model. That mapping is identical in
 * every binding and is exactly the kind of off-by-one-prone code that must not
 * be retyped per framework. The functions below are immutable: they return new
 * arrays so a caller can push the result straight into an undoable commit.
 *
 * @module render/tag-collections
 */
import type { PptxTagCollection } from 'pptx-viewer-core';

/** Default OPC path used when the deck carries no tag part yet. */
export const DEFAULT_TAG_COLLECTION_PATH = 'ppt/tags/tag1.xml';

/** A tag paired with its address inside the nested collection model. */
export interface FlatTagRow {
	name: string;
	value: string;
	/** Index of the owning collection in the `PptxTagCollection[]`. */
	colIdx: number;
	/** Index of the tag inside that collection's `tags` array. */
	tagIdx: number;
}

/** Flatten every collection's tags into the single list the UI renders. */
export function flattenTagCollections(collections: readonly PptxTagCollection[]): FlatTagRow[] {
	return collections.flatMap((col, colIdx) =>
		col.tags.map((tag, tagIdx) => ({ name: tag.name, value: tag.value, colIdx, tagIdx })),
	);
}

/** Replace one field of one tag, returning a new collection array. */
export function updateTagInCollections(
	collections: readonly PptxTagCollection[],
	colIdx: number,
	tagIdx: number,
	field: 'name' | 'value',
	newValue: string,
): PptxTagCollection[] {
	return collections.map((col, ci) =>
		ci !== colIdx
			? col
			: {
					...col,
					tags: col.tags.map((tag, ti) => (ti === tagIdx ? { ...tag, [field]: newValue } : tag)),
				},
	);
}

/** Drop one tag, returning a new collection array. */
export function deleteTagFromCollections(
	collections: readonly PptxTagCollection[],
	colIdx: number,
	tagIdx: number,
): PptxTagCollection[] {
	return collections.map((col, ci) =>
		ci !== colIdx ? col : { ...col, tags: col.tags.filter((_, ti) => ti !== tagIdx) },
	);
}

/**
 * Append a blank tag to the first collection, creating that collection when the
 * deck has none. New tags always land in collection 0 so the flat list stays
 * predictable; PowerPoint itself does not care which part a tag lives in.
 */
export function addTagToCollections(
	collections: readonly PptxTagCollection[],
): PptxTagCollection[] {
	if (collections.length === 0) {
		return [{ path: DEFAULT_TAG_COLLECTION_PATH, tags: [{ name: '', value: '' }] }];
	}
	return collections.map((col, ci) =>
		ci !== 0 ? col : { ...col, tags: [...col.tags, { name: '', value: '' }] },
	);
}
