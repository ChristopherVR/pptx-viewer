/**
 * Generates `chart-pie-best-fit.pptx`: two slides of eight pies each (230 x
 * 250pt frames, different slice sizes) whose 12pt Calibri value labels sit at
 * `c:dLblPos val="bestFit"`, written on the series as PowerPoint writes them.
 * Slide 2 gives every label a pale yellow box so its placement and size can
 * be read back. `chart-pie-best-fit.spec.ts` holds what PowerPoint drew for it
 * (COM `Slide.Export` pixels and `DataLabel.Width/Height`).
 *
 * Run with: bun run e2e/fixtures/generate-chart-pie-best-fit-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { numCache, strCache, txCache } from './chart-xml';
import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The slice values of each pie, in slide order (the same on every slide). */
export const BEST_FIT_PIES: readonly (readonly number[])[] = [
	[40, 30, 20, 10],
	[70, 15, 10, 5],
	[5, 5, 5, 85],
	[25, 25, 25, 25],
	[1, 2, 3, 94],
	[55, 45],
	[12, 11, 10, 10, 9, 9, 9, 8, 8, 7, 7],
	[50, 1, 1, 1, 47],
];

/** What each slide's labels show. */
export const BEST_FIT_SLIDES = ['value', 'boxed-value'] as const;

/** Each chart frame, in points: 4 columns x 2 rows on a 960x540 slide. */
export const PIE_FRAME_PT = { width: 230, height: 250 } as const;

export function pieFramePosition(index: number): { x: number; y: number } {
	return { x: 10 + (index % 4) * 237, y: 20 + Math.floor(index / 4) * 260 };
}

const PALETTE = ['156082', 'E97132', '196B24', '0F9ED5', 'A02B93', '4EA72E'];

function labelsXml(slide: (typeof BEST_FIT_SLIDES)[number]): string {
	const box =
		slide === 'boxed-value'
			? '<c:spPr><a:solidFill><a:srgbClr val="FFF2CC"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="7F7F7F"/></a:solidFill></a:ln></c:spPr>'
			: '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>';
	return [
		'<c:dLbls>',
		box,
		'<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="0">',
		'<a:solidFill><a:srgbClr val="404040"/></a:solidFill>',
		'<a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>',
		'<c:dLblPos val="bestFit"/><c:showLegendKey val="0"/>',
		'<c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/>',
		'<c:showBubbleSize val="0"/><c:showLeaderLines val="1"/>',
		'</c:dLbls>',
	].join('');
}

function pieChartXml(values: readonly number[], slide: (typeof BEST_FIT_SLIDES)[number]): string {
	const categories = values.map((_, i) => `Cat ${i + 1}`);
	const dPts = values
		.map(
			(_, i) =>
				`<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${PALETTE[i % PALETTE.length]}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
		)
		.join('');
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		'<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ',
		'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ',
		'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
		'<c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>',
		'<c:pieChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>',
		txCache('Sales'),
		dPts,
		labelsXml(slide),
		`<c:cat>${strCache(categories)}</c:cat><c:val>${numCache([...values])}</c:val>`,
		'</c:ser><c:firstSliceAng val="0"/></c:pieChart>',
		'<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>',
		'<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>',
		'<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>',
		'</c:chartSpace>',
	].join('');
}

const EMU_PER_PT = 12700;
const CHART_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
const CHART_CT = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

function frameXml(index: number, rId: string): string {
	const { x, y } = pieFramePosition(index);
	return [
		`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${100 + index}" name="Pie ${index + 1}"/>`,
		'<p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>',
		`<p:xfrm><a:off x="${x * EMU_PER_PT}" y="${y * EMU_PER_PT}"/>`,
		`<a:ext cx="${PIE_FRAME_PT.width * EMU_PER_PT}" cy="${PIE_FRAME_PT.height * EMU_PER_PT}"/></p:xfrm>`,
		'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">',
		'<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ',
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>`,
		'</a:graphicData></a:graphic></p:graphicFrame>',
	].join('');
}

export async function generateChartPieBestFitFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Pie Best Fit Fixture',
		initialSlideCount: 0,
	});
	for (const _slide of BEST_FIT_SLIDES) {
		data.slides.push(createSlide('Blank').build());
	}
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	let contentTypes = await zip.file('[Content_Types].xml')!.async('string');
	let chartNumber = 0;
	for (const [slideIndex, slide] of BEST_FIT_SLIDES.entries()) {
		const slidePath = `ppt/slides/slide${slideIndex + 1}.xml`;
		const relsPath = `ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`;
		let rels = await zip.file(relsPath)!.async('string');
		const frames: string[] = [];
		for (const [pieIndex, values] of BEST_FIT_PIES.entries()) {
			chartNumber += 1;
			const part = `ppt/charts/chart${chartNumber}.xml`;
			zip.file(part, pieChartXml(values, slide));
			const rId = `rIdPie${pieIndex + 1}`;
			rels = rels.replace(
				'</Relationships>',
				`<Relationship Id="${rId}" Type="${CHART_REL}" Target="../charts/chart${chartNumber}.xml"/></Relationships>`,
			);
			contentTypes = contentTypes.replace(
				'</Types>',
				`<Override PartName="/${part}" ContentType="${CHART_CT}"/></Types>`,
			);
			frames.push(frameXml(pieIndex, rId));
		}
		zip.file(relsPath, rels);
		const slideXml = await zip.file(slidePath)!.async('string');
		const at = slideXml.lastIndexOf('</p:spTree>');
		zip.file(slidePath, slideXml.slice(0, at) + frames.join('') + slideXml.slice(at));
	}
	zip.file('[Content_Types].xml', contentTypes);

	const outPath = resolve(__dirname, 'chart-pie-best-fit.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-chart-pie-best-fit-fixture.ts')) {
	generateChartPieBestFitFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
