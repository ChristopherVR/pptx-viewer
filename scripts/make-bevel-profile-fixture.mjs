/**
 * Scratch tooling (not committed): generates a .pptx fixture with 2 slides
 * (one per bevel depth) x 12 `a:bevelT/@prst` profiles each, a mid-grey
 * square per profile, `threePt` light rig / `dir="t"`, `orthographicFront`
 * camera, Depth=0 -- for the bevel-profile-height-map COM measurement
 * campaign (docs/guide/limitations.md "3-D shapes and scenes" row, item 1).
 *
 * Writes the .pptx plus a sidecar JSON describing each shape's slide index,
 * profile, depth (pt), and geometry in INCHES (center x, top y, size) so the
 * sampler script can convert to pixel coordinates without re-deriving the
 * layout.
 *
 *   bun run scripts/make-bevel-profile-fixture.mjs <outDir>
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

const outDir = process.argv[2] ?? '.';
const pptxOut = resolve(outDir, 'bevel-profile-com.pptx');
const jsonOut = resolve(outDir, 'bevel-profile-com.json');

const PX_PER_IN = 914400;
const emuIn = (inches) => Math.round(inches * PX_PER_IN);
const emuPt = (pt) => Math.round(pt * 12700);

const PROFILES = [
	'relaxedInset',
	'circle',
	'slope',
	'cross',
	'angle',
	'softRound',
	'convex',
	'coolSlant',
	'divot',
	'riblet',
	'hardEdge',
	'artDeco',
];
const DEPTHS_PT = [6, 24];

const SIZE_IN = 1.6;
const MARGIN_IN = 0.3;
const START_X_IN = 0.5;
const START_Y_IN = 0.5;
const COLS = 4;

function shapeXml({ id, name, xIn, yIn, sizeIn, profile, depthPt }) {
	const depthEmu = emuPt(depthPt);
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
        <a:lightRig rig="threePt" dir="t"/>
      </a:scene3d>
      <a:sp3d prstMaterial="matte">
        <a:bevelT w="${depthEmu}" h="${depthEmu}" prst="${profile}"/>
      </a:sp3d>
    </p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
  </p:sp>`;
}

function buildSlide(depthPt, idBase) {
	const shapes = [];
	const meta = [];
	PROFILES.forEach((profile, i) => {
		const col = i % COLS;
		const row = Math.floor(i / COLS);
		const xIn = START_X_IN + col * (SIZE_IN + MARGIN_IN);
		const yIn = START_Y_IN + row * (SIZE_IN + MARGIN_IN);
		const id = idBase + i;
		shapes.push(
			shapeXml({
				id,
				name: `Bevel ${profile} ${depthPt}pt`,
				xIn,
				yIn,
				sizeIn: SIZE_IN,
				profile,
				depthPt,
			}),
		);
		meta.push({
			profile,
			depthPt,
			id,
			centerXIn: xIn + SIZE_IN / 2,
			topYIn: yIn,
			leftXIn: xIn,
			sizeIn: SIZE_IN,
		});
	});
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
	return { slideXml, meta };
}

const slideWidthIn = 13.333;
const slideHeightIn = 7.5;

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Bevel profile COM measurement',
	creator: 'pptx-viewer scratch tooling',
	width: emuIn(slideWidthIn),
	height: emuIn(slideHeightIn),
});
data.slides.push(createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' }).build());
data.slides.push(createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' }).build());
const bytes = await handler.save(data.slides);

const zip = await JSZip.loadAsync(bytes);
const allMeta = [];
DEPTHS_PT.forEach((depthPt, slideIdx) => {
	const { slideXml, meta } = buildSlide(depthPt, 100 + slideIdx * 100);
	zip.file(`ppt/slides/slide${slideIdx + 1}.xml`, slideXml);
	meta.forEach((m) => allMeta.push({ ...m, slideIndex: slideIdx + 1 }));
});
const patched = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
await writeFile(pptxOut, patched);
await writeFile(jsonOut, JSON.stringify({ slideWidthIn, slideHeightIn, shapes: allMeta }, null, 2));
console.log(`wrote ${pptxOut} (${patched.byteLength} bytes)`);
console.log(`wrote ${jsonOut}`);
