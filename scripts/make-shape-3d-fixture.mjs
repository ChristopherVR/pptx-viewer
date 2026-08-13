/**
 * Generates `e2e/fixtures/shape-3d-compound.pptx`, the deck behind
 * `e2e/shape-3d-compound-parity.spec.ts`.
 *
 * Nothing in `e2e/fixtures` exercised `a:spPr/a:sp3d`, `a:spPr/a:scene3d` or
 * `a:ln/@cmpd` (verified by scanning every fixture's slide XML), which is why
 * the Angular binding could ship with neither wired up and every suite stayed
 * green. It also carries a bullet paragraph whose only run is whitespace: the
 * paragraph builders disagree about whether that draws a marker.
 *
 * The package scaffolding (theme, master, layout, rels, content types) comes
 * from the SDK builder; only `ppt/slides/slide1.xml` is hand-authored, because
 * the features under test have no SDK surface and would otherwise have to
 * survive a model round-trip to reach the file.
 *
 *   bun run scripts/make-shape-3d-fixture.mjs
 */
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../e2e/fixtures/shape-3d-compound.pptx');

/** EMU per pixel at the 96dpi the rest of the fixtures are authored in. */
const PX = 9525;
const emu = (px) => Math.round(px * PX);

/** One `<p:sp>` with a preset geometry, a solid fill and an optional extra. */
function shape({ id, name, x, y, w, h, fill, line = '', extra = '', text = '' }) {
	return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${id}" name="${name}"/>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
      ${line}
      ${extra}
    </p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/>${text || '<a:p/>'}</p:txBody>
  </p:sp>`;
}

/**
 * A bevelled, extruded, camera-rotated block.
 *
 * `isometricTopUp` + a 24pt extrusion is the combination the shared
 * `getComputed3dStyle` turns into a `perspective` + `rotate3d` transform and a
 * stack of depth shadows, so a binding that never calls it paints a flat
 * rectangle with none of the three.
 */
const bevelled = shape({
	id: 2,
	name: 'Bevel Block',
	x: 60,
	y: 90,
	w: 220,
	h: 160,
	fill: '3366CC',
	extra: `<a:scene3d>
        <a:camera prst="isometricTopUp"/>
        <a:lightRig rig="threePt" dir="t"/>
      </a:scene3d>
      <a:sp3d extrusionH="304800" prstMaterial="metal">
        <a:bevelT w="76200" h="76200" prst="circle"/>
        <a:extrusionClr><a:srgbClr val="1F3F7A"/></a:extrusionClr>
      </a:sp3d>`,
});

/** A plain block, so a spec can prove the 3D one differs from a flat one. */
const flat = shape({ id: 3, name: 'Flat Block', x: 320, y: 90, w: 220, h: 160, fill: '3366CC' });

/** A 6pt double outline: one solid band in a binding that ignores `@cmpd`. */
const compound = shape({
	id: 4,
	name: 'Double Outline',
	x: 60,
	y: 300,
	w: 220,
	h: 120,
	fill: 'FFFFFF',
	line: `<a:ln w="76200" cmpd="dbl"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill></a:ln>`,
});

/** The same weight as a single line, for the same reason as `flat`. */
const single = shape({
	id: 5,
	name: 'Single Outline',
	x: 320,
	y: 300,
	w: 220,
	h: 120,
	fill: 'FFFFFF',
	line: `<a:ln w="76200" cmpd="sng"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill></a:ln>`,
});

/**
 * Three bulleted paragraphs, the middle one holding nothing but spaces.
 *
 * PowerPoint draws no marker on a paragraph with no visible text; shared
 * `buildParagraphs` implements that, and a hand-ported builder that resolves
 * the bullet off the first segment unconditionally draws a stray one.
 */
const bullets = shape({
	id: 6,
	name: 'Bullet List',
	x: 600,
	y: 90,
	w: 300,
	h: 240,
	fill: 'FFFFFF',
	text: `<a:p><a:pPr marL="285750" indent="-285750"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="en-US" sz="1800"/><a:t>Visible item</a:t></a:r></a:p>
      <a:p><a:pPr marL="285750" indent="-285750"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="en-US" sz="1800"/><a:t>   </a:t></a:r></a:p>
      <a:p><a:pPr marL="285750" indent="-285750"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="en-US" sz="1800"/><a:t>Another item</a:t></a:r></a:p>`,
});

const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${bevelled}
      ${flat}
      ${compound}
      ${single}
      ${bullets}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>
</p:sld>`;

// A one-slide deck from the SDK supplies every part except the slide itself.
const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Shape 3D and compound outlines',
	creator: 'pptx-viewer',
	width: 12_192_000,
	height: 6_858_000,
});
data.slides.push(createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' }).build());
const bytes = await handler.save(data.slides);

const zip = await JSZip.loadAsync(bytes);
zip.file('ppt/slides/slide1.xml', slideXml);
const patched = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
await writeFile(out, patched);
console.log(`wrote ${out} (${patched.byteLength} bytes)`);
