/**
 * Scratch tooling (not committed): generates the FULL 32-condition fixture
 * for the item-2 (metal/circle specular-masking) re-score
 * (docs/guide/limitations.md "3-D shapes and scenes" row): `circle`/`angle`/
 * `hardEdge`/`softRound` x `matte`/`metal` x `a:lightRig/@dir`
 * `t`/`r`/`b`/`l`, `threePt` rig, `orthographicFront` camera, a 24pt
 * `a:bevelT`, matching the ORIGINAL 32-condition campaign's geometry
 * (`visual-3d-bevel-lighting.ts`'s module doc comment) -- a genuine 4
 * -direction re-run this time, not the dir="t"-only symmetry shortcut the
 * first pass of this campaign used.
 *
 *   bun run scripts/make-bevel-material-fixture.mjs <outDir>
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

const outDir = process.argv[2] ?? '.';
const pptxOut = resolve(outDir, 'bevel-material-com.pptx');
const jsonOut = resolve(outDir, 'bevel-material-com.json');

const PX_PER_IN = 914400;
const emuIn = (inches) => Math.round(inches * PX_PER_IN);
const emuPt = (pt) => Math.round(pt * 12700);

const PROFILES = ['circle', 'angle', 'hardEdge', 'softRound'];
const MATERIALS = ['matte', 'metal'];
const DIRECTIONS = ['t', 'r', 'b', 'l'];
const DEPTH_PT = 24;
const SIZE_IN = 1.0;
const MARGIN_IN = 0.15;
const START_X_IN = 0.3;
const START_Y_IN = 0.3;
const COLS = 8;

function shapeXml({ id, name, xIn, yIn, sizeIn, profile, material, dir }) {
	const depthEmu = emuPt(DEPTH_PT);
	return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${id}" name="${name}"/>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${emuIn(xIn)}" y="${emuIn(yIn)}"/><a:ext cx="${emuIn(sizeIn)}" cy="${emuIn(sizeIn)}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="808080"/></a:solidFill>
      <a:ln><a:noFill/></a:ln>
      <a:scene3d>
        <a:camera prst="orthographicFront"/>
        <a:lightRig rig="threePt" dir="${dir}"/>
      </a:scene3d>
      <a:sp3d prstMaterial="${material}">
        <a:bevelT w="${depthEmu}" h="${depthEmu}" prst="${profile}"/>
      </a:sp3d>
    </p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
  </p:sp>`;
}

const shapes = [];
const meta = [];
let i = 0;
for (const profile of PROFILES) {
	for (const material of MATERIALS) {
		for (const dir of DIRECTIONS) {
			const col = i % COLS;
			const row = Math.floor(i / COLS);
			const xIn = START_X_IN + col * (SIZE_IN + MARGIN_IN);
			const yIn = START_Y_IN + row * (SIZE_IN + MARGIN_IN);
			const id = 100 + i;
			shapes.push(
				shapeXml({
					id,
					name: `${profile} ${material} ${dir}`,
					xIn,
					yIn,
					sizeIn: SIZE_IN,
					profile,
					material,
					dir,
				}),
			);
			meta.push({
				profile,
				material,
				dir,
				id,
				centerXIn: xIn + SIZE_IN / 2,
				centerYIn: yIn + SIZE_IN / 2,
				topYIn: yIn,
				bottomYIn: yIn + SIZE_IN,
				leftXIn: xIn,
				rightXIn: xIn + SIZE_IN,
			});
			i++;
		}
	}
}

const slideWidthIn = 13.333;
const slideHeightIn = 7.5;
const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${shapes.join('\n')}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>
</p:sld>`;

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Bevel material specular-mask COM measurement (4 directions)',
	creator: 'pptx-viewer scratch tooling',
	width: emuIn(slideWidthIn),
	height: emuIn(slideHeightIn),
});
data.slides.push(createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' }).build());
const bytes = await handler.save(data.slides);
const zip = await JSZip.loadAsync(bytes);
zip.file('ppt/slides/slide1.xml', slideXml);
const patched = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
await writeFile(pptxOut, patched);
await writeFile(jsonOut, JSON.stringify({ slideWidthIn, slideHeightIn, shapes: meta }, null, 2));
console.log(`wrote ${pptxOut} (${patched.byteLength} bytes), ${meta.length} shapes`);
console.log(`wrote ${jsonOut}`);
