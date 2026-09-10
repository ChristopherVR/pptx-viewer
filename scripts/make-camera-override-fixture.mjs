/**
 * Generates `e2e/fixtures/shape-3d-camera-override.pptx`, the deck behind
 * `e2e/shape-3d-camera-override-parity.spec.ts`.
 *
 * Nothing in `e2e/fixtures` exercised an explicit `a:camera/a:rot` (lat/lon/
 * rev) override before this: every `a:scene3d` fixture in the corpus used a
 * bare `a:camera/@prst` preset. `getCameraTransform`'s "explicit override"
 * branch (`visual-3d-camera.ts`) used to fall back to a hand-tuned
 * `rotateX`/`rotateY` + centred CSS `perspective()` approximation for this
 * case; it now builds a COM-measured `matrix3d` via
 * `visual-3d-camera-parametric.ts`. This fixture is what lets
 * `shape-3d-camera-override-parity.spec.ts` assert the five bindings emit
 * the SAME computed transform for it.
 *
 * IMPORTANT (discovered empirically via PowerPoint COM while building this
 * fixture): `a:camera/@prst` is a REQUIRED attribute in real PowerPoint,
 * contrary to what this codebase's own writer (`save-shape-effects.ts`'s
 * `buildScene3dCamera`, which conditionally sets `@_prst` only when a preset
 * is modelled) implies is optional - a real deck always carries SOME preset
 * name, with `a:rot`/`@fov`/`@zoom` as an ADDITIONAL override on top of it,
 * not a replacement for it. Every shape below therefore carries a real
 * `prst` alongside its `a:rot` override, matching how PowerPoint itself
 * would author this (and matching what `getCameraTransform` already
 * expected: `hasExplicitOverride` fires whenever `cameraRotX/Y/Z`/
 * `cameraFieldOfView`/`cameraZoom` is set, REGARDLESS of whether a preset is
 * also present, and the override is treated as the camera's absolute pose).
 * `a:scene3d` also requires BOTH `a:camera` and `a:lightRig` children - a
 * camera-only `a:scene3d` also produced a corrupted/unreadable file in COM.
 *
 *   bun run scripts/make-camera-override-fixture.mjs
 */
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../e2e/fixtures/shape-3d-camera-override.pptx');

const PX = 9525;
const emu = (px) => Math.round(px * PX);
const deg60k = (deg) => Math.round(deg * 60000);

function shape({ id, name, x, y, w, h, fill, camera }) {
	return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
      <a:ln><a:noFill/></a:ln>
      ${camera}
    </p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
  </p:sp>`;
}

/**
 * COM-measured (2026-09, real PowerPoint `Slide.Export`, see
 * `visual-3d-camera-parametric.ts`'s module doc comment): a pure single-axis
 * `lon` override, sub-pixel-accurate against the new parametric model.
 */
const yawOnly = shape({
	id: 2,
	name: 'Explicit Yaw Override',
	x: 60,
	y: 90,
	w: 200,
	h: 200,
	fill: '3366CC',
	camera: `<a:scene3d>
        <a:camera prst="orthographicFront"><a:rot lat="0" lon="${deg60k(25)}" rev="0"/></a:camera>
        <a:lightRig rig="threePt" dir="t"/>
      </a:scene3d>`,
});

/**
 * A combined (lat + lon + rev) override: COM-measured to carry a larger
 * (~29% relative) residual than the single-axis case above - see the same
 * module doc comment's comparison table. Still exercised here so the parity
 * spec at least confirms the five bindings AGREE with each other (even where
 * they are all equally approximate against PowerPoint), which is the
 * cross-binding contract this spec is actually responsible for.
 */
const combined = shape({
	id: 3,
	name: 'Explicit Combined Override',
	x: 320,
	y: 90,
	w: 200,
	h: 200,
	fill: '3366CC',
	camera: `<a:scene3d>
        <a:camera prst="orthographicFront"><a:rot lat="${deg60k(35.26)}" lon="${deg60k(45)}" rev="${deg60k(45)}"/></a:camera>
        <a:lightRig rig="threePt" dir="t"/>
      </a:scene3d>`,
});

/** A flat, un-rotated explicit override (lat=lon=rev=0): must render as an identity, same as `orthographicFront` alone. */
const identityOverride = shape({
	id: 4,
	name: 'Explicit Identity Override',
	x: 580,
	y: 90,
	w: 200,
	h: 200,
	fill: '3366CC',
	camera: `<a:scene3d>
        <a:camera prst="orthographicFront"><a:rot lat="1" lon="0" rev="0"/></a:camera>
        <a:lightRig rig="threePt" dir="t"/>
      </a:scene3d>`,
});

/** A flat, camera-less control shape, same authored size as the others, to measure the override shapes' shrink/skew against. */
const flatControl = shape({
	id: 5,
	name: 'Flat Control',
	x: 60,
	y: 340,
	w: 200,
	h: 200,
	fill: '999999',
	camera: '',
});

const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${yawOnly}
      ${combined}
      ${identityOverride}
      ${flatControl}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr>
</p:sld>`;

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Explicit camera override',
	creator: 'pptx-viewer',
	width: 9_144_000,
	height: 6_858_000,
});
data.slides.push(createSlide('Blank').setBackground({ type: 'solid', color: '#ffffff' }).build());
const bytes = await handler.save(data.slides);

const zip = await JSZip.loadAsync(bytes);
zip.file('ppt/slides/slide1.xml', slideXml);
const patched = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
await writeFile(out, patched);
console.log(`wrote ${out} (${patched.byteLength} bytes)`);
