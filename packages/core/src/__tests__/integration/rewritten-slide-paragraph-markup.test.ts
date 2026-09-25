/**
 * A slide that is rewritten on save (any edit marks it dirty) must give back
 * the paragraph markup it was loaded from, not an equivalent the writer finds
 * easier to produce. Each case here was a residue measured by the round-trip
 * diff harness on the committed fixtures:
 *
 * - an authored empty `<a:pPr/>` was dropped;
 * - a bare `<a:p/>` gained an empty run (a lone one) or the
 *   `<a:endParaRPr lang="en-US"/>` stub (a trailing or inner one);
 * - `a:prstTxWarp` lost its empty `<a:avLst/>`;
 * - a notes paragraph lost its empty `<a:endParaRPr/>`, and its `a:pPr` was
 *   re-attached AFTER the runs (invalid `CT_TextParagraph` order).
 */
import { describe, expect, it } from 'vitest';

import { markAllDirty, roundTrip } from './save-fidelity-harness';

const SLIDE = 'ppt/slides/slide1.xml';
const run = (text: string): string =>
	`<a:r><a:rPr lang="en-US" dirty="0"/><a:t>${text}</a:t></a:r>`;

/** Replace the FIRST shape's lone `<a:p/>` of `degenerate-shape.pptx` with `paragraphs`. */
async function rewriteFirstBody(paragraphs: string, bodyPr = '<a:bodyPr/>') {
	const { saved } = await roundTrip('degenerate-shape.pptx', {
		patchParts: {
			[SLIDE]: (xml) =>
				xml.replace('<a:bodyPr/><a:lstStyle/><a:p/>', `${bodyPr}<a:lstStyle/>${paragraphs}`),
		},
		mutate: (data) => {
			markAllDirty(data);
		},
	});
	const xml = await saved.file(SLIDE)!.async('string');
	const bodies = [...xml.matchAll(/<p:txBody>([\s\S]*?)<\/p:txBody>/g)].map((m) => m[1]!);
	return { first: bodies[0]!, second: bodies[1]! };
}

/** The `a:p` elements of a text body, self-closing ones normalised to `<a:p></a:p>`. */
const paragraphsOf = (body: string): string[] =>
	[...body.replace(/<a:p\/>/g, '<a:p></a:p>').matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map(
		(m) => m[1]!,
	);
const isEmptyElement = (xml: string, tag: string): boolean =>
	new RegExp(`<${tag}\\s*/>|<${tag}></${tag}>`).test(xml);

describe('rewritten slide paragraph markup', () => {
	it('keeps an authored empty <a:pPr/>', async () => {
		const { first } = await rewriteFirstBody(`<a:p><a:pPr/>${run('Hello')}</a:p>`);
		const [paragraph] = paragraphsOf(first);
		expect(paragraph).toMatch(/^(<a:pPr\/>|<a:pPr><\/a:pPr>)<a:r>/);
	});

	it('does not invent <a:pPr/> on a paragraph that had none', async () => {
		const { first } = await rewriteFirstBody(`<a:p>${run('Hello')}</a:p>`);
		expect(first).not.toContain('<a:pPr');
	});

	it('writes a lone bare <a:p/> back with no run and no end properties', async () => {
		const { second } = await rewriteFirstBody(`<a:p>${run('Hello')}</a:p>`);
		expect(paragraphsOf(second)).toStrictEqual(['']);
	});

	it('keeps inner and trailing bare paragraphs bare', async () => {
		const { first } = await rewriteFirstBody(
			`<a:p>${run('Hello')}</a:p><a:p/><a:p>${run('World')}</a:p><a:p/>`,
		);
		const paragraphs = paragraphsOf(first);
		expect(paragraphs).toHaveLength(4);
		expect(paragraphs[1]).toBe('');
		expect(paragraphs[3]).toBe('');
		expect(paragraphs[0]).toContain('Hello');
		expect(paragraphs[2]).toContain('World');
	});

	it('keeps a runless paragraph with only <a:pPr/> free of a stub', async () => {
		const { first } = await rewriteFirstBody('<a:p><a:pPr/></a:p>');
		const [paragraph] = paragraphsOf(first);
		expect(isEmptyElement(paragraph!, 'a:pPr')).toBeTruthy();
		expect(paragraph).not.toContain('a:endParaRPr');
		expect(paragraph).not.toContain('<a:r>');
	});

	it('still writes an authored <a:endParaRPr/> on a blank line', async () => {
		const { first } = await rewriteFirstBody(
			`<a:p>${run('Hello')}</a:p><a:p><a:endParaRPr lang="en-US" sz="1000"/></a:p>`,
		);
		expect(paragraphsOf(first)[1]).toMatch(
			/<a:endParaRPr lang="en-US" sz="1000"(\/>|><\/a:endParaRPr>)/,
		);
	});

	it('keeps the empty <a:avLst/> of a text warp', async () => {
		const { first } = await rewriteFirstBody(
			`<a:p>${run('Warp')}</a:p>`,
			'<a:bodyPr><a:prstTxWarp prst="textInflate"><a:avLst/></a:prstTxWarp></a:bodyPr>',
		);
		expect(first).toMatch(
			/<a:prstTxWarp prst="textInflate">(<a:avLst\/>|<a:avLst><\/a:avLst>)<\/a:prstTxWarp>/,
		);
	});
});

describe('rewritten notes paragraph markup', () => {
	it('keeps an empty <a:endParaRPr/> and writes <a:pPr> before the runs', async () => {
		const notes = 'ppt/notesSlides/notesSlide1.xml';
		const { source, saved } = await roundTrip(
			'Slide_Animations_Speaker_comments_8_Slides_2_7_MB_c8f64d1a03.pptx',
			{ mutate: (data) => markAllDirty(data) },
		);
		const before = await source.file(notes)!.async('string');
		const after = await saved.file(notes)!.async('string');
		expect(before).toContain('<a:endParaRPr/>');
		expect(isEmptyElement(after, 'a:endParaRPr')).toBeTruthy();
		const paragraph = /<a:p>([\s\S]*?)<\/a:p>/.exec(after.slice(after.indexOf('<p:txBody>')))![1]!;
		expect(paragraph.indexOf('<a:pPr')).toBe(0);
		expect(paragraph.indexOf('<a:pPr')).toBeLessThan(paragraph.indexOf('<a:r>'));
		expect(
			paragraph.endsWith('<a:endParaRPr/>') || paragraph.endsWith('<a:endParaRPr></a:endParaRPr>'),
		).toBeTruthy();
	});
});
