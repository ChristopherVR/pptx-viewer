/**
 * Generates `group-drill.pptx` for `group-drill-in.spec.ts`: one slide with a
 * group ("Cards") of two titled cards side by side, the shape of a diagram an
 * author (or an agent) builds and then wants to edit card by card.
 *
 * Built on `linked-textbox.pptx` (a minimal valid package) with its slide 1
 * replaced, the same way `packages/shared/src/render/group-drill.roundtrip.test.ts`
 * authors its slide.
 *
 * Run with: bun run e2e/fixtures/generate-group-drill-fixture.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip');

const EMU_PER_PX = 9525;
const px = (v: number) => Math.round(v * EMU_PER_PX);

const card = (id: number, name: string, x: number, title: string, body: string) =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${px(x)}" y="${px(240)}"/><a:ext cx="${px(420)}" cy="${px(200)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FDE7DA"/></a:solidFill></p:spPr><p:txBody><a:bodyPr lIns="182880" tIns="182880" anchor="t"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2800" b="1"/><a:t>${title}</a:t></a:r></a:p><a:p><a:r><a:rPr lang="en-US" sz="1800"/><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp>`;

// The group spans x 160..1100 px, y 240..440 px; child space equals its own.
const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="Cards"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${px(160)}" y="${px(240)}"/><a:ext cx="${px(940)}" cy="${px(200)}"/><a:chOff x="${px(160)}" y="${px(240)}"/><a:chExt cx="${px(940)}" cy="${px(200)}"/></a:xfrm></p:grpSpPr>
${card(11, 'Card Migration', 160, 'Migration', 'Teradata to Huawei DWS')}
${card(12, 'Card Scale', 680, 'Scale', 'Up to 10 PB, 2048 nodes')}
</p:grpSp>
</p:spTree></p:cSld></p:sld>`;

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const zip = await JSZip.loadAsync(readFileSync(here('./linked-textbox.pptx')));
zip.file('ppt/slides/slide1.xml', SLIDE_XML);
writeFileSync(here('./group-drill.pptx'), await zip.generateAsync({ type: 'nodebuffer' }));
console.log('wrote group-drill.pptx');
