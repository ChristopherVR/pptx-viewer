/**
 * A save must write what the source AUTHORED, not what the loader RESOLVED.
 *
 * `a:rPr` is a sparse override of the layout/master/theme cascade and `a:pPr`
 * is a sparse override of the shape's `a:lstStyle` and the placeholder's level
 * styles. Both were being re-emitted from the fully resolved model, so a
 * PowerPoint-authored deck came back with every inherited size, colour and
 * typeface pinned onto its runs and every inherited alignment and margin
 * pinned onto its paragraphs. Nothing looks wrong until the user re-themes or
 * re-lays-out the deck and the text refuses to follow.
 *
 * The corpus deck below is the project's own COM-authored fixture, and its
 * title run is verbatim `<a:rPr lang="en-US"/>`: it authors NOTHING, so a
 * faithful save must not invent anything for it either.
 *
 * These assertions are on the raw saved XML on purpose. A model-level
 * round-trip cannot see this defect at all, because a flattened deck reloads
 * to exactly the same resolved values - which is why it survived a 10,000-test
 * suite and a corpus round-trip harness.
 */
import JSZip from 'jszip';
import { describe, it, expect, beforeAll } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import { readCorpusFixture } from './real-world-corpus-helpers';

const FIXTURE = 'animations-transitions-multislide.pptx';

/** Count non-overlapping occurrences of a literal token. */
function count(haystack: string, needle: string): number {
	let total = 0;
	let index = 0;
	for (;;) {
		const found = haystack.indexOf(needle, index);
		if (found < 0) {
			return total;
		}
		total += 1;
		index = found + needle.length;
	}
}

async function partOf(bytes: ArrayBuffer | Uint8Array, part: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const file = zip.file(part);
	expect(file).toBeTruthy();
	return await file!.async('string');
}

describe('a save does not flatten inheritance into the slide', () => {
	let before = '';
	let after = '';

	beforeAll(async () => {
		const source = readCorpusFixture(FIXTURE);
		before = await partOf(source, 'ppt/slides/slide1.xml');

		const handler = new PptxHandler();
		const data = await handler.load(source);
		// The slide-level fingerprint fast path passes an untouched slide through
		// verbatim, which would make this test prove nothing. Marking the slides
		// dirty is the case that matters anyway: the user edits ONE slide and
		// every run on it is re-serialized.
		for (const slide of data.slides) {
			slide.isDirty = true;
		}
		after = await partOf(await handler.save(data.slides), 'ppt/slides/slide1.xml');
	}, 30_000);

	it('leaves the source verbatim as the baseline this test is measured against', () => {
		// Guards the fixture itself: if PowerPoint ever re-authors it with
		// explicit run properties, the assertions below would pass vacuously.
		expect(before).toContain('<a:rPr lang="en-US"/>');
		expect(count(before, '<a:latin')).toBe(0);
		expect(count(before, '<a:solidFill')).toBe(0);
	});

	it('invents no typeface for a run that authored none', () => {
		// Before the fix: `<a:latin typeface="Aptos Display"/>`, resolved off the
		// theme's major font and therefore no longer following it.
		expect(count(after, '<a:latin')).toBe(0);
		expect(count(after, '<a:ea ')).toBe(0);
		expect(count(after, '<a:cs ')).toBe(0);
	});

	it('invents no size or colour for a run that authored none', () => {
		// Before the fix: `sz="6000"` plus
		// `<a:solidFill><a:srgbClr val="000000"/></a:solidFill>`.
		expect(count(after, 'sz="')).toBeLessThanOrEqual(count(before, 'sz="'));
		expect(count(after, '<a:rPr sz=')).toBe(0);
		expect(after).not.toContain('<a:srgbClr val="000000"/></a:solidFill>');
	});

	it('invents no paragraph geometry for a paragraph that authored none', () => {
		// Before the fix: every `a:p` gained `algn`, `marL`, `indent`, an
		// `a:lnSpc` and an `a:spcBef` resolved from the master's `p:bodyStyle`,
		// which then OVERRODE that master for good.
		for (const token of ['algn="', 'marL="', 'indent="', '<a:lnSpc', '<a:spcBef']) {
			expect(`${token}:${count(after, token) <= count(before, token)}`).toBe(`${token}:true`);
		}
	});
});

describe('an edit still reaches the file', () => {
	it('writes an element-level alignment change into a:lstStyle/a:lvl1pPr', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(readCorpusFixture(FIXTURE));
		const target = data.slides[0].elements.find(
			(element) =>
				'textStyle' in element && typeof (element as { text?: string }).text === 'string',
		);
		expect(target).toBeTruthy();
		// This is exactly what the shared `alignPatch` / `textAdvancedPatch`
		// panels do: replace `element.textStyle`, and nothing else. Dropping the
		// geometry outright (rather than routing it) would silently discard it.
		const styled = target as { textStyle?: Record<string, unknown>; isDirty?: boolean };
		styled.textStyle = { ...(styled.textStyle ?? {}), align: 'right' };
		data.slides[0].isDirty = true;

		const saved = await partOf(await handler.save(data.slides), 'ppt/slides/slide1.xml');
		expect(saved).toContain('<a:lstStyle><a:lvl1pPr algn="r"');
	}, 30_000);

	it('still writes a run style the user changed', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(readCorpusFixture(FIXTURE));
		const target = data.slides[0].elements.find(
			(element) =>
				'textStyle' in element && typeof (element as { text?: string }).text === 'string',
		) as { textStyle?: Record<string, unknown> } | undefined;
		expect(target).toBeTruthy();
		// An editor replaces `element.textStyle` and knows nothing about the
		// authored / inherited split, so "differs from the recorded baseline" is
		// what has to make the value writable again. Without that arm the gate
		// would be indistinguishable from simply never writing run properties.
		target!.textStyle = {
			...(target!.textStyle ?? {}),
			fontFamily: 'Courier New',
			color: '#FF0000',
		};
		data.slides[0].isDirty = true;

		const saved = await partOf(await handler.save(data.slides), 'ppt/slides/slide1.xml');
		expect(saved).toContain('<a:latin typeface="Courier New"');
		expect(saved).toContain('<a:srgbClr val="FF0000"');
	}, 30_000);
});
