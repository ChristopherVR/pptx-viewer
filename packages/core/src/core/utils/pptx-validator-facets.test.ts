import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { validatePptx } from './pptx-validator';

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

async function pack(themeBody: string, presentationBody = ''): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file(
		'[Content_Types].xml',
		'<Types><Default Extension="xml" ContentType="xml"/><Default Extension="rels" ContentType="rels"/></Types>',
	);
	zip.file(
		'_rels/.rels',
		'<Relationships><Relationship Id="rId1" Type="office" Target="ppt/presentation.xml"/></Relationships>',
	);
	zip.file(
		'ppt/presentation.xml',
		`<p:presentation xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}">${presentationBody}</p:presentation>`,
	);
	zip.file(
		'ppt/theme/theme1.xml',
		`<a:theme xmlns:a="${A}" xmlns:p="${P}" xmlns:r="${R}"><a:themeElements><a:clrScheme/><a:fontScheme/><a:fmtScheme/></a:themeElements>${themeBody}</a:theme>`,
	);
	return zip.generateAsync({ type: 'arraybuffer' });
}

async function facetIssues(themeBody: string, presentationBody = '') {
	return (await validatePptx(await pack(themeBody, presentationBody))).issues.filter(
		(issue) => issue.code === 'INVALID_SIMPLE_TYPE_FACET',
	);
}

describe('selected ECMA-376 simple-type facets', () => {
	it('validates fixed and positive percentage ranges and lexical forms', async () => {
		const issues = await facetIssues(
			'<a:alpha val="-1"/><a:alpha val="100.1%"/><a:alphaOff val="-100001"/><a:alphaMod val="-1"/><a:lumMod val="not-a-number"/>',
		);

		expect(issues).toHaveLength(5);
		expect(issues.every((issue) => issue.message.includes('percentage'))).toBeTruthy();
	});

	/**
	 * `EG_ColorTransform` (ECMA-376 Part 1 §20.1.2.3.x) types every saturation,
	 * luminance and per-channel transform as `CT_Percentage`, whose value space
	 * is the full signed `xsd:int` range, and types `alphaMod`/`hueMod` as
	 * `CT_PositivePercentage`, which has no upper bound either. Only
	 * `alpha`/`tint`/`shade` are capped at 100000.
	 *
	 * Capping the others was the single biggest source of false positives in
	 * this validator: PowerPoint's own default Office theme emits
	 * `<a:satMod val="300000"/>` in its gradient fills and `<a:lumMod
	 * val="110000"/>` in its chart styles, so the rule fired 695 times across
	 * 32 of the 37 readable fixtures in this repo, all five COM-authored corpus
	 * decks included. That made `validatePptx` unusable as a save gate.
	 */
	it('accepts modulations above 100 percent, which PowerPoint emits routinely', async () => {
		const issues = await facetIssues(
			'<a:satMod val="300000"/><a:lumMod val="110000"/><a:lum val="-50000"/>' +
				'<a:satOff val="200000"/><a:redMod val="150000"/><a:blueOff val="-200000"/>' +
				'<a:alphaMod val="200000"/><a:hueMod val="120000"/>',
		);

		expect(issues).toStrictEqual([]);
	});

	it('validates angle and coordinate facets including universal measures', async () => {
		const issues = await facetIssues(
			'<a:xfrm rot="2147483648"><a:off x="-27273042329601" y="1cm"/><a:ext cx="-1mm" cy="27273042316901"/></a:xfrm><a:lin ang="21600000"/>',
		);

		expect(issues).toHaveLength(5);
		expect(issues.some((issue) => issue.message.includes('angle'))).toBeTruthy();
		expect(issues.some((issue) => issue.message.includes('coordinate'))).toBeTruthy();
	});

	it('validates relationship ID references and language tags', async () => {
		const issues = await facetIssues(
			'<a:rPr lang="en_US" altLang="fr-FR"/><a:lang val="x-none"/>',
			'<p:sldIdLst><p:sldId id="256" r:id="1bad"/></p:sldIdLst>',
		);

		expect(issues).toHaveLength(2);
		expect(issues.some((issue) => issue.message.includes('language tag'))).toBeTruthy();
		expect(issues.some((issue) => issue.message.includes('XML ID token'))).toBeTruthy();
	});

	/**
	 * `CT_Hyperlink/@r:id` is optional, and an internal PowerPoint action has no
	 * relationship to reference, so PowerPoint writes the attribute empty:
	 * `<a:hlinkClick r:id="" action="ppaction://noaction"/>`. That shape occurs
	 * on 11 of the 14 slides of `e2e/fixtures/solution-explorer.pptx` and in the
	 * COM-authored `ole-embedded-media.pptx` corpus deck. An empty `r:id`
	 * anywhere else is still a defect and must still be reported.
	 */
	it('accepts an empty r:id on an action hyperlink but nowhere else', async () => {
		const allowed = await facetIssues(
			'<a:hlinkClick r:id="" action="ppaction://noaction"/>' +
				'<a:hlinkHover r:id="" action="ppaction://media"/>',
		);
		expect(allowed).toStrictEqual([]);

		const rejected = await facetIssues(
			'<a:blip r:embed="rId2"/>',
			'<p:sldIdLst><p:sldId id="256" r:id=""/></p:sldIdLst>',
		);
		expect(rejected).toHaveLength(1);
		expect(rejected[0].message).toContain('XML ID token');
	});

	it('validates common PresentationML and DrawingML enum domains', async () => {
		const issues = await facetIssues(
			'<p:ph type="heading"/><a:pPr algn="middle"/><a:bodyPr anchor="middle"/><a:schemeClr val="accent9"/><a:ln cap="round" cmpd="quad" bwMode="sepia"/><a:prstDash val="dots"/>',
		);

		expect(issues).toHaveLength(8);
		expect(issues.every((issue) => issue.message.includes('one of:'))).toBeTruthy();
	});

	it('accepts valid boundary values and enum tokens', async () => {
		const issues = await facetIssues(
			'<a:alpha val="100000"/><a:alphaOff val="-100%"/><a:xfrm rot="-2147483648"><a:off x="-1in" y="0"/><a:ext cx="0" cy="27273042316900"/></a:xfrm><a:lin ang="21599999"/><a:rPr lang="zh-Hans"/><a:pPr algn="ctr"/><a:schemeClr val="accent6"/><a:ln cap="rnd" cmpd="sng" bwMode="auto"/>',
		);

		expect(issues).toHaveLength(0);
	});
});
