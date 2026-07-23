import { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { loadLegacyVmlDrawings } from './vml-drawing-loader';

const parser = new XMLParser({ ignoreAttributes: false });

/** Build a minimal JSZip-like archive from a path -> string map. */
function fakeZip(files: Record<string, string>): JSZip {
	return {
		file(path: string) {
			const content = files[path];
			if (content === undefined) {
				return null;
			}
			return { async: () => Promise.resolve(content) };
		},
	} as unknown as JSZip;
}

const RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const VML = `<xml xmlns:v="urn:schemas-microsoft-com:vml">
  <v:rect id="_x0000_s1026" style="position:absolute;left:10pt;top:20pt;width:100pt;height:50pt" fillcolor="#ff0000"/>
</xml>`;

describe('loadLegacyVmlDrawings', () => {
	it('parses shapes from a referenced legacy VML drawing part', async () => {
		const zip = fakeZip({
			'ppt/slides/_rels/slide1.xml.rels': RELS,
			'ppt/drawings/vmlDrawing1.vml': VML,
		});

		const elements = await loadLegacyVmlDrawings(
			zip,
			parser,
			'ppt/slides/slide1.xml',
			'ppt/slides/_rels/slide1.xml.rels',
		);

		expect(elements).toHaveLength(1);
		expect(elements[0].type).toBe('shape');
	});

	it('returns an empty array when there is no vmlDrawing relationship', async () => {
		const zip = fakeZip({
			'ppt/slides/_rels/slide1.xml.rels': `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`,
		});

		const elements = await loadLegacyVmlDrawings(
			zip,
			parser,
			'ppt/slides/slide1.xml',
			'ppt/slides/_rels/slide1.xml.rels',
		);

		expect(elements).toStrictEqual([]);
	});

	it('returns an empty array when the rels file is missing', async () => {
		const zip = fakeZip({});
		const elements = await loadLegacyVmlDrawings(
			zip,
			parser,
			'ppt/slides/slide1.xml',
			'ppt/slides/_rels/slide1.xml.rels',
		);
		expect(elements).toStrictEqual([]);
	});
});
