import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { validatePptx } from './pptx-validator';

const TRANSITIONAL = {
	p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
	a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
	r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};

const STRICT = {
	p: 'http://purl.oclc.org/ooxml/presentationml/main',
	a: 'http://purl.oclc.org/ooxml/drawingml/main',
	r: 'http://purl.oclc.org/ooxml/officeDocument/relationships',
};

function presentationXml(
	children = '<p:sldSz cx="12192000" cy="6858000"/>',
	ns = TRANSITIONAL,
	extraNamespaces = '',
): string {
	return `<p:presentation xmlns:p="${ns.p}" xmlns:a="${ns.a}" xmlns:r="${ns.r}" ${extraNamespaces}>${children}</p:presentation>`;
}

async function packageWith(
	presentation: string,
	parts: Record<string, string> = {},
): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file(
		'[Content_Types].xml',
		`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
			<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
			<Default Extension="xml" ContentType="application/xml"/>
			<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
		</Types>`,
	);
	zip.file(
		'_rels/.rels',
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
			<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
		</Relationships>`,
	);
	zip.file('ppt/presentation.xml', presentation);
	for (const [path, xml] of Object.entries(parts)) {
		zip.file(path, xml);
	}
	return zip.generateAsync({ type: 'arraybuffer' });
}

function codes(result: Awaited<ReturnType<typeof validatePptx>>): string[] {
	return result.issues.map((item) => item.code);
}

describe('eCMA-376 rule validation', () => {
	it('classifies Strict and Transitional namespace dialects', async () => {
		const transitional = await validatePptx(await packageWith(presentationXml()));
		const strict = await validatePptx(await packageWith(presentationXml(undefined, STRICT)));

		expect(transitional.conformance.dialect).toBe('transitional');
		expect(strict.conformance.dialect).toBe('strict');
		expect(strict.conformance.level).toBe('rule-checked');
		expect(strict.conformance.description).toContain('not exhaustive XSD validation');
	});

	it('rejects packages that mix Strict and Transitional namespaces', async () => {
		const mixed = presentationXml(undefined, { ...TRANSITIONAL, a: STRICT.a });
		const result = await validatePptx(await packageWith(mixed));

		expect(result.conformance.dialect).toBe('mixed');
		expect(codes(result)).toContain('MIXED_CONFORMANCE_DIALECT');
		expect(result.valid).toBeFalsy();
	});

	it('checks PresentationML sequence order and slide identifier datatypes', async () => {
		const xml = presentationXml(`
			<p:sldSz cx="12192000" cy="6858000"/>
			<p:sldIdLst><p:sldId id="42" r:id="rId2"/></p:sldIdLst>`);
		const result = await validatePptx(await packageWith(xml));

		expect(codes(result)).toContain('INVALID_CONTENT_ORDER');
		expect(codes(result)).toContain('INVALID_DATATYPE');
		expect(result.valid).toBeFalsy();
	});

	it('checks required slide content and shape-tree leading children', async () => {
		const slide = `<p:sld xmlns:p="${TRANSITIONAL.p}" xmlns:a="${TRANSITIONAL.a}">
			<p:cSld><p:spTree><p:grpSpPr/><p:nvGrpSpPr/></p:spTree></p:cSld>
		</p:sld>`;
		const result = await validatePptx(
			await packageWith(presentationXml(), { 'ppt/slides/slide1.xml': slide }),
		);

		expect(codes(result)).toContain('INVALID_SHAPE_TREE');
		expect(result.valid).toBeFalsy();
	});

	it('checks DrawingML colour and extent datatypes', async () => {
		const theme = `<a:theme xmlns:a="${TRANSITIONAL.a}">
			<a:themeElements><a:srgbClr val="GG00FF"/><a:ext cx="-1" cy="abc"/></a:themeElements>
		</a:theme>`;
		const result = await validatePptx(
			await packageWith(presentationXml(), { 'ppt/theme/theme1.xml': theme }),
		);

		expect(result.issues.filter((item) => item.code === 'INVALID_DATATYPE')).toHaveLength(3);
		expect(result.valid).toBeFalsy();
	});

	it('validates MCE declarations, Requires, and fallback order', async () => {
		const xml = presentationXml(
			`<mc:AlternateContent>
				<mc:Fallback/><mc:Choice Requires="p99"/>
			</mc:AlternateContent>`,
			TRANSITIONAL,
			'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="p99"',
		);
		const result = await validatePptx(await packageWith(xml));

		expect(codes(result)).toContain('MCE_UNDECLARED_PREFIX');
		expect(codes(result)).toContain('MCE_INVALID_ALTERNATE_CONTENT');
		expect(result.valid).toBeFalsy();
	});

	it('requires mc:Choice Requires to be non-empty', async () => {
		const xml = presentationXml(
			'<mc:AlternateContent><mc:Choice Requires=""/></mc:AlternateContent>',
			TRANSITIONAL,
			'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
		);
		const result = await validatePptx(await packageWith(xml));

		expect(codes(result)).toContain('MCE_MISSING_REQUIRES');
	});

	it('recognises MCE markup through a non-standard namespace prefix', async () => {
		const xml = presentationXml(
			'<compat:AlternateContent><compat:Choice Requires="p14"/><compat:Fallback/></compat:AlternateContent>',
			TRANSITIONAL,
			'xmlns:compat="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:p14="urn:p14" compat:Ignorable="p14"',
		);
		const result = await validatePptx(await packageWith(xml));
		expect(codes(result).filter((code) => code.startsWith('MCE_'))).toHaveLength(0);
	});
});
