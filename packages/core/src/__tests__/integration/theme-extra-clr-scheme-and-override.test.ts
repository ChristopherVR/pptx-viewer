/**
 * Two theme-scoped constructs that the OOXML coverage audits claimed were
 * implemented, but which no test actually exercised:
 *
 * 1. `a:extraClrSchemeLst` / `a:extraClrScheme` (`a:themeElements`'s sibling
 *    list of alternate colour schemes a theme can carry, used by
 *    PowerPoint's "Colors" gallery variants). `PptxHandlerRuntimeThemeLoading`
 *    captures the raw subtree per theme path unconditionally on every load
 *    (`masterThemeExtraClrSchemeLst`). The only PUBLIC write path that
 *    touches a theme, `updateThemeColorScheme` /
 *    `PptxHandlerRuntimeThemeProcessing.updateThemeColorScheme`, re-parses
 *    the theme file fresh, patches only `a:clrScheme` in place, and writes
 *    the WHOLE re-parsed document straight back - so `extraClrSchemeLst`
 *    survives as untouched sibling data. (The separate `markThemeDirty` /
 *    `buildThemeXml` reconstruction path in `PptxHandlerRuntimeSaveTheme.ts`
 *    that reads `masterThemeExtraClrSchemeLst` back out is never invoked by
 *    any public caller - nothing in the runtime calls `markThemeDirty` - so
 *    it is exercised here only insofar as the ordinary save pipeline copies
 *    an unmodified theme part verbatim.)
 *
 * 2. `a:themeOverride` (`p:sldLayout`'s themeOverride relationship, resolved
 *    by `loadThemeOverride` / `applyThemeOverrideState` in
 *    `PptxHandlerRuntimeThemeOverrides.ts`), which lets a layout swap in a
 *    different `a:clrScheme` / `a:fontScheme` / `a:fmtScheme` for the
 *    duration of parsing slides that use it, without touching the shared
 *    theme part other layouts still resolve against.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxThemeColorScheme } from '../../core/types';

const BASE_COLOR_SCHEME: PptxThemeColorScheme = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#1F497D',
	lt2: '#EEECE1',
	accent1: '#4F81BD',
	accent2: '#C0504D',
	accent3: '#9BBB59',
	accent4: '#8064A2',
	accent5: '#4BACC6',
	accent6: '#F79646',
	hlink: '#0000FF',
	folHlink: '#800080',
};

/** A real `a:extraClrSchemeLst` with one alternate colour-scheme variant. */
const EXTRA_CLR_SCHEME_LST =
	'<a:extraClrSchemeLst><a:extraClrScheme>' +
	'<a:clrScheme name="Variant"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
	'<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
	'<a:dk2><a:srgbClr val="04617B"/></a:dk2><a:lt2><a:srgbClr val="DBF5F9"/></a:lt2>' +
	'<a:accent1><a:srgbClr val="0F6FC6"/></a:accent1><a:accent2><a:srgbClr val="009DD9"/></a:accent2>' +
	'<a:accent3><a:srgbClr val="0BD0D9"/></a:accent3><a:accent4><a:srgbClr val="10CF9B"/></a:accent4>' +
	'<a:accent5><a:srgbClr val="7CCA62"/></a:accent5><a:accent6><a:srgbClr val="A5C249"/></a:accent6>' +
	'<a:hlink><a:srgbClr val="FF0000"/></a:hlink><a:folHlink><a:srgbClr val="B0000B"/></a:folHlink>' +
	'</a:clrScheme>' +
	'<a:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" ' +
	'accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
	'</a:extraClrScheme></a:extraClrSchemeLst>';

async function buildDeckWithExtraClrScheme() {
	const built = await PresentationBuilder.create({ initialSlideCount: 1 });
	const seed = await built.handler.save(built.data.slides);
	const zip = await JSZip.loadAsync(seed);

	const themePath = 'ppt/theme/theme1.xml';
	const themeXml = await zip.file(themePath)!.async('string');
	expect(themeXml).toContain('<a:extraClrSchemeLst/>');
	zip.file(themePath, themeXml.replace('<a:extraClrSchemeLst/>', EXTRA_CLR_SCHEME_LST));

	const patched = await zip.generateAsync({ type: 'uint8array' });
	const handler = new PptxHandler();
	const data = await handler.load(patched.buffer as ArrayBuffer);
	return { handler, data };
}

/**
 * Asserts the theme XML still carries the alternate scheme's own distinctive
 * accent1/name pair, without pinning down whether the serializer emits an
 * empty element self-closed or as an open/close pair.
 */
function expectExtraClrSchemeIntact(themeXml: string): void {
	expect(themeXml).toContain('<a:extraClrSchemeLst>');
	expect(themeXml).toContain('name="Variant"');
	expect(themeXml).toContain('val="0F6FC6"'); // the variant's own accent1, untouched
	expect(themeXml).toContain('val="B0000B"'); // the variant's own folHlink, untouched
}

describe('a:extraClrSchemeLst / a:extraClrScheme', () => {
	it('survives a no-edit load -> save round trip byte-for-byte', async () => {
		const { handler, data } = await buildDeckWithExtraClrScheme();
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const themeXml = await zip.file('ppt/theme/theme1.xml')!.async('string');
		expect(themeXml).toContain(EXTRA_CLR_SCHEME_LST);
	});

	it('survives an in-place theme colour-scheme edit as untouched sibling data', async () => {
		const { handler, data } = await buildDeckWithExtraClrScheme();

		// Real production edit path: PptxHandlerCore.updateThemeColorScheme ->
		// PptxHandlerRuntimeThemeProcessing.updateThemeColorScheme. This is the
		// only public API that mutates a theme part, and it writes directly
		// into the in-memory zip rather than waiting for `save()`.
		const edited: PptxThemeColorScheme = { ...BASE_COLOR_SCHEME, accent1: '#123456' };
		await handler.updateThemeColorScheme(edited);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const themeXml = await zip.file('ppt/theme/theme1.xml')!.async('string');

		// The edit landed...
		expect(themeXml).toContain('<a:accent1><a:srgbClr val="123456"></a:srgbClr></a:accent1>');
		// ...and the sibling extraClrSchemeLst, which the edit never touches,
		// is still there with its own distinct accent1 untouched.
		expectExtraClrSchemeIntact(themeXml);
	});
});

/** Relationship Type PowerPoint uses for a layout's theme-override part. */
const THEME_OVERRIDE_REL_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/themeOverride';

const THEME_OVERRIDE_XML =
	'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
	'<a:themeOverride xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
	'<a:clrScheme name="Override"><a:dk1><a:srgbClr val="000000"/></a:dk1>' +
	'<a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="000000"/></a:dk2>' +
	'<a:lt2><a:srgbClr val="FFFFFF"/></a:lt2>' +
	'<a:accent1><a:srgbClr val="ABCDEF"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2>' +
	'<a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4>' +
	'<a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6>' +
	'<a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink>' +
	'</a:clrScheme></a:themeOverride>';

/** A shape whose fill resolves the themed `accent1` slot, to observe the override. */
function accent1FillShapeXml(): string {
	return (
		'<p:sp><p:nvSpPr><p:cNvPr id="20" name="Accent1Box"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
		'<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="900000" cy="900000"/></a:xfrm>' +
		'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
		'<a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr>' +
		'<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>'
	);
}

async function buildDeckWithLayoutThemeOverride() {
	const built = await PresentationBuilder.create({ initialSlideCount: 1 });
	const seed = await built.handler.save(built.data.slides);
	const zip = await JSZip.loadAsync(seed);

	zip.file('ppt/theme/themeOverride1.xml', THEME_OVERRIDE_XML);

	// Initial slides created via `initialSlideCount` all use the "Blank"
	// layout, which is index 7 (1-based) in the SDK's STANDARD_LAYOUTS list.
	const layoutRelsPath = 'ppt/slideLayouts/_rels/slideLayout7.xml.rels';
	const layoutRelsXml = await zip.file(layoutRelsPath)!.async('string');
	const withOverrideRel = layoutRelsXml.replace(
		'</Relationships>',
		`<Relationship Id="rIdThemeOverride" Type="${THEME_OVERRIDE_REL_TYPE}" ` +
			'Target="../theme/themeOverride1.xml"/></Relationships>',
	);
	expect(withOverrideRel).not.toBe(layoutRelsXml);
	zip.file(layoutRelsPath, withOverrideRel);

	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml = await zip.file(slidePath)!.async('string');
	const withShape = slideXml.replace('</p:spTree>', `${accent1FillShapeXml()}</p:spTree>`);
	expect(withShape).not.toBe(slideXml);
	zip.file(slidePath, withShape);

	const patched = await zip.generateAsync({ type: 'uint8array' });
	const handler = new PptxHandler();
	const data = await handler.load(patched.buffer as ArrayBuffer);
	return { handler, data };
}

function accent1FillOf(data: Awaited<ReturnType<typeof buildDeckWithLayoutThemeOverride>>['data']) {
	const shape = data.slides[0]!.elements.find((element) => 'shapeStyle' in element);
	return (shape as { shapeStyle?: { fillColor?: string } } | undefined)?.shapeStyle?.fillColor;
}

describe('p:sldLayout theme override (a:themeOverride)', () => {
	it("resolves a slide's schemeClr against the layout's themeOverride, not the main theme", async () => {
		const { data } = await buildDeckWithLayoutThemeOverride();
		expect(accent1FillOf(data)?.toUpperCase()).toBe('#ABCDEF');
	});

	it('restores the global theme state after the overridden slide, rather than leaking it', async () => {
		// `applyThemeOverrideState` saves `themeColorMap` before applying the
		// override and hands the caller a restore closure that puts it back;
		// `PptxSlideLoaderService` calls that closure in a `finally` block
		// once the slide is parsed. `PptxData.themeColorMap` reflects
		// whatever the LAST write left in place, so if restore were skipped
		// or ran before the closure's own save snapshot the override took,
		// the base theme's accent1 (#4472C4, the SDK default) would come
		// back as the override's #ABCDEF instead.
		const { data } = await buildDeckWithLayoutThemeOverride();
		expect(data.themeColorMap?.accent1?.toUpperCase().replace(/^#/u, '')).toBe('4472C4');
	});

	it('survives a no-edit load -> save round trip: the override part is never rewritten', async () => {
		// Nothing in the save pipeline touches `ppt/theme/themeOverride*.xml`;
		// it is neither in `masterThemePaths` (so `persistThemeParts` skips it)
		// nor covered by any other writer, so it is only ever passed through
		// with whatever the rest of the ZIP entries carry.
		const { handler, data } = await buildDeckWithLayoutThemeOverride();
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const overrideXml = await zip.file('ppt/theme/themeOverride1.xml')?.async('string');
		expect(overrideXml).toBe(THEME_OVERRIDE_XML);

		// And re-loading the saved package still resolves the override.
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(accent1FillOf(reloaded)?.toUpperCase()).toBe('#ABCDEF');
	});
});
