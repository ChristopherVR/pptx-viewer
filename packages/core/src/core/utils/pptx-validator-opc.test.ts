import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { validatePptx } from './pptx-validator';

const presentation =
	'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>';
const types =
	'<Types><Default Extension="rels" ContentType="rels"/><Default Extension="xml" ContentType="xml"/><Override PartName="/ppt/presentation.xml" ContentType="presentation"/></Types>';
const rels =
	'<Relationships><Relationship Id="rId1" Type="office" Target="ppt/presentation.xml"/></Relationships>';

async function pack(
	contentTypes = types,
	rootRels = rels,
	parts: Record<string, string> = {},
): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file('[Content_Types].xml', contentTypes);
	zip.file('_rels/.rels', rootRels);
	zip.file('ppt/presentation.xml', presentation);
	for (const [path, value] of Object.entries(parts)) {
		zip.file(path, value);
	}
	return zip.generateAsync({ type: 'arraybuffer' });
}

async function codes(buffer: ArrayBuffer): Promise<string[]> {
	return (await validatePptx(buffer)).issues.map((issue) => issue.code);
}

describe('oPC conformance validation', () => {
	it('checks duplicate content types and absolute part names', async () => {
		const xml =
			'<Types><Default Extension="xml"/><Default Extension="XML"/><Override PartName="relative.xml"/><Override PartName="/ppt/presentation.xml"/><Override PartName="/ppt/presentation.xml"/></Types>';
		const result = await codes(await pack(xml));
		expect(result).toContain('DUPLICATE_CONTENT_TYPE_DEFAULT');
		expect(result).toContain('DUPLICATE_CONTENT_TYPE_OVERRIDE');
		expect(result).toContain('INVALID_PART_NAME');
	});

	it('checks equivalent package names', async () => {
		await expect(
			codes(await pack(types, rels, { 'ppt/custom.xml': '<x/>', 'ppt/%63ustom.xml': '<x/>' })),
		).resolves.toContain('DUPLICATE_PART_NAME');
	});

	it('checks relationship IDs and external TargetMode', async () => {
		const xml =
			'<Relationships><Relationship Id="1bad" Type="x" Target="https://example.com"/><Relationship Id="1bad" Type="x" Target="https://example.com" TargetMode="external"/></Relationships>';
		const result = await codes(await pack(types, xml));
		expect(result).toContain('INVALID_RELATIONSHIP_ID');
		expect(result).toContain('DUPLICATE_RELATIONSHIP_ID');
		expect(result).toContain('EXTERNAL_TARGET_REQUIRES_MODE');
		expect(result).toContain('INVALID_TARGET_MODE');
	});

	it('checks relationship source and internal target invariants', async () => {
		const xml =
			'<Relationships><Relationship Id="rId1" Type="x" Target="../../../escape"/><Relationship Id="rId2" Type="x" Target="../_rels/x.xml.rels"/></Relationships>';
		const result = await codes(await pack(types, rels, { 'ppt/ghost/_rels/x.xml.rels': xml }));
		expect(result).toContain('ORPHAN_RELATIONSHIPS_PART');
		expect(result).toContain('INVALID_INTERNAL_TARGET');
		expect(result).toContain('RELATIONSHIP_TARGETS_RELATIONSHIPS_PART');
	});
});
