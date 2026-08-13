import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { fingerprintSlide } from '../../core/core/runtime/slide-fingerprint';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, PptxSlide } from '../../core/types';
import { requireFixture } from '../require-fixture';

/**
 * A slide the user never touched must come out of `save()` byte-for-byte as it
 * went in.
 *
 * Re-serializing a slide is lossy in ways nobody asked for: inherited run
 * properties get flattened into the runs, `a:pPr` / `dirty="0"` /
 * `a:endParaRPr` are injected, `mc:AlternateContent` envelopes are rebuilt and
 * shape ids can be renumbered. Until this landed, opening a 100-slide deck and
 * pressing Save with no edits at all did that to all 100 slides, because the
 * `slide.isDirty === false` fast path in
 * `PptxHandlerRuntimeSaveSlideWriter.processSlideForSave` was unreachable: the
 * flag was written in exactly two places repo-wide and never to `false`.
 *
 * The two halves below are inseparable. Skipping slides is only safe while the
 * second half holds, so any change that makes an edit invisible must fail here
 * rather than in a user's deck.
 */
const FIXTURES = path.resolve(__dirname, '../../../../../e2e/fixtures');

const slidePartsOf = async (bytes: ArrayBuffer | Uint8Array): Promise<Map<string, string>> => {
	const zip = await JSZip.loadAsync(bytes);
	const parts = new Map<string, string>();
	for (const name of Object.keys(zip.files)) {
		if (/^ppt\/slides\/slide\d+\.xml$/u.test(name)) {
			parts.set(name, await zip.files[name].async('base64'));
		}
	}
	return parts;
};

const partText = async (bytes: Uint8Array, name: string): Promise<string> => {
	const zip = await JSZip.loadAsync(bytes);
	return (await zip.file(name)?.async('string')) ?? '';
};

const readFixture = (file: string): ArrayBuffer => {
	const buffer = readFileSync(requireFixture(path.join(FIXTURES, file)));
	return buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength,
	) as ArrayBuffer;
};

/** Parts present in both packages whose bytes differ. New parts are not drift. */
const changedSlideParts = (before: Map<string, string>, after: Map<string, string>): string[] =>
	[...after.keys()]
		.filter((name) => before.has(name) && before.get(name) !== after.get(name))
		.sort();

/** Genuine decks, from four authoring tools, covering text/table/chart/media. */
const DECKS = [
	'sample-deck.pptx',
	'solution-explorer.pptx',
	'issue-132-hr-deck.pptx',
	'Japanese_10_Slides_1_8_MB_bbd4090b55.pptx',
	'Slide_Animations_Speaker_comments_8_Slides_2_7_MB_c8f64d1a03.pptx',
];

describe('unmodified slides pass through save byte-identically', () => {
	it.each(DECKS)('%s: load -> save with no edits rewrites no slide part', async (deck) => {
		const source = readFixture(deck);
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const saved = await handler.save(data.slides);

		const before = await slidePartsOf(source.slice(0));
		const after = await slidePartsOf(saved);
		expect(before.size).toBeGreaterThan(0);
		expect(after.size).toBe(before.size);
		expect(changedSlideParts(before, after)).toStrictEqual([]);
	});

	it('rewrites only the slide that was edited', async () => {
		const source = readFixture('sample-deck.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const target = data.slides[1];
		const edited = data.slides.map((slide, index) =>
			index === 1
				? {
						...slide,
						elements: slide.elements.map((element: PptxElement, position: number) =>
							position === 0 ? { ...element, x: element.x + 24 } : element,
						),
					}
				: slide,
		);
		const saved = await handler.save(edited);

		const before = await slidePartsOf(source.slice(0));
		const after = await slidePartsOf(saved);
		expect(changedSlideParts(before, after)).toStrictEqual([target.id]);
	});

	it('lets an edit reach the file even though its neighbours are skipped', async () => {
		const source = readFixture('sample-deck.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const marker = 'PASSTHROUGH-EDIT-MARKER';
		const edited = data.slides.map((slide, index) =>
			index === 2 ? { ...slide, hidden: true, notes: marker } : slide,
		);
		const saved = await handler.save(edited);

		await expect(partText(saved, data.slides[2].id)).resolves.toMatch(/<p:sld[^>]*\sshow="0"/u);
		const zip = await JSZip.loadAsync(saved);
		const notes = Object.keys(zip.files).filter((name) =>
			name.startsWith('ppt/notesSlides/notesSlide'),
		);
		const notesText = await Promise.all(notes.map((name) => zip.files[name].async('string')));
		expect(notesText.some((xml) => xml.includes(marker))).toBeTruthy();
	});

	it('honours an explicit isDirty=true even when the model is unchanged', async () => {
		const source = readFixture('sample-deck.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const flagged = data.slides.map((slide, index) =>
			index === 3 ? { ...slide, isDirty: true } : slide,
		);
		const saved = await handler.save(flagged);

		const before = await slidePartsOf(source.slice(0));
		const after = await slidePartsOf(saved);
		expect(changedSlideParts(before, after)).toStrictEqual([data.slides[3].id]);
	});

	it('does not skip a slide created this session', async () => {
		const source = readFixture('sample-deck.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const marker = 'BRAND-NEW-SLIDE-MARKER';
		const fresh: PptxSlide = {
			...data.slides[0],
			id: 'ppt/slides/slide99.xml',
			rawXml: undefined,
			elements: [
				{
					id: 'new-element',
					type: 'text',
					x: 100,
					y: 100,
					width: 400,
					height: 100,
					text: marker,
				} as unknown as PptxElement,
			],
		};
		const saved = await handler.save([...data.slides, fresh]);

		const before = await slidePartsOf(source.slice(0));
		const after = await slidePartsOf(saved);
		const added = [...after.keys()].filter((name) => !before.has(name));
		expect(changedSlideParts(before, after)).toStrictEqual([]);
		expect(added).toHaveLength(1);
		await expect(partText(saved, added[0])).resolves.toContain(marker);
	});

	it('leaves the surviving slides alone when one is deleted', async () => {
		const source = readFixture('sample-deck.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const removed = data.slides[2].id;
		const saved = await handler.save(data.slides.filter((_, index) => index !== 2));

		const before = await slidePartsOf(source.slice(0));
		const after = await slidePartsOf(saved);
		expect(after.has(removed)).toBeFalsy();
		expect(changedSlideParts(before, after)).toStrictEqual([]);
	});

	it('keeps a comment-bearing slide and its parts across a no-edit save', async () => {
		// Comment-bearing slides are deliberately excluded from the fast path:
		// the save session prunes every comment part no slide claimed during the
		// pass, so skipping one would delete the comment out of the package.
		const source = readFixture('sample-deck.pptx');
		const first = new PptxHandler();
		const authored = await first.load(source.slice(0));
		authored.slides[0].comments = [
			{
				id: '1',
				author: 'Ada Lovelace',
				text: 'COMMENT-SURVIVAL-MARKER',
				x: 10,
				y: 10,
				date: '2026-01-01T00:00:00Z',
			},
		];
		const commented = await first.save(authored.slides);

		const second = new PptxHandler();
		const reloaded = await second.load(
			commented.buffer.slice(
				commented.byteOffset,
				commented.byteOffset + commented.byteLength,
			) as ArrayBuffer,
		);
		const resaved = await second.save(reloaded.slides);

		const zip = await JSZip.loadAsync(resaved);
		const commentParts = Object.keys(zip.files).filter((name) => name.startsWith('ppt/comments/'));
		expect(commentParts).toHaveLength(1);
		await expect(zip.files[commentParts[0]].async('string')).resolves.toContain(
			'COMMENT-SURVIVAL-MARKER',
		);
		expect(zip.file('ppt/commentAuthors.xml')).not.toBeNull();
	});

	it('rewrites a slide that is edited after an earlier save', async () => {
		const source = readFixture('sample-deck.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		await handler.save(
			data.slides.map((slide, index) =>
				index === 1 ? { ...slide, backgroundColor: '#010203' } : slide,
			),
		);
		const second = await handler.save(
			data.slides.map((slide, index) =>
				index === 1
					? { ...slide, backgroundColor: '#010203' }
					: index === 4
						? { ...slide, backgroundColor: '#abcdef' }
						: slide,
			),
		);

		const before = await slidePartsOf(source.slice(0));
		const after = await slidePartsOf(second);
		expect(changedSlideParts(before, after)).toStrictEqual(
			[data.slides[1].id, data.slides[4].id].sort(),
		);
		expect((await partText(second, data.slides[4].id)).toLowerCase()).toContain('abcdef');
	});

	it('rewrites a slide that is reverted to its loaded state', async () => {
		const source = readFixture('sample-deck.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const pristine = data.slides.map((slide) => ({ ...slide }));
		await handler.save(
			data.slides.map((slide, index) =>
				index === 1 ? { ...slide, backgroundColor: '#010203' } : slide,
			),
		);
		const undone = await handler.save(pristine);

		await expect(partText(undone, data.slides[1].id)).resolves.not.toContain('010203');
	});

	it('fingerprints every loaded slide so the very first save can skip', async () => {
		// A regression guard for the wiring itself: without the load-time
		// baseline the fast path is as dead as the flag it replaced.
		const source = readFixture('sample-deck.pptx');
		const handler = new PptxHandler();
		const data = await handler.load(source.slice(0));
		const fingerprints = new Set(data.slides.map((slide) => fingerprintSlide(slide)));
		expect(fingerprints.size).toBe(data.slides.length);
	});
});
