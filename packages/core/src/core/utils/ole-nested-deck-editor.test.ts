import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../builders/sdk/PresentationBuilder';
import {
	readOleNestedDeckDetail,
	readOleNestedDeckFirstSlideTextLines,
	writeOleNestedDeckElementText,
} from './ole-nested-deck-editor';

async function buildNestedDeck(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank')
			.addText('First Slide Title', { fontSize: 32, x: 0, y: 0, width: 400, height: 60 })
			.addText('First Slide Body', { fontSize: 18, x: 0, y: 80, width: 400, height: 60 })
			.build(),
		createSlide('Blank')
			.addText('Second Slide Title', { fontSize: 32, x: 0, y: 0, width: 400, height: 60 })
			.build(),
	);
	return handler.save(data.slides);
}

describe('ole-nested-deck-editor', () => {
	it('reads every text-bearing element on every slide, not just the first', async () => {
		const bytes = await buildNestedDeck();
		const detail = await readOleNestedDeckDetail(bytes);
		expect(detail).toBeDefined();
		expect(detail![0]!.index).toBe(0);
		expect(detail![0]!.elements.map((e) => e.text)).toStrictEqual([
			'First Slide Title',
			'First Slide Body',
		]);
		expect(detail![1]!.elements.map((e) => e.text)).toStrictEqual(['Second Slide Title']);
	});

	it('returns undefined for bytes that are not a readable presentation', async () => {
		await expect(readOleNestedDeckDetail(new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
	});

	it('replaces one specific element (not necessarily the first) and re-saves the nested deck', async () => {
		const bytes = await buildNestedDeck();
		const detail = await readOleNestedDeckDetail(bytes);
		const bodyElementId = detail![0]!.elements[1]!.elementId;

		const updated = await writeOleNestedDeckElementText(bytes, 0, bodyElementId, 'Edited Body');
		const updatedDetail = await readOleNestedDeckDetail(updated);
		expect(updatedDetail![0]!.elements.map((e) => e.text)).toStrictEqual([
			'First Slide Title', // untouched
			'Edited Body',
		]);
		expect(updatedDetail![1]!.elements.map((e) => e.text)).toStrictEqual(['Second Slide Title']);
	});

	it('leaves the deck unchanged for an out-of-range slide index', async () => {
		const bytes = await buildNestedDeck();
		const updated = await writeOleNestedDeckElementText(bytes, 99, 'whatever', 'nope');
		expect(updated).toStrictEqual(bytes);
	});

	it('leaves the deck unchanged for an unknown element id', async () => {
		const bytes = await buildNestedDeck();
		const updated = await writeOleNestedDeckElementText(bytes, 0, 'no-such-element', 'nope');
		expect(updated).toStrictEqual(bytes);
	});

	it("reads the first slide's text lines for preview regeneration", async () => {
		const bytes = await buildNestedDeck();
		const lines = await readOleNestedDeckFirstSlideTextLines(bytes);
		expect(lines).toStrictEqual(['First Slide Title', 'First Slide Body']);
	});

	it('falls back to a placeholder line for an unreadable deck', async () => {
		const lines = await readOleNestedDeckFirstSlideTextLines(new Uint8Array([1, 2, 3]));
		expect(lines).toStrictEqual(['Embedded presentation']);
	});
});
