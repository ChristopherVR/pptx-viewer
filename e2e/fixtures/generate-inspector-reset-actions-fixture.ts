/**
 * Generates `inspector-reset-actions.pptx`: one slide carrying everything the
 * inspector's reset and clear actions act on, for
 * `e2e/inspector-reset-actions.spec.ts` (#398).
 *
 *  - a picture with a brightness adjustment (`a:lum`) and a 10% left crop
 *    (`a:srcRect`): Reset Picture and Reset Crop;
 *  - an embedded WAV with `p14:trim` (start 500 ms): Reset trim;
 *  - a column chart whose first series carries an explicit colour: Clear
 *    series colour;
 *  - a solid slide background (`p:bg`): Clear Background.
 *
 * Built on the SDK's blank deck plus injected parts (the SDK cannot author a
 * chart or a trimmed audio element from scratch), mirroring
 * `generate-chart-title-runs-fixture.ts`.
 *
 * Run with: bun run e2e/fixtures/generate-inspector-reset-actions-fixture.ts
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type JSZipType from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { buildBarChartXml } from './chart-xml';
import { writeFixtureDeterministic } from './write-fixture';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PX = 9525;
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** 1x1 PNG. */
const PNG_1X1 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** A tiny 0.05 s, 8 kHz mono 16-bit PCM WAV. */
function wavBytes(): Buffer {
	const samples = 400;
	const buf = Buffer.alloc(44 + samples * 2);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + samples * 2, 4);
	buf.write('WAVEfmt ', 8);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(8000, 24);
	buf.writeUInt32LE(16000, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(samples * 2, 40);
	for (let i = 0; i < samples; i++) {
		buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / 8000) * 8000), 44 + i * 2);
	}
	return buf;
}

const xfrm = (x: number, y: number, w: number, h: number): string =>
	`<a:xfrm><a:off x="${x * PX}" y="${y * PX}"/><a:ext cx="${w * PX}" cy="${h * PX}"/></a:xfrm>`;

const PICTURE =
	`<p:pic><p:nvPicPr><p:cNvPr id="101" name="Reset Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
	`<p:blipFill><a:blip r:embed="rIdImg"><a:lum bright="20000"/></a:blip><a:srcRect l="10000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
	`<p:spPr>${xfrm(60, 60, 200, 120)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;

const AUDIO =
	`<p:pic><p:nvPicPr><p:cNvPr id="102" name="Trimmed Audio"/><p:cNvPicPr/>` +
	`<p:nvPr><a:audioFile r:link="rIdAudio"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}">` +
	`<p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="rIdAudio"><p14:trim st="500"/></p14:media>` +
	`</p:ext></p:extLst></p:nvPr></p:nvPicPr>` +
	`<p:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
	`<p:spPr>${xfrm(320, 60, 100, 100)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;

const CHART_FRAME =
	`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="103" name="Coloured Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
	`<p:xfrm><a:off x="${60 * PX}" y="${230 * PX}"/><a:ext cx="${400 * PX}" cy="${250 * PX}"/></p:xfrm>` +
	`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
	`<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rIdChart"/>` +
	`</a:graphicData></a:graphic></p:graphicFrame>`;

const BACKGROUND =
	'<p:bg><p:bgPr><a:solidFill><a:srgbClr val="DDEEFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>';

const relXml = (id: string, type: string, target: string): string =>
	`<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`;

export async function generateInspectorResetActionsFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Inspector Reset Actions Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(
		createSlide('Blank')
			.addShape('rect', { x: 0, y: 0, width: 1, height: 1, fill: { type: 'none' } })
			.build(),
	);
	const zip = await JSZip.loadAsync(await handler.save(data.slides));

	const slidePath = 'ppt/slides/slide1.xml';
	let slide = await zip.file(slidePath)!.async('string');
	slide = slide
		.replace('<p:cSld>', `<p:cSld>${BACKGROUND}`)
		.replace('</p:spTree>', `${PICTURE}${AUDIO}${CHART_FRAME}</p:spTree>`);
	zip.file(slidePath, slide);

	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const rels = (await zip.file(relsPath)!.async('string')).replace(
		'</Relationships>',
		[
			relXml('rIdImg', 'image', '../media/reset-image.png'),
			relXml('rIdAudio', 'audio', '../media/reset-sound.wav'),
			relXml('rIdChart', 'chart', '../charts/chart1.xml'),
			'</Relationships>',
		].join(''),
	);
	zip.file(relsPath, rels);
	zip.file('ppt/media/reset-image.png', Buffer.from(PNG_1X1, 'base64'));
	zip.file('ppt/media/reset-sound.wav', wavBytes());
	zip.file(
		'ppt/charts/chart1.xml',
		buildBarChartXml(
			{
				title: 'Coloured',
				categories: ['Q1', 'Q2'],
				series: [
					{ name: 'Alpha', values: [3, 5], colorHex: 'C0392B' },
					{ name: 'Beta', values: [4, 2], colorHex: '2980B9' },
				],
			},
			'clustered',
		),
	);

	let types = await zip.file('[Content_Types].xml')!.async('string');
	const additions = [
		['png', '<Default Extension="png" ContentType="image/png"/>'],
		['wav', '<Default Extension="wav" ContentType="audio/x-wav"/>'],
	];
	for (const [ext, tag] of additions) {
		if (!types.includes(`Extension="${ext}"`)) {
			types = types.replace('</Types>', `${tag}</Types>`);
		}
	}
	types = types.replace(
		'</Types>',
		'<Override PartName="/ppt/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>',
	);
	zip.file('[Content_Types].xml', types);

	const outPath = resolve(__dirname, 'inspector-reset-actions.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-inspector-reset-actions-fixture.ts')) {
	generateInspectorResetActionsFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
