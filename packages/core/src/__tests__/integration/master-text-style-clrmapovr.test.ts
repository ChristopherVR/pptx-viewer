/**
 * A slide's `p:clrMapOvr` has to reach the text colours it inherits from the
 * master's `p:txStyles`.
 *
 * The master's body style paints level 1 with the `tx1` alias. `tx1` is not a
 * colour, it is a route: the master's `p:clrMap` sends it to the dark slot, and
 * a slide carrying `p:clrMapOvr` can send the same alias to the light slot
 * instead, which is how one layout family serves both light and dark slides.
 *
 * Master text styles are parsed and cached before any slide is, so resolving
 * the alias at cache time freezes it to the master's routing and every slide
 * inherits the same colour. The two slides below differ only in their colour
 * map, so their inherited body colour has to differ too.
 */
import JSZip from 'jszip';
import { describe, it, expect, beforeAll } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxElement } from '../../core/types';

/**
 * Whatever `p:clrMapOvr` the seed happens to carry, matched by SHAPE rather
 * than by an exact string. The literal
 * `<p:clrMapOvr><a:masterClrMapping></a:masterClrMapping></p:clrMapOvr>` used
 * to be safe because every save re-serialized every slide through our own
 * writer; now that an unmodified slide passes through verbatim, the seed keeps
 * the SDK template's self-closing `<a:masterClrMapping/>` and a literal
 * `replace` matched nothing AT ALL, leaving both slides on the master map and
 * turning this test green-for-the-wrong-reason territory into a hard failure.
 */
const MASTER_CLR_MAPPING = /<p:clrMapOvr>[\s\S]*?<\/p:clrMapOvr>/u;

/** Route `tx1` to the light slot and `bg1` to the dark one, as a dark slide does. */
const INVERTED_CLR_MAPPING =
	'<p:clrMapOvr><a:overrideClrMapping bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" ' +
	'accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" ' +
	'accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink">' +
	'</a:overrideClrMapping></p:clrMapOvr>';

/** A body placeholder whose run declares no colour, so level 1 of the master's bodyStyle applies. */
function bodyPlaceholderXml(text: string): string {
	return (
		'<p:sp><p:nvSpPr><p:cNvPr id="7" name="Body"></p:cNvPr>' +
		'<p:cNvSpPr><a:spLocks noGrp="1"></a:spLocks></p:cNvSpPr>' +
		'<p:nvPr><p:ph type="body" idx="1"></p:ph></p:nvPr></p:nvSpPr>' +
		'<p:spPr><a:xfrm><a:off x="838200" y="1825625"></a:off>' +
		'<a:ext cx="10515600" cy="4351338"></a:ext></a:xfrm>' +
		'<a:prstGeom prst="rect"><a:avLst></a:avLst></a:prstGeom></p:spPr>' +
		'<p:txBody><a:bodyPr></a:bodyPr><a:lstStyle></a:lstStyle>' +
		`<a:p><a:r><a:rPr lang="en-US"></a:rPr><a:t>${text}</a:t></a:r></a:p>` +
		'</p:txBody></p:sp>'
	);
}

/**
 * Seed a two-slide deck, give both slides the same uncoloured body
 * placeholder, and invert the colour map on the second one only.
 */
async function buildDeckWithInvertedSecondSlide(): Promise<ArrayBuffer> {
	const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 2 });
	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);

	for (const [index, path] of ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml'].entries()) {
		const xml = await zip.file(path)!.async('string');
		const withBody = xml.replace(
			'</p:spTree>',
			`${bodyPlaceholderXml(index === 0 ? 'MAPPED' : 'OVERRIDDEN')}</p:spTree>`,
		);
		if (index === 0) {
			zip.file(path, withBody);
			continue;
		}
		const inverted = withBody.replace(MASTER_CLR_MAPPING, INVERTED_CLR_MAPPING);
		if (inverted === withBody) {
			throw new Error(
				`Fixture build failed: no <p:clrMapOvr> to invert in ${path}. ` +
					'Without it both slides share the master map and the test proves nothing.',
			);
		}
		zip.file(path, inverted);
	}

	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

function bodyText(slideElements: PptxElement[], text: string): PptxElement | undefined {
	return slideElements.find(
		(element) => 'text' in element && String((element as { text?: string }).text).includes(text),
	);
}

function colorOf(element: PptxElement | undefined): string | undefined {
	const style = (element as { textStyle?: { color?: string } } | undefined)?.textStyle;
	return style?.color?.toUpperCase();
}

describe('inherited master text colour under a slide clrMapOvr', () => {
	let data: PptxData;

	beforeAll(async () => {
		data = await new PptxHandler().load(await buildDeckWithInvertedSecondSlide());
	}, 30_000);

	it('resolves the tx1 alias through the master map by default', () => {
		const element = bodyText(data.slides[0]!.elements, 'MAPPED');
		expect(element).toBeDefined();
		expect(colorOf(element)).toBe('#000000');
	});

	it('re-routes the same alias through the slide override', () => {
		const element = bodyText(data.slides[1]!.elements, 'OVERRIDDEN');
		expect(element).toBeDefined();
		expect(colorOf(element)).toBe('#FFFFFF');
	});
});
