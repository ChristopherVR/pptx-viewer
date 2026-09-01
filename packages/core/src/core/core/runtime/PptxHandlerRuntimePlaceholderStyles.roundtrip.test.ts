/**
 * End-to-end coverage for the master `p:txStyles` level cascade: a body-style
 * level carrying every paragraph attribute the per-paragraph `a:pPr` path
 * understands (marL/marR/indent/algn/rtl/defTabSz/eaLnBrk/latinLnBrk/
 * fontAlgn/hangingPunct + tabLst) plus a themed `a:schemeClr` bullet must
 *
 *   (a) parse into the typed level style,
 *   (b) cascade onto an inheriting placeholder paragraph, and
 *   (c) survive a re-serialisation after an edit with the scheme colour intact.
 *
 * Before this, marR / rtl / tabLst were dropped by the level parser,
 * `algn="thaiDist"` was folded to a lower-case string no render branch
 * matched, and the serializer flattened the themed bullet to `a:srgbClr`.
 */
import JSZip from 'jszip';
import { describe, it, expect, beforeAll } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../PptxHandler';
import type { PptxData, PptxElement, TextSegment } from '../../types';

const BODY_STYLE_PATTERN = /<p:bodyStyle>[\s\S]*?<\/p:bodyStyle>/u;
const BODY_STYLE_FULL =
	'<p:bodyStyle>' +
	'<a:lvl1pPr marL="342900" marR="190500" indent="-342900" algn="thaiDist" rtl="1"' +
	' defTabSz="914400" eaLnBrk="1" latinLnBrk="0" fontAlgn="base" hangingPunct="1">' +
	'<a:spcBef><a:spcPct val="20000"/></a:spcBef>' +
	'<a:buClr><a:schemeClr val="accent1"/></a:buClr>' +
	'<a:buFont typeface="Arial"/><a:buChar char="&#x2022;"/>' +
	'<a:tabLst><a:tab pos="914400" algn="l"/><a:tab pos="1828800" algn="dec" leader="dot"/></a:tabLst>' +
	'<a:defRPr sz="3200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill>' +
	'<a:latin typeface="+mn-lt"/></a:defRPr>' +
	'</a:lvl1pPr>' +
	'</p:bodyStyle>';

function bodyPlaceholderXml(): string {
	return (
		'<p:sp><p:nvSpPr><p:cNvPr id="11" name="Body"/>' +
		'<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
		'<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
		'<p:spPr><a:xfrm><a:off x="500000" y="1600000"/><a:ext cx="4000000" cy="900000"/></a:xfrm>' +
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
		'<p:txBody><a:bodyPr/><a:lstStyle/>' +
		'<a:p><a:r><a:rPr lang="en-US"/><a:t>BodyText</a:t></a:r></a:p>' +
		'</p:txBody></p:sp>'
	);
}

async function buildSeed(): Promise<ArrayBuffer> {
	const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);

	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	zip.file(slidePath, slideXml.replace('</p:spTree>', `${bodyPlaceholderXml()}</p:spTree>`));

	const masterPath = 'ppt/slideMasters/slideMaster1.xml';
	const masterXml = await zip.file(masterPath)!.async('string');
	expect(masterXml).toMatch(BODY_STYLE_PATTERN);
	zip.file(masterPath, masterXml.replace(BODY_STYLE_PATTERN, BODY_STYLE_FULL));

	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

/** The body placeholder's segments: the stamped bullet marker first, then the run. */
function findBodySegments(elements: PptxElement[]): TextSegment[] | undefined {
	for (const element of elements) {
		if (!('textSegments' in element) || !Array.isArray(element.textSegments)) {
			continue;
		}
		if (element.textSegments.some((s) => s.text.includes('BodyText'))) {
			return element.textSegments;
		}
	}
	return undefined;
}

describe('master p:bodyStyle level cascade fidelity', () => {
	let handler: PptxHandler;
	let data: PptxData;

	beforeAll(async () => {
		handler = new PptxHandler();
		data = await handler.load(await buildSeed());
	}, 30_000);

	it('(a) parses every level attribute and the themed bullet into the typed style', () => {
		const level0 = data.slideMasters![0]!.txStyles?.bodyStyle?.[0];
		expect(level0).toMatchObject({
			marginLeft: 36,
			marginRight: 20,
			indent: -36,
			alignment: 'thaiDist',
			rtl: true,
			defaultTabSize: 96,
			eaLineBreak: true,
			latinLineBreak: false,
			fontAlignment: 'base',
			hangingPunctuation: true,
			tabStops: [
				{ position: 96, align: 'l' },
				{ position: 192, align: 'dec', leader: 'dot' },
			],
			bulletChar: '•',
			bulletColorXml: { 'a:schemeClr': { '@_val': 'accent1' } },
		});
		expect(level0?.bulletColor).toMatch(/^#[0-9A-Fa-f]{6}$/u);
	});

	it('(b) cascades the level onto an unstyled inheriting body paragraph', () => {
		const segments = findBodySegments(data.slides[0]!.elements);
		expect(segments).toBeDefined();
		const segment = segments!.find((s) => s.text.includes('BodyText'));
		expect(segment!.style).toMatchObject({
			paragraphMarginLeft: 36,
			paragraphMarginRight: 20,
			paragraphIndent: -36,
			align: 'thaiDist',
			rtl: true,
			defaultTabSize: 96,
			eaLineBreak: true,
			latinLineBreak: false,
			fontAlignment: 'base',
			hangingPunctuation: true,
			tabStops: [
				{ position: 96, align: 'l' },
				{ position: 192, align: 'dec', leader: 'dot' },
			],
		});
		// The inherited bullet is stamped as its own leading segment.
		expect(segments![0]?.bulletInfo?.char).toBe('•');
		expect(segments![0]?.bulletInfo?.color).toMatch(/^#[0-9A-Fa-f]{6}$/u);
	});

	it('(c) re-serialises an edited level with the scheme bullet colour and all attributes intact', async () => {
		const master = data.slideMasters![0]!;
		const level0 = master.txStyles!.bodyStyle![0]!;
		master.txStyles = {
			...master.txStyles,
			bodyStyle: { ...master.txStyles!.bodyStyle, 0: { ...level0, fontSize: 28 * (96 / 72) } },
		};
		const saved = await handler.save(data.slides, { slideMasters: [master] });
		const masterXml = await (await JSZip.loadAsync(saved)).file(master.path)!.async('string');

		// The writer emits explicit end tags (`<a:x ...></a:x>`), so match on
		// the opening tags rather than on self-closing forms.
		const bodyStyle = masterXml.match(BODY_STYLE_PATTERN)?.[0] ?? '';
		expect(bodyStyle).toMatch(/<a:buClr><a:schemeClr val="accent1"\s*\/?>/u);
		expect(bodyStyle).not.toContain('<a:buClr><a:srgbClr');
		expect(bodyStyle).toMatch(/<a:lvl1pPr [^>]*marR="190500"/u);
		expect(bodyStyle).toMatch(/<a:lvl1pPr [^>]*algn="thaiDist"/u);
		expect(bodyStyle).toMatch(/<a:lvl1pPr [^>]*rtl="1"/u);
		expect(bodyStyle).toMatch(
			/<a:tabLst><a:tab pos="914400"\s*\/?>(<\/a:tab>)?<a:tab pos="1828800" algn="dec" leader="dot"\s*\/?>(<\/a:tab>)?<\/a:tabLst>/u,
		);
		// The run colour keeps its theme alias too; only the size was edited.
		expect(bodyStyle).toMatch(
			/<a:defRPr sz="2800" kern="1200"><a:solidFill><a:schemeClr val="tx1"\s*\/?>/u,
		);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedLevel = reloaded.slideMasters![0]!.txStyles?.bodyStyle?.[0];
		expect(reloadedLevel?.fontSize).toBeCloseTo(28 * (96 / 72), 3);
		expect(reloadedLevel?.alignment).toBe('thaiDist');
		expect(reloadedLevel?.bulletColorXml).toStrictEqual({ 'a:schemeClr': { '@_val': 'accent1' } });
	});
});
