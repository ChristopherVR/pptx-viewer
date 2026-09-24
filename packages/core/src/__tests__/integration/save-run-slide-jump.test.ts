/**
 * Regression: a run-level `a:hlinkClick action="ppaction://hlinksldjump"` was
 * rewritten on save as a NEW `.../relationships/hyperlink` relationship to
 * `slide3.xml` with no `TargetMode`, an invalid package PowerPoint refuses to
 * open, while the original `.../relationships/slide` relationship was left
 * behind unused. The jump's target index was also taken from the part's file
 * number rather than the presentation's slide order.
 */
import { describe, expect, it } from 'vitest';

import type { PptxElement, TextStyle } from '../../core/types';
import { markAllDirty, partText, roundTrip } from './save-fidelity-harness';

const SLIDE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';

const patchParts = {
	// Put slide3.xml FIRST in the show so file number and position disagree.
	'ppt/presentation.xml': (xml: string) =>
		xml.replace(
			/(<p:sldIdLst>\s*)([\s\S]*?)(<p:sldId id="258" r:id="rId8"><\/p:sldId>)/u,
			'$1$3$2',
		),
	'ppt/slides/_rels/slide1.xml.rels': (xml: string) =>
		xml.replace(
			'</Relationships>',
			`<Relationship Id="rId9" Type="${SLIDE_REL_TYPE}" Target="slide3.xml"/></Relationships>`,
		),
	'ppt/slides/slide1.xml': (xml: string) =>
		xml.replace(
			/<a:rPr lang="en-US" dirty="0" sz="4050" b="1">/u,
			'<a:rPr lang="en-US" dirty="0" sz="4050" b="1"><a:hlinkClick r:id="rId9" action="ppaction://hlinksldjump"/>',
		),
};

function jumpStyle(elements: PptxElement[]): TextStyle | undefined {
	for (const el of elements) {
		const segments = (el as { textSegments?: { style?: TextStyle }[] }).textSegments ?? [];
		const hit = segments.find((seg) => seg.style?.hyperlinkAction === 'ppaction://hlinksldjump');
		if (hit) {
			return hit.style;
		}
	}
	return undefined;
}

describe('run-level slide-jump hyperlinks', () => {
	it('resolve the target index from slide order and save a slide relationship', async () => {
		const { data, saved } = await roundTrip('sample-deck.pptx', {
			patchParts,
			mutate: markAllDirty,
		});
		const slide1 = data.slides.find((s) => s.id.endsWith('/slide1.xml'));
		const style = jumpStyle(slide1?.elements ?? []);
		expect(style?.hyperlinkTargetSlideIndex).toBe(0);

		const xml = await partText(saved, 'ppt/slides/slide1.xml');
		const hlink = /<a:hlinkClick r:id="(rId\d+)" action="ppaction:\/\/hlinksldjump"/u.exec(xml);
		expect(hlink).not.toBeNull();
		const rels = await partText(saved, 'ppt/slides/_rels/slide1.xml.rels');
		const rel = new RegExp(`<Relationship Id="${hlink?.[1]}"[^>]*>`, 'u').exec(rels)?.[0] ?? '';
		expect(rel).toContain(`Type="${SLIDE_REL_TYPE}"`);
		expect(rel).toContain('Target="slide3.xml"');
		expect(rel).not.toContain('TargetMode');
		expect(rels).not.toMatch(/relationships\/hyperlink" Target="slide3\.xml"/u);
		expect(rels.match(/Target="slide3\.xml"/gu)).toHaveLength(1);
	});
});
