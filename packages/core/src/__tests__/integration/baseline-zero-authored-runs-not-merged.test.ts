/**
 * `hasMixedTextStyles` (via `textStylesEqual`) never compared an explicitly
 * authored `<a:rPr baseline="0"/>` against a run that omitted the attribute
 * entirely, because parse treated both as "no baseline" (`style.baseline`
 * stays `undefined` for a zero shift, matching how every other numeric style
 * field collapses 0 and "unset"). Two runs differing ONLY by that attribute
 * therefore looked identical, so `areTextSegmentsUniform` reported them
 * uniform and the save path collapsed the whole paragraph to its flat text
 * string, merging the two runs' text into one and dropping every run-level
 * property the plain-string fallback cannot carry (measured on
 * `solution-explorer.pptx`, slide 11: "---- Challenge 1" + " -----" merged
 * into a single run, taking the second run's `a:effectLst` and part of its
 * own `a:rPr` with it).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="10" name="Title 1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5143500" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB" sz="4400" kern="1200" dirty="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:effectLst/><a:latin typeface="Aptos Display"/></a:rPr><a:t>---- Challenge 1</a:t></a:r><a:r><a:rPr lang="en-GB" sz="4400" kern="1200" baseline="0" dirty="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:effectLst/><a:latin typeface="Aptos Display"/></a:rPr><a:t> -----</a:t></a:r><a:endParaRPr lang="en-GB" dirty="0"/></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/linked-textbox.pptx', import.meta.url),
);

describe('two runs differing only by an authored baseline="0" are not merged', () => {
	it('keeps both runs, their text split, and the authored baseline="0"', async () => {
		const zip = await JSZip.loadAsync(readFileSync(fixture));
		zip.file('ppt/slides/slide1.xml', SLIDE_XML);
		zip.file('ppt/slides/_rels/slide1.xml.rels', SLIDE_RELS_XML);
		const bytes = await zip.generateAsync({ type: 'uint8array' });
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);

		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const savedXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		// The two runs' text must stay split, not merged into one run.
		expect(savedXml).toContain('<a:t>---- Challenge 1</a:t>');
		expect(savedXml).toContain('<a:t> -----</a:t>');
		expect(savedXml).not.toContain('<a:t>---- Challenge 1 -----</a:t>');

		// The explicitly authored baseline="0" survives on its own run.
		expect(savedXml).toContain('baseline="0"');

		// Each run's explicit empty `a:effectLst` (a "no effects" override that
		// blocks an inherited shadow) survives the rewrite too.
		expect(savedXml.match(/<a:effectLst(\/>|><\/a:effectLst>)/g)).toHaveLength(2);
	});
});
