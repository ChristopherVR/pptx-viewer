/**
 * A ruby run has three `a:rPr`s (outer `a:r`, `a:rt` run, `a:rubyBase`
 * run). They used to be written from one merged, fully resolved style, so a
 * rewritten slide gave each of them `a:solidFill`, `a:latin`, `a:rtl` and a
 * `dirty` it never had, copied the outer run's `lang` onto the base run, and
 * rewrote `a:rubyPr/@hps` from a pixel size (`1200` came back as `32`).
 * Each `a:rPr` now gets back only its own properties, `a:rubyPr` is kept
 * verbatim, and an edit still reaches the base text.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { PptxData } from '../../index';

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/underline-words-ruby-tab.pptx', import.meta.url),
);

const selfClose = (xml: string): string => xml.replace(/<(a:[\w]+)([^>]*)><\/\1>/g, '<$1$2/>');

function rubyRunXml(slideXml: string): string {
	const match = /<a:r><a:rPr[^>]*>(?:(?!<\/a:r>).)*?<a:ruby>.*?<\/a:ruby><\/a:r>/s.exec(slideXml);
	return selfClose(match?.[0] ?? '');
}

async function saveSlide(
	mutate?: (data: PptxData) => void,
): Promise<{ before: string; after: string }> {
	const source = readFileSync(fixture);
	const handler = new PptxHandler();
	const data = await handler.load(new Uint8Array(source));
	data.slides[0]!.isDirty = true;
	mutate?.(data);
	const saved = await handler.save(data.slides);
	const read = async (bytes: Uint8Array): Promise<string> =>
		(await JSZip.loadAsync(bytes)).file('ppt/slides/slide1.xml')!.async('string');
	return { before: await read(new Uint8Array(source)), after: await read(saved) };
}

describe('a ruby run on a rewritten slide', () => {
	it('re-emits each of its three a:rPr and its a:rubyPr exactly as authored', async () => {
		const { before, after } = await saveSlide();
		const expected = rubyRunXml(before);
		expect(expected).toContain('<a:rubyPr algn="ctr" hps="1200"/>');
		expect(rubyRunXml(after)).toBe(expected);
	});

	it('still carries an edit made to the ruby segment onto its base run', async () => {
		const { after } = await saveSlide((data) => {
			for (const element of data.slides[0]!.elements) {
				if (!('textSegments' in element) || !element.textSegments) {
					continue;
				}
				for (const segment of element.textSegments) {
					if (segment.rubyText !== undefined) {
						segment.style = { ...segment.style, bold: true };
					}
				}
			}
		});
		const base = /<a:rubyBase><a:r><a:rPr[^>]*>/.exec(after)?.[0] ?? '';
		expect(base).toContain('b="1"');
		expect(base).toContain('lang="en-US"');
	});
});
