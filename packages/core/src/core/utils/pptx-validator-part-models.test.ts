import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { validatePptx } from './pptx-validator';

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';

async function pack(
	presentation = `<p:presentation xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"/>`,
	presentationRels = '<Relationships/>',
	parts: Record<string, string> = {},
): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file(
		'[Content_Types].xml',
		'<Types><Default Extension="xml" ContentType="xml"/><Default Extension="rels" ContentType="rels"/></Types>',
	);
	zip.file(
		'_rels/.rels',
		'<Relationships><Relationship Id="rId1" Type="office" Target="ppt/presentation.xml"/></Relationships>',
	);
	zip.file('ppt/presentation.xml', presentation);
	zip.file('ppt/_rels/presentation.xml.rels', presentationRels);
	for (const [path, xml] of Object.entries(parts)) {
		zip.file(path, xml);
	}
	return zip.generateAsync({ type: 'arraybuffer' });
}

async function issues(buffer: ArrayBuffer) {
	return (await validatePptx(buffer)).issues;
}

describe('eCMA part content models', () => {
	it('validates roots for each supported presentation part family', async () => {
		const parts = {
			'ppt/slideMasters/slideMaster1.xml': '<wrong/>',
			'ppt/slideLayouts/slideLayout1.xml': '<wrong/>',
			'ppt/notesMasters/notesMaster1.xml': '<wrong/>',
			'ppt/notesSlides/notesSlide1.xml': '<wrong/>',
			'ppt/handoutMasters/handoutMaster1.xml': '<wrong/>',
			'ppt/theme/theme1.xml': '<wrong/>',
			'ppt/charts/chart1.xml': '<wrong/>',
			'ppt/diagrams/data1.xml': '<wrong/>',
			'ppt/diagrams/layout1.xml': '<wrong/>',
			'ppt/diagrams/quickStyle1.xml': '<wrong/>',
			'ppt/diagrams/colors1.xml': '<wrong/>',
			'ppt/comments/comment1.xml': '<wrong/>',
			'ppt/commentAuthors.xml': '<wrong/>',
			'ppt/presProps.xml': '<wrong/>',
			'ppt/viewProps.xml': '<wrong/>',
			'ppt/tableStyles.xml': '<wrong/>',
		};
		const result = await issues(await pack(undefined, undefined, parts));
		expect(result.filter((issue) => issue.code === 'INVALID_PART_ROOT')).toHaveLength(16);
	});

	it('checks required children and table-style default attribute', async () => {
		const parts = {
			'ppt/slideMasters/slideMaster1.xml': `<x:sldMaster xmlns:x="${P}"/>`,
			'ppt/notesMasters/notesMaster1.xml': `<x:notesMaster xmlns:x="${P}"/>`,
			'ppt/theme/theme1.xml': `<x:theme xmlns:x="${A}"><x:themeElements/></x:theme>`,
			'ppt/charts/chart1.xml': `<x:chartSpace xmlns:x="${C}"/>`,
			'ppt/diagrams/data1.xml': `<x:dataModel xmlns:x="${D}"/>`,
			'ppt/diagrams/layout1.xml': `<x:layoutDef xmlns:x="${D}"/>`,
			'ppt/diagrams/quickStyle1.xml': `<x:styleDef xmlns:x="${D}"/>`,
			'ppt/diagrams/colors1.xml': `<x:colorsDef xmlns:x="${D}"/>`,
			'ppt/tableStyles.xml': `<x:tblStyleLst xmlns:x="${A}"/>`,
		};
		const result = await issues(await pack(undefined, undefined, parts));
		expect(
			result.some(
				(issue) =>
					issue.code === 'MISSING_REQUIRED_PART_ELEMENT' && issue.path?.includes('slideMaster'),
			),
		).toBeTruthy();
		expect(
			result.some(
				(issue) => issue.code === 'MISSING_REQUIRED_PART_ELEMENT' && issue.path?.includes('chart1'),
			),
		).toBeTruthy();
		expect(result.some((issue) => issue.code === 'MISSING_REQUIRED_PART_ATTRIBUTE')).toBeTruthy();
	});

	it('accepts minimal required models with arbitrary namespace prefixes', async () => {
		const parts = {
			'ppt/theme/theme1.xml': `<draw:theme xmlns:draw="${A}"><draw:themeElements><draw:clrScheme/><draw:fontScheme/><draw:fmtScheme/></draw:themeElements></draw:theme>`,
			'ppt/charts/chart1.xml': `<chart:chartSpace xmlns:chart="${C}"><chart:chart/></chart:chartSpace>`,
			'ppt/diagrams/data1.xml': `<d:dataModel xmlns:d="${D}"><d:ptLst/><d:cxnLst/></d:dataModel>`,
			'ppt/diagrams/layout1.xml': `<d:layoutDef xmlns:d="${D}"><d:layoutNode/></d:layoutDef>`,
			'ppt/diagrams/quickStyle1.xml': `<d:styleDef xmlns:d="${D}"><d:styleLbl/></d:styleDef>`,
			'ppt/diagrams/colors1.xml': `<d:colorsDef xmlns:d="${D}"><d:styleLbl/></d:colorsDef>`,
			'ppt/tableStyles.xml': `<draw:tblStyleLst xmlns:draw="${A}" def="default"/>`,
		};
		const result = await issues(await pack(undefined, undefined, parts));
		expect(
			result.filter(
				(issue) =>
					issue.code.startsWith('INVALID_PART_') || issue.code.startsWith('MISSING_REQUIRED_PART_'),
			),
		).toHaveLength(0);
	});

	it('validates legacy comment and author required fields with arbitrary prefixes', async () => {
		const parts = {
			'ppt/comments/comment1.xml': `<x:cmLst xmlns:x="${P}"><x:cm authorId="1" idx="2"><x:pos x="0" y="0"/></x:cm><x:cm authorId="1" dt="2024-01-01T00:00:00Z" idx="2"><x:pos x="0" y="0"/><x:text>duplicate</x:text></x:cm></x:cmLst>`,
			'ppt/commentAuthors.xml': `<x:cmAuthorLst xmlns:x="${P}"><x:cmAuthor id="1" name="Alice"/><x:cmAuthor id="1" name="Again" initials="A" lastIdx="2" clrIdx="0"/></x:cmAuthorLst>`,
		};
		const result = await issues(await pack(undefined, undefined, parts));
		const codes = result.map((issue) => issue.code);

		expect(codes).toContain('MISSING_REQUIRED_PART_ATTRIBUTE');
		expect(codes).toContain('MISSING_REQUIRED_PART_ELEMENT');
		expect(codes).toContain('DUPLICATE_COMMENT_INDEX');
		expect(codes).toContain('DUPLICATE_COMMENT_AUTHOR_ID');
	});
});

describe('presentation relationship references', () => {
	it('checks missing, duplicate, and wrongly typed slide/master references', async () => {
		const presentation = `<p:presentation xmlns:p="${P}" xmlns:r="${R}" xmlns:a="${A}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId9"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`;
		const rels =
			'<Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>';
		const result = await issues(await pack(presentation, rels));
		const codes = result.map((issue) => issue.code);
		expect(codes).toContain('MISSING_PRESENTATION_RELATIONSHIP');
		expect(codes).toContain('DUPLICATE_PRESENTATION_RELATIONSHIP_REFERENCE');
		expect(codes).toContain('INVALID_PRESENTATION_RELATIONSHIP_TYPE');
	});

	it('accepts existing uniquely referenced slide and master relationships', async () => {
		const presentation = `<p:presentation xmlns:p="${P}" xmlns:rel="${R}" xmlns:a="${A}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" rel:id="m1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" rel:id="s1"/></p:sldIdLst></p:presentation>`;
		const rels =
			'<Relationships><Relationship Id="m1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="missing-master.xml"/><Relationship Id="s1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="missing-slide.xml"/></Relationships>';
		const result = await issues(await pack(presentation, rels));
		expect(result.filter((issue) => issue.code.includes('PRESENTATION_RELATIONSHIP'))).toHaveLength(
			0,
		);
	});
});
