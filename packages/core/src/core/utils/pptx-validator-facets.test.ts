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
			'<a:alpha val="-1"/><a:alphaMod val="100.1%"/><a:alphaOff val="-100001"/><a:lumOff val="25%"/>',
		);

		expect(issues).toHaveLength(3);
		expect(issues.every((issue) => issue.message.includes('percentage'))).toBeTruthy();
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
