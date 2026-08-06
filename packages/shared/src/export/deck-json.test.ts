import type { PptxData } from 'pptx-viewer-core';
import { PptxJsonConverter } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildDeckJson, deckJsonFileName } from './deck-json';

const data = {
	slides: [{ id: 's1', elements: [] }],
	width: 960,
	height: 540,
} as unknown as PptxData;

describe('deckJsonFileName', () => {
	it('derives the json name from the source deck name', () => {
		expect(deckJsonFileName('quarterly.pptx')).toBe('quarterly.json');
		expect(deckJsonFileName('show.PPSX')).toBe('show.json');
		expect(deckJsonFileName('already.json')).toBe('already.json');
	});

	it('falls back to presentation.json without a source name', () => {
		expect(deckJsonFileName()).toBe('presentation.json');
		expect(deckJsonFileName('   ')).toBe('presentation.json');
		expect(deckJsonFileName(null)).toBe('presentation.json');
	});
});

describe('buildDeckJson', () => {
	it('produces a valid pptx-viewer-json document', () => {
		const json = buildDeckJson(data);
		const doc = PptxJsonConverter.parse(json);
		expect(doc.format).toBe('pptx-viewer-json');
		expect(doc.version).toBe(1);
		expect(doc.slideCount).toBe(1);
		expect(doc.generator).toBe('pptx-viewer');
	});
});
