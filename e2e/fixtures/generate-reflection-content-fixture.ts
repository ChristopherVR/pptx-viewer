/**
 * Generates `reflection-content.pptx`: `a:reflection` (and group-level
 * shadow/glow) cases the render pipeline used to mirror incompletely.
 *
 *   ReflectedTextShape    a filled autoshape with a text run, `a:effectLst/a:reflection`
 *                          on `p:spPr` - every binding used to mirror the blue
 *                          fill only; the "Reflected text" run never appeared
 *                          in the mirror.
 *   ReflectedGroup         a `p:grpSp` whose OWN `p:grpSpPr/a:effectLst/a:reflection`
 *                          mirrors the group, containing one filled child shape
 *                          with its own text run ("Grouped child") - a group has
 *                          no `shapeStyle` of its own, so this reflection did not
 *                          render AT ALL before (not even the fill), since the
 *                          renderer's `hasShapeProperties` gate excluded groups
 *                          entirely.
 *   ShadowedGlowedGroup    a `p:grpSp` whose `p:grpSpPr/a:effectLst` carries an
 *                          `a:outerShdw` AND an `a:glow` (no reflection), around
 *                          one filled child ("Shadow glow child"). Group-level
 *                          shadow/glow/soft-edge were unsupported entirely
 *                          before this fixture: the group composite never
 *                          picked up a CSS `filter: drop-shadow(...)`.
 *   NestedReflectionGroup  a `p:grpSp` with its OWN `a:effectLst/a:reflection`,
 *                          containing one child shape that ALSO carries its own
 *                          `a:effectLst/a:reflection` ("Nested child"). PowerPoint
 *                          composites the group's reflection from the group's
 *                          fully-rendered content, which already includes the
 *                          child's own reflection, so the child's mirror must
 *                          appear a SECOND time, nested inside the group's own
 *                          mirror - this was never double-mirrored before.
 *
 * `PptxHandler.createBlank` supplies the whole package (theme, master, layout,
 * content types, rels) around a hand-authored slide, mirroring
 * `generate-text-body-fixture.ts`.
 *
 * Re-runnable; `global-setup.ts` invokes it before every Playwright run.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EMU_PER_PT = 12700;

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

/** Marker text; specs locate elements by these. */
export const REFLECTION_SHAPE_TEXT = 'Reflected text';
export const REFLECTION_GROUP_CHILD_TEXT = 'Grouped child';
export const SHADOW_GLOW_GROUP_CHILD_TEXT = 'Shadow glow child';
export const NESTED_REFLECTION_CHILD_TEXT = 'Nested child';
/** `p:cNvPr/@name` for the elements under test. */
export const REFLECTED_TEXT_SHAPE_NAME = 'ReflectedTextShape';
export const REFLECTED_GROUP_NAME = 'ReflectedGroup';
export const SHADOW_GLOW_GROUP_NAME = 'ShadowedGlowedGroup';
export const NESTED_REFLECTION_GROUP_NAME = 'NestedReflectionGroup';

/** A plain 24pt Arial run. */
function run(text: string): string {
	return (
		`<a:r><a:rPr lang="en-US" sz="2400" dirty="0"><a:latin typeface="Arial"/>` +
		`<a:cs typeface="Arial"/></a:rPr><a:t>${text}</a:t></a:r>`
	);
}

/** `a:reflection` with no scale/skew/rotation/fade/anchor: the plain default case. */
const REFLECTION =
	'<a:effectLst><a:reflection blurRad="0" stA="60000" endA="0" endPos="100000" dist="0" ' +
	'dir="5400000" fadeDir="5400000" rotWithShape="0"/></a:effectLst>';

/** An outer shadow plus a glow, both painted on the group's composite raster. */
const SHADOW_AND_GLOW =
	'<a:effectLst>' +
	'<a:outerShdw blurRad="63500" dist="38100" dir="2700000" rotWithShape="0">' +
	'<a:srgbClr val="000000"><a:alpha val="60000"/></a:srgbClr></a:outerShdw>' +
	'<a:glow rad="63500"><a:srgbClr val="FFC000"><a:alpha val="80000"/></a:srgbClr></a:glow>' +
	'</a:effectLst>';

/**
 * A filled autoshape with a text run and its own `a:effectLst/a:reflection`.
 * Blue fill so the mirrored FILL is easy to assert alongside the mirrored TEXT.
 */
function reflectedTextShapeXml(id: number): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${REFLECTED_TEXT_SHAPE_NAME}"/>` +
		`<p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${60 * EMU_PER_PT}" y="${40 * EMU_PER_PT}"/>` +
		`<a:ext cx="${240 * EMU_PER_PT}" cy="${80 * EMU_PER_PT}"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
		`<a:solidFill><a:srgbClr val="2255AA"/></a:solidFill>${REFLECTION}</p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p>${run(REFLECTION_SHAPE_TEXT)}</a:p></p:txBody></p:sp>`
	);
}

/**
 * A group whose own `p:grpSpPr/a:effectLst/a:reflection` mirrors the group,
 * containing one filled child shape with its own text run. `chOff`/`chExt`
 * match `off`/`ext` 1:1, so the child's authored offset is also its
 * group-local rendered position (no scale factor to account for).
 */
function reflectedGroupXml(groupId: number, childId: number): string {
	const groupX = 60 * EMU_PER_PT;
	const groupY = 160 * EMU_PER_PT;
	const groupW = 240 * EMU_PER_PT;
	const groupH = 100 * EMU_PER_PT;
	const child =
		`<p:sp><p:nvSpPr><p:cNvPr id="${childId}" name="ReflectedGroupChild"/>` +
		`<p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${20 * EMU_PER_PT}" y="${20 * EMU_PER_PT}"/>` +
		`<a:ext cx="${200 * EMU_PER_PT}" cy="${60 * EMU_PER_PT}"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
		`<a:solidFill><a:srgbClr val="228833"/></a:solidFill></p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p>${run(REFLECTION_GROUP_CHILD_TEXT)}</a:p></p:txBody></p:sp>`;
	return (
		`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${groupId}" name="${REFLECTED_GROUP_NAME}"/>` +
		`<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
		`<p:grpSpPr><a:xfrm><a:off x="${groupX}" y="${groupY}"/><a:ext cx="${groupW}" cy="${groupH}"/>` +
		`<a:chOff x="0" y="0"/><a:chExt cx="${groupW}" cy="${groupH}"/></a:xfrm>${REFLECTION}</p:grpSpPr>` +
		`${child}</p:grpSp>`
	);
}

/**
 * A group whose `p:grpSpPr/a:effectLst` carries an `a:outerShdw` AND an
 * `a:glow` (no reflection), around one filled child. Group-level shadow/glow
 * resolve onto the group's own composite raster as a CSS `filter:
 * drop-shadow(...)`, never a `box-shadow` (a group has no box of its own to
 * shadow).
 */
function shadowedGlowedGroupXml(groupId: number, childId: number): string {
	const groupX = 320 * EMU_PER_PT;
	const groupY = 40 * EMU_PER_PT;
	const groupW = 240 * EMU_PER_PT;
	const groupH = 100 * EMU_PER_PT;
	const child =
		`<p:sp><p:nvSpPr><p:cNvPr id="${childId}" name="ShadowGlowGroupChild"/>` +
		`<p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${20 * EMU_PER_PT}" y="${20 * EMU_PER_PT}"/>` +
		`<a:ext cx="${200 * EMU_PER_PT}" cy="${60 * EMU_PER_PT}"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
		`<a:solidFill><a:srgbClr val="AA2288"/></a:solidFill></p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p>${run(SHADOW_GLOW_GROUP_CHILD_TEXT)}</a:p></p:txBody></p:sp>`;
	return (
		`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${groupId}" name="${SHADOW_GLOW_GROUP_NAME}"/>` +
		`<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
		`<p:grpSpPr><a:xfrm><a:off x="${groupX}" y="${groupY}"/><a:ext cx="${groupW}" cy="${groupH}"/>` +
		`<a:chOff x="0" y="0"/><a:chExt cx="${groupW}" cy="${groupH}"/></a:xfrm>${SHADOW_AND_GLOW}</p:grpSpPr>` +
		`${child}</p:grpSp>`
	);
}

/**
 * A group with its OWN `a:effectLst/a:reflection`, containing one child shape
 * that ALSO carries its own `a:effectLst/a:reflection`. PowerPoint composites
 * the group's reflection from the group's fully-rendered content, which
 * already includes the child's own reflection, so the child's mirror must
 * appear a SECOND time, nested inside the group's own mirror.
 */
function nestedReflectionGroupXml(groupId: number, childId: number): string {
	const groupX = 320 * EMU_PER_PT;
	const groupY = 160 * EMU_PER_PT;
	const groupW = 240 * EMU_PER_PT;
	const groupH = 100 * EMU_PER_PT;
	const child =
		`<p:sp><p:nvSpPr><p:cNvPr id="${childId}" name="NestedReflectionChild"/>` +
		`<p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${20 * EMU_PER_PT}" y="${20 * EMU_PER_PT}"/>` +
		`<a:ext cx="${200 * EMU_PER_PT}" cy="${60 * EMU_PER_PT}"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
		`<a:solidFill><a:srgbClr val="AA8822"/></a:solidFill>${REFLECTION}</p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p>${run(NESTED_REFLECTION_CHILD_TEXT)}</a:p></p:txBody></p:sp>`;
	return (
		`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${groupId}" name="${NESTED_REFLECTION_GROUP_NAME}"/>` +
		`<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
		`<p:grpSpPr><a:xfrm><a:off x="${groupX}" y="${groupY}"/><a:ext cx="${groupW}" cy="${groupH}"/>` +
		`<a:chOff x="0" y="0"/><a:chExt cx="${groupW}" cy="${groupH}"/></a:xfrm>${REFLECTION}</p:grpSpPr>` +
		`${child}</p:grpSp>`
	);
}

function slideXml(): string {
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		`<p:sld ${NS}><p:cSld><p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>',
		'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		reflectedTextShapeXml(2),
		reflectedGroupXml(3, 4),
		shadowedGlowedGroupXml(5, 6),
		nestedReflectionGroupXml(7, 8),
		'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
	].join('');
}

export async function generateReflectionContentFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Reflection Content Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', slideXml());

	const outPath = resolve(__dirname, 'reflection-content.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-reflection-content-fixture.ts')) {
	generateReflectionContentFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
