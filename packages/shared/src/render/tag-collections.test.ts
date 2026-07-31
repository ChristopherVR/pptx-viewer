import type { PptxTagCollection } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	addTagToCollections,
	DEFAULT_TAG_COLLECTION_PATH,
	deleteTagFromCollections,
	flattenTagCollections,
	updateTagInCollections,
} from './tag-collections';

const collections: PptxTagCollection[] = [
	{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'A', value: '1' }] },
	{
		path: 'ppt/tags/tag2.xml',
		tags: [
			{ name: 'B', value: '2' },
			{ name: 'C', value: '3' },
		],
	},
];

describe('flattenTagCollections', () => {
	it('carries the nested address of every tag', () => {
		expect(flattenTagCollections(collections)).toStrictEqual([
			{ name: 'A', value: '1', colIdx: 0, tagIdx: 0 },
			{ name: 'B', value: '2', colIdx: 1, tagIdx: 0 },
			{ name: 'C', value: '3', colIdx: 1, tagIdx: 1 },
		]);
	});

	it('is empty for a deck with no tag parts', () => {
		expect(flattenTagCollections([])).toStrictEqual([]);
	});
});

describe('updateTagInCollections', () => {
	it('edits only the addressed tag and does not mutate the input', () => {
		const next = updateTagInCollections(collections, 1, 1, 'value', '99');
		expect(next[1].tags[1]).toStrictEqual({ name: 'C', value: '99' });
		expect(next[1].tags[0]).toStrictEqual({ name: 'B', value: '2' });
		expect(collections[1].tags[1].value).toBe('3');
	});

	it('leaves untouched collections referentially identical', () => {
		const next = updateTagInCollections(collections, 1, 0, 'name', 'B2');
		expect(next[0]).toBe(collections[0]);
	});
});

describe('deleteTagFromCollections', () => {
	it('removes one tag from its own collection only', () => {
		const next = deleteTagFromCollections(collections, 1, 0);
		expect(next[1].tags).toStrictEqual([{ name: 'C', value: '3' }]);
		expect(next[0].tags).toHaveLength(1);
		expect(collections[1].tags).toHaveLength(2);
	});
});

describe('addTagToCollections', () => {
	it('appends a blank tag to the first collection', () => {
		const next = addTagToCollections(collections);
		expect(next[0].tags).toStrictEqual([
			{ name: 'A', value: '1' },
			{ name: '', value: '' },
		]);
		expect(next[1]).toBe(collections[1]);
	});

	it('creates the default tag part when the deck has none', () => {
		const next = addTagToCollections([]);
		expect(next).toStrictEqual([
			{ path: DEFAULT_TAG_COLLECTION_PATH, tags: [{ name: '', value: '' }] },
		]);
	});
});
