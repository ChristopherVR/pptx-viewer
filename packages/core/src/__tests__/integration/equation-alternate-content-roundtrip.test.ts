import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Core round-trip audit 2026-09-24, item 1: equations wiped on slide rewrite.
 *
 * Before the fix, `processMathElement` stored only the resolved inner math
 * node as `TextSegment.equationXml`, discarding whatever top-level element
 * actually carried it in the source (`a14:m`, or the whole
 * `mc:AlternateContent` Choice/Fallback envelope). `classifyParagraphChild`
 * then had no way to tell what it had lost, and re-emitted either a bare
 * `m:oMathPara`/`m:oMath` (dropping the `a14:m` wrapper) or, for an
 * AlternateContent-wrapped equation, a similarly collapsed shape that dropped
 * the `mc:Fallback` branch entirely. Either way, a dirty save of a slide
 * whose equations were never touched still corrupted them.
 *
 * After the fix, the ORIGINAL top-level paragraph child is captured verbatim
 * on parse as `TextSegment.equationSourceXml` (see
 * `PptxHandlerRuntimeShapeParagraphContentParsing.processMathElement`), and
 * the save path prefers it over the resolved `equationXml` used for
 * rendering, so an untouched equation re-emits byte-for-byte.
 */
describe('equation mc:AlternateContent / a14:m round-trip', () => {
	async function buildDeckWithSlideXml(slideXml: string): Promise<Uint8Array> {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(createSlide('Blank').build());
		const baseBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(baseBytes);
		zip.file('ppt/slides/slide1.xml', slideXml);
		return zip.generateAsync({ type: 'uint8array' });
	}

	it('preserves mc:Choice + mc:Fallback around an untouched a14:m equation on dirty save', async () => {
		const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
	xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
	xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
	xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main">
	<p:cSld>
		<p:spTree>
			<p:nvGrpSpPr>
				<p:cNvPr id="1" name=""/>
				<p:cNvGrpSpPr/>
				<p:nvPr/>
			</p:nvGrpSpPr>
			<p:grpSpPr>
				<a:xfrm>
					<a:off x="0" y="0"/>
					<a:ext cx="0" cy="0"/>
					<a:chOff x="0" y="0"/>
					<a:chExt cx="0" cy="0"/>
				</a:xfrm>
			</p:grpSpPr>
			<p:sp>
				<p:nvSpPr>
					<p:cNvPr id="10" name="Equation Shape"/>
					<p:cNvSpPr txBox="1"/>
					<p:nvPr/>
				</p:nvSpPr>
				<p:spPr>
					<a:xfrm><a:off x="914400" y="914400"/><a:ext cx="1828800" cy="914400"/></a:xfrm>
					<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
				</p:spPr>
				<p:txBody>
					<a:bodyPr/>
					<a:lstStyle/>
					<a:p>
						<mc:AlternateContent>
							<mc:Choice xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" Requires="a14">
								<a14:m>
									<m:oMathPara>
										<m:oMath>
											<m:r><m:t>x</m:t></m:r>
										</m:oMath>
									</m:oMathPara>
								</a14:m>
							</mc:Choice>
							<mc:Fallback>
								<a:r><a:rPr lang="en-US" i="1"/><a:t>x</a:t></a:r>
							</mc:Fallback>
						</mc:AlternateContent>
					</a:p>
				</p:txBody>
			</p:sp>
		</p:spTree>
	</p:cSld>
</p:sld>`;
		const patchedBytes = await buildDeckWithSlideXml(slideXml);

		const handler = new PptxHandler();
		const reloaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		const shape = reloaded.slides[0]!.elements.find((e) => (e.name ?? '') === 'Equation Shape');
		expect(shape, 'equation shape was not parsed').toBeDefined();
		const equationSegment = (
			shape as { textSegments?: { equationXml?: unknown }[] }
		).textSegments?.find((s) => s.equationXml);
		expect(equationSegment, 'no segment carried equationXml').toBeDefined();

		// Force-dirty save without editing the equation.
		reloaded.slides[0]!.isDirty = true;
		const savedBytes = await handler.save(reloaded.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedSlideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		// The envelope must survive whole: Choice AND Fallback both.
		expect(savedSlideXml).toContain('mc:AlternateContent');
		expect(savedSlideXml).toContain('mc:Choice');
		expect(savedSlideXml).toContain('mc:Fallback');
		expect(savedSlideXml).toMatch(/<mc:Choice[^>]*Requires="a14"/);
		expect(savedSlideXml).toContain('a14:m');
		expect(savedSlideXml).toContain('m:oMathPara');
		expect(savedSlideXml).toContain('m:oMath');
		// The Fallback's plain-text branch must not be dropped.
		expect(savedSlideXml).toMatch(/<a:t>x<\/a:t>/);
		// Neither branch is duplicated: exactly one a14:m and one mc:Fallback.
		expect(savedSlideXml.match(/<a14:m>/g) || []).toHaveLength(1);
		expect(savedSlideXml.match(/<mc:Fallback>/g) || []).toHaveLength(1);

		// Re-loading must still find the equation.
		const handler2 = new PptxHandler();
		const reloaded2 = await handler2.load(savedBytes.buffer as ArrayBuffer);
		const shape2 = reloaded2.slides[0]!.elements.find((e) => (e.name ?? '') === 'Equation Shape');
		const equationSegment2 = (
			shape2 as { textSegments?: { equationXml?: unknown }[] } | undefined
		)?.textSegments?.find((s) => s.equationXml);
		expect(equationSegment2, 'equation did not survive a second round-trip').toBeDefined();
	});

	it('preserves a bare a14:m equation (no mc:AlternateContent wrapper) on dirty save', async () => {
		// Matches the real-world shape used by e2e/fixtures/Mathematical_Equations_*:
		// a14:m appears directly as an a:p child with no AlternateContent envelope.
		const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
	xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
	xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
	xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
	xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main">
	<p:cSld>
		<p:spTree>
			<p:nvGrpSpPr>
				<p:cNvPr id="1" name=""/>
				<p:cNvGrpSpPr/>
				<p:nvPr/>
			</p:nvGrpSpPr>
			<p:grpSpPr>
				<a:xfrm>
					<a:off x="0" y="0"/>
					<a:ext cx="0" cy="0"/>
					<a:chOff x="0" y="0"/>
					<a:chExt cx="0" cy="0"/>
				</a:xfrm>
			</p:grpSpPr>
			<p:sp>
				<p:nvSpPr>
					<p:cNvPr id="11" name="Bare Equation Shape"/>
					<p:cNvSpPr txBox="1"/>
					<p:nvPr/>
				</p:nvSpPr>
				<p:spPr>
					<a:xfrm><a:off x="914400" y="914400"/><a:ext cx="1828800" cy="914400"/></a:xfrm>
					<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
				</p:spPr>
				<p:txBody>
					<a:bodyPr/>
					<a:lstStyle/>
					<a:p>
						<a14:m>
							<m:oMathPara>
								<m:oMath>
									<m:r><m:t>y</m:t></m:r>
								</m:oMath>
							</m:oMathPara>
						</a14:m>
					</a:p>
				</p:txBody>
			</p:sp>
		</p:spTree>
	</p:cSld>
</p:sld>`;
		const patchedBytes = await buildDeckWithSlideXml(slideXml);

		const handler = new PptxHandler();
		const reloaded = await handler.load(patchedBytes.buffer as ArrayBuffer);
		const shape = reloaded.slides[0]!.elements.find(
			(e) => (e.name ?? '') === 'Bare Equation Shape',
		);
		expect(shape, 'bare equation shape was not parsed').toBeDefined();

		reloaded.slides[0]!.isDirty = true;
		const savedBytes = await handler.save(reloaded.slides);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedSlideXml = await savedZip.file('ppt/slides/slide1.xml')!.async('string');

		// The a14:m wrapper must survive: no mc:AlternateContent was ever
		// authored, so none should be invented, and the equation must not
		// collapse to a bare m:oMathPara/m:oMath at the paragraph level.
		expect(savedSlideXml).toContain('a14:m');
		expect(savedSlideXml).not.toContain('mc:AlternateContent');
		expect(savedSlideXml.match(/<a14:m>/g) || []).toHaveLength(1);
		expect(savedSlideXml).toContain('m:oMathPara');
		expect(savedSlideXml).toContain('m:oMath');

		const handler2 = new PptxHandler();
		const reloaded2 = await handler2.load(savedBytes.buffer as ArrayBuffer);
		const shape2 = reloaded2.slides[0]!.elements.find(
			(e) => (e.name ?? '') === 'Bare Equation Shape',
		);
		expect(shape2, 'bare equation did not survive a second round-trip').toBeDefined();
	});
});
