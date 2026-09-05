/**
 * Generates `preset-text-insets.pptx`: seven identically-sized boxes (a plain
 * `rect` control plus `chevron`, `homePlate`, `star5`, `pie`, `flowChartDecision`
 * and `actionButtonHome`), each holding the same long, left-aligned, wrapped,
 * top-anchored body text.
 *
 * WHY these particular presets: each carries a non-trivial ECMA-376 `<a:rect>`
 * text-inset override (see `packages/core/src/core/geometry/preset-text-rect-
 * *.ts` and the older hand-derived `preset-text-rect-table.ts`), so its text
 * must sit further from the box's left/top edge than the plain `rect` control,
 * which has none. `actionButtonHome` is the one exception on record: ECMA's own
 * table gives it `rect l/t/r/b -> l/t/r/b` (the full bounding box, byte-identical
 * to a plain rect's implicit text area), so the spec checks it is NOT LESS than
 * the control rather than "strictly greater" - see the spec file for the
 * COM-unverified caveat this generator's header inherits.
 *
 * Text is deliberately long, left-aligned (`algn="l"`) and top-anchored
 * (`anchor="t"`) so it wraps to fill the box and its glyphs reach all four
 * edges of whatever text rectangle the shape resolves to - a short or centred
 * label would sit in the middle of the box regardless of the inset, proving
 * nothing.
 *
 * Run with: bun run e2e/fixtures/generate-preset-text-insets-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Marker text per shape; the spec locates elements by these. */
export const INSET_SHAPES = {
	rect: 'RECT CONTROL wrapped filler text used to measure the plain box inset baseline',
	chevron: 'CHEVRON wrapped filler text used to measure the arrow text rectangle inset',
	homePlate: 'HOMEPLATE wrapped filler text used to measure the pentagon text rectangle inset',
	star5: 'STAR5 wrapped filler text used to measure the star text rectangle inset',
	pie: 'PIE wrapped filler text used to measure the wedge text rectangle inset',
	flowChartDecision:
		'DECISION wrapped filler text used to measure the diamond text rectangle inset',
	actionButtonHome:
		'ACTIONHOME wrapped filler text used to measure the button text rectangle inset',
} as const;

/** Box size, px (converted to EMU below): tall/wide enough to show both axes. */
const BOX_W_PX = 260;
const BOX_H_PX = 160;
const EMU_PER_PX = 9525;
const boxW = BOX_W_PX * EMU_PER_PX;
const boxH = BOX_H_PX * EMU_PER_PX;

interface ShapeSpec {
	key: keyof typeof INSET_SHAPES;
	prst: string;
	col: number;
	row: number;
}

const SHAPES: ShapeSpec[] = [
	{ key: 'rect', prst: 'rect', col: 0, row: 0 },
	{ key: 'chevron', prst: 'chevron', col: 1, row: 0 },
	{ key: 'homePlate', prst: 'homePlate', col: 2, row: 0 },
	{ key: 'star5', prst: 'star5', col: 3, row: 0 },
	{ key: 'pie', prst: 'pie', col: 0, row: 1 },
	{ key: 'flowChartDecision', prst: 'flowChartDecision', col: 1, row: 1 },
	{ key: 'actionButtonHome', prst: 'actionButtonHome', col: 2, row: 1 },
];

const COL_STEP_PX = 300;
const ROW_STEP_PX = 200;
const ORIGIN_X_PX = 40;
const ORIGIN_Y_PX = 40;

function run(text: string): string {
	return (
		'<a:r><a:rPr lang="en-US" sz="1000" dirty="0"><a:latin typeface="Arial"/>' +
		`<a:cs typeface="Arial"/></a:rPr><a:t>${text}</a:t></a:r>`
	);
}

function shapeXml(spec: ShapeSpec, id: number): string {
	const x = (ORIGIN_X_PX + spec.col * COL_STEP_PX) * EMU_PER_PX;
	const y = (ORIGIN_Y_PX + spec.row * ROW_STEP_PX) * EMU_PER_PX;
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${spec.key}"/>` +
		'<p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
		`<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${boxW}" cy="${boxH}"/></a:xfrm>` +
		`<a:prstGeom prst="${spec.prst}"><a:avLst/></a:prstGeom><a:noFill/>` +
		'<a:ln><a:solidFill><a:srgbClr val="808080"/></a:solidFill></a:ln></p:spPr>' +
		'<p:txBody><a:bodyPr wrap="square" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>' +
		`<a:p><a:pPr algn="l"/>${run(INSET_SHAPES[spec.key])}</a:p></p:txBody></p:sp>`
	);
}

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function slideXml(): string {
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		`<p:sld ${NS}><p:cSld><p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>',
		'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		...SHAPES.map((spec, index) => shapeXml(spec, index + 2)),
		'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
	].join('');
}

export async function generatePresetTextInsetsFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Preset Text Insets Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', slideXml());

	const outPath = resolve(__dirname, 'preset-text-insets.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-preset-text-insets-fixture.ts')) {
	generatePresetTextInsetsFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
