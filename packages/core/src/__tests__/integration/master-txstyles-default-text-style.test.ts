/**
 * `p:txStyles` (`p:titleStyle` / `p:bodyStyle` / `p:otherStyle`) on a slide
 * master and `p:defaultTextStyle` on the presentation are two separate
 * fallback layers a shape's text can inherit from when it declares no local
 * run/paragraph formatting:
 *
 *   authored run/paragraph props
 *     -> placeholder shape's own inherited lstStyle (layout, then master)
 *     -> the master's title/body/other style for that placeholder's family
 *        (`placeholderStyleFamily`: title/ctrTitle -> titleStyle,
 *        body/obj/subtitle -> bodyStyle, everything else -> otherStyle)
 *     -> `p:defaultTextStyle` on the presentation (applies to EVERY shape,
 *        placeholder or not, as the very last resort)
 *
 * This is implemented by `parseMasterTxStyles` / `parseTextListStyle`
 * (`PptxHandlerRuntimeMasterElements.ts`), `lookupPlaceholderDefaults`
 * (`PptxHandlerRuntimePlaceholderLookup.ts`), and the two unconditional
 * `applyPlaceholderBodyDefaults` / `applyPlaceholderLevelDefaults` calls in
 * `PptxHandlerRuntimeShapeParsing.ts` / `PptxHandlerRuntimeShapeTextParsing.ts`
 * (both "fill gaps only", so a placeholder's own cascade always outranks the
 * presentation default). None of this had a dedicated test: it is exercised
 * only incidentally by whatever a handful of other fixtures happen to author.
 *
 * The blank-deck SDK template already authors realistic values for all four
 * layers (title 44pt, body 32pt + bullet, otherStyle originally empty,
 * presentation default 18pt), so this patches the master's otherStyle with a
 * distinguishing size (10pt) rather than inventing a fixture from scratch.
 */
import JSZip from 'jszip';
import { describe, it, expect, beforeAll } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxElement } from '../../core/types';

/** A `<p:sp>` placeholder shape with a single unstyled run. */
function placeholderShapeXml(
	id: number,
	name: string,
	ph: string,
	text: string,
	y: number,
): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/>` +
		'<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
		`<p:nvPr>${ph}</p:nvPr></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="500000" y="${y}"/><a:ext cx="4000000" cy="900000"/></a:xfrm>` +
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
		'<p:txBody><a:bodyPr/><a:lstStyle/>' +
		`<a:p><a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r></a:p>` +
		'</p:txBody></p:sp>'
	);
}

/** A plain (non-placeholder) text box with a single unstyled run. */
function plainTextBoxXml(id: number, text: string, y: number): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="PlainBox"/>` +
		'<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
		`<p:spPr><a:xfrm><a:off x="500000" y="${y}"/><a:ext cx="4000000" cy="500000"/></a:xfrm>` +
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
		'<p:txBody><a:bodyPr/><a:lstStyle/>' +
		`<a:p><a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r></a:p>` +
		'</p:txBody></p:sp>'
	);
}

/** Matches the SDK template's empty `<p:otherStyle>` regardless of self-closing-tag style. */
const OTHER_STYLE_PATTERN = /<p:otherStyle>[\s\S]*?<\/p:otherStyle>/u;
const OTHER_STYLE_WITH_SIZE =
	'<p:otherStyle><a:lvl1pPr><a:defRPr sz="1000"/></a:lvl1pPr>' +
	'<a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:otherStyle>';

async function buildDeck(): Promise<PptxData> {
	const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);

	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	const shapes = [
		placeholderShapeXml(10, 'Title', '<p:ph type="title"/>', 'TitleText', 500000),
		placeholderShapeXml(11, 'Body', '<p:ph type="body" idx="1"/>', 'BodyText', 1600000),
		placeholderShapeXml(12, 'Footer', '<p:ph type="ftr" idx="10"/>', 'FooterText', 2700000),
		plainTextBoxXml(13, 'PlainText', 3400000),
	].join('');
	const patchedSlide = slideXml.replace('</p:spTree>', `${shapes}</p:spTree>`);
	expect(patchedSlide).not.toBe(slideXml);
	zip.file(slidePath, patchedSlide);

	const masterPath = 'ppt/slideMasters/slideMaster1.xml';
	const masterXml = await zip.file(masterPath)!.async('string');
	expect(masterXml).toMatch(OTHER_STYLE_PATTERN);
	zip.file(masterPath, masterXml.replace(OTHER_STYLE_PATTERN, OTHER_STYLE_WITH_SIZE));

	const out = await zip.generateAsync({ type: 'uint8array' });
	const buffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
	return new PptxHandler().load(buffer);
}

function findByText(elements: PptxElement[], needle: string): PptxElement | undefined {
	return elements.find((element) =>
		'textSegments' in element &&
		Array.isArray((element as { textSegments?: { text: string }[] }).textSegments)
			? (element as { textSegments: { text: string }[] }).textSegments.some((s) =>
					s.text.includes(needle),
				)
			: false,
	);
}

function fontSizeOf(element: PptxElement | undefined): number | undefined {
	return (element as { textStyle?: { fontSize?: number } } | undefined)?.textStyle?.fontSize;
}

describe('master p:txStyles and presentation p:defaultTextStyle fallback cascade', () => {
	let data: PptxData;

	beforeAll(async () => {
		data = await buildDeck();
	}, 30_000);

	it('resolves an unstyled title placeholder run from p:titleStyle (44pt)', () => {
		const title = findByText(data.slides[0]!.elements, 'TitleText');
		expect(title).toBeDefined();
		expect(fontSizeOf(title)).toBeCloseTo(44 * (96 / 72), 3);
	});

	it('resolves an unstyled body placeholder run from p:bodyStyle (32pt) including its bullet', () => {
		const body = findByText(data.slides[0]!.elements, 'BodyText');
		expect(body).toBeDefined();
		expect(fontSizeOf(body)).toBeCloseTo(32 * (96 / 72), 3);
		const segments = (body as { textSegments?: { bulletInfo?: { char?: string } }[] }).textSegments;
		expect(segments?.[0]?.bulletInfo?.char).toBe('•');
	});

	it("resolves a non-title/body placeholder ('ftr') from p:otherStyle, not p:bodyStyle", () => {
		const footer = findByText(data.slides[0]!.elements, 'FooterText');
		expect(footer).toBeDefined();
		expect(fontSizeOf(footer)).toBeCloseTo(10 * (96 / 72), 3);
	});

	it('falls back to the presentation p:defaultTextStyle for a non-placeholder text box (18pt)', () => {
		const plain = findByText(data.slides[0]!.elements, 'PlainText');
		expect(plain).toBeDefined();
		expect(fontSizeOf(plain)).toBeCloseTo(18 * (96 / 72), 3);
	});

	it('lets a placeholder cascade win over the presentation default (title != 18pt default)', () => {
		const title = findByText(data.slides[0]!.elements, 'TitleText');
		expect(fontSizeOf(title)).not.toBeCloseTo(18 * (96 / 72), 3);
	});
});

describe('master p:txStyles and presentation p:defaultTextStyle edit path', () => {
	it('edits titleStyle level 0 font size while preserving bodyStyle/otherStyle and unmodelled XML', async () => {
		const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await handler.save(data.slides);
		const loadHandler = new PptxHandler();
		const loaded = await loadHandler.load(seed.buffer as ArrayBuffer);
		const master = loaded.slideMasters![0]!;

		const originalBodySize = master.txStyles?.bodyStyle?.[0]?.fontSize;
		expect(originalBodySize).toBeCloseTo(32 * (96 / 72), 3);

		master.txStyles = {
			...master.txStyles,
			titleStyle: { ...master.txStyles?.titleStyle, 0: { fontSize: 40 * (96 / 72), bold: true } },
		};
		const saved = await loadHandler.save(loaded.slides, { slideMasters: [master] });

		const zip = await JSZip.loadAsync(saved);
		const masterXml = await zip.file(master.path)!.async('string');
		// The edited level carries the new size/bold, merged into (not
		// replacing) the existing defRPr: @kern and the theme font-ref latin
		// typeface, neither of which the typed model owns, both survive.
		expect(masterXml).toMatch(/<p:titleStyle><a:lvl1pPr[^>]*><a:spcBef>/u);
		expect(masterXml).toContain('<a:defRPr sz="4000" kern="1200" b="1">');
		expect(masterXml).toContain('<a:latin typeface="+mj-lt">');
		// bodyStyle and otherStyle, which this edit did not touch, are untouched.
		expect(masterXml).toContain('<a:defRPr sz="3200" kern="1200">');
		expect(masterXml).toContain('<p:otherStyle><a:defPPr><a:defRPr lang="en-US">');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedMaster = reloaded.slideMasters!.find((m) => m.path === master.path)!;
		expect(reloadedMaster.txStyles?.titleStyle?.[0]?.fontSize).toBeCloseTo(40 * (96 / 72), 3);
		expect(reloadedMaster.txStyles?.titleStyle?.[0]?.bold).toBeTruthy();
		expect(reloadedMaster.txStyles?.bodyStyle?.[0]?.fontSize).toBeCloseTo(32 * (96 / 72), 3);
	});

	it('edits the presentation defaultTextStyle level 0 font size via the save option', async () => {
		const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await handler.save(data.slides);
		const loadHandler = new PptxHandler();
		const loaded = await loadHandler.load(seed.buffer as ArrayBuffer);

		expect(loaded.defaultTextStyle?.[0]?.fontSize).toBeCloseTo(18 * (96 / 72), 3);

		const saved = await loadHandler.save(loaded.slides, {
			defaultTextStyle: { 0: { fontSize: 20 * (96 / 72) } },
		});
		const presentationXml = await (
			await JSZip.loadAsync(saved)
		)
			.file('ppt/presentation.xml')!
			.async('string');
		// defPPr, which this edit did not touch, keeps its schema position
		// ahead of the edited lvl1pPr.
		expect(presentationXml).toMatch(/<p:defaultTextStyle><a:defPPr>[\s\S]*<\/a:defPPr><a:lvl1pPr/u);
		expect(presentationXml).toContain('<a:defRPr sz="2000" kern="1200">');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.defaultTextStyle?.[0]?.fontSize).toBeCloseTo(20 * (96 / 72), 3);
	});
});

describe('master p:txStyles and p:defaultTextStyle survive a no-edit round trip', () => {
	it('re-emits titleStyle/bodyStyle/otherStyle and defaultTextStyle verbatim', async () => {
		const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await handler.save(data.slides);
		const reloadHandler = new PptxHandler();
		const loaded = await reloadHandler.load(seed.buffer as ArrayBuffer);
		const resaved = await reloadHandler.save(loaded.slides);

		const seedZip = await JSZip.loadAsync(seed);
		const resavedZip = await JSZip.loadAsync(resaved);
		const seedMaster = await seedZip.file('ppt/slideMasters/slideMaster1.xml')!.async('string');
		const resavedMaster = await resavedZip
			.file('ppt/slideMasters/slideMaster1.xml')!
			.async('string');
		expect(seedMaster).toContain('<p:txStyles>');
		expect(resavedMaster).toContain(extractTag(seedMaster, 'p:txStyles'));

		const seedPresentation = await seedZip.file('ppt/presentation.xml')!.async('string');
		const resavedPresentation = await resavedZip.file('ppt/presentation.xml')!.async('string');
		expect(seedPresentation).toContain('<p:defaultTextStyle>');
		expect(resavedPresentation).toContain(extractTag(seedPresentation, 'p:defaultTextStyle'));
	});
});

/** Extract a top-level element's full outer XML by tag name (no nested same-name tags expected). */
function extractTag(xml: string, tag: string): string {
	const start = xml.indexOf(`<${tag}>`);
	const end = xml.indexOf(`</${tag}>`);
	if (start === -1 || end === -1) {
		throw new Error(`Fixture must carry a <${tag}> to compare.`);
	}
	return xml.slice(start, end + tag.length + 3);
}
