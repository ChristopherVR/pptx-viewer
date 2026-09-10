import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { sampleFirstPixelColorFromBytes } from '../../core/utils/image-first-pixel';
import { encodePng } from '../../core/utils/png-encoder';
import { PptxHandler } from '../../index';

const coreRequire = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const JSZip = coreRequire('jszip');

const C_NS =
	'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** 2x2 PNG: pixel (0,0) is GREEN (#00ff00), every other pixel RED. */
function pictureFillPng(): Uint8Array {
	// prettier-ignore
	const rgba = new Uint8Array([
		0, 255, 0, 255,  255, 0, 0, 255,
		255, 0, 0, 255,  255, 0, 0, 255,
	]);
	return encodePng(2, 2, rgba);
}

function bar3DChartXml(pictureRelId: string): string {
	const axes =
		`<c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/></c:catAx>` +
		`<c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/></c:valAx>` +
		`<c:serAx><c:axId val="3"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
		`<c:delete val="1"/><c:axPos val="b"/><c:crossAx val="2"/></c:serAx>`;
	const ser =
		`<c:ser><c:idx val="0"/><c:order val="0"/>` +
		`<c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache><c:ptCount val="1"/>` +
		`<c:pt idx="0"><c:v>Series</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
		`<c:spPr><a:blipFill><a:blip r:embed="${pictureRelId}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>` +
		`<a:ln><a:noFill/></a:ln></c:spPr>` +
		`<c:pictureOptions><c:applyToFront val="1"/><c:applyToSides val="0"/><c:applyToEnd val="0"/>` +
		`<c:pictureFormat val="stretch"/></c:pictureOptions>` +
		`<c:shape val="box"/>` +
		`<c:cat><c:strRef><c:f>Sheet1!$A$2</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Only</c:v></c:pt></c:strCache></c:strRef></c:cat>` +
		`<c:val><c:numRef><c:f>Sheet1!$B$2</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="1"/><c:pt idx="0"><c:v>80</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser>`;
	const body =
		`<c:bar3DChart><c:barDir val="col"/><c:grouping val="clustered"/>${ser}<c:shape val="box"/>` +
		`<c:axId val="1"/><c:axId val="2"/><c:axId val="3"/></c:bar3DChart>`;
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<c:chartSpace ${C_NS}><c:chart><c:plotArea><c:layout/>${body}${axes}</c:plotArea>` +
		`<c:plotVisOnly val="1"/></c:chart></c:chartSpace>`
	);
}

/**
 * Builds a minimal deck with one `bar3D` chart whose series has a
 * picture-only fill (front targeted, sides/end explicitly untargeted - the
 * COM-verified scenario `chart-bar3d-face-picture.ts` reproduces), and
 * returns its saved bytes.
 */
async function buildBar3DPictureFillDeck(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Bar3D Picture Fill',
		initialSlideCount: 0,
	});
	data.slides.push(
		createSlide('Blank')
			.addShape('rect', { x: 0, y: 0, width: 1, height: 1, fill: { type: 'none' }, text: '' })
			.build(),
	);
	const baseBytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(baseBytes);
	let contentTypes: string = await zip.file('[Content_Types].xml')!.async('string');

	zip.file('ppt/media/image900.png', pictureFillPng());
	zip.file(
		'ppt/charts/_rels/chart1.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
			`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
			`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image900.png"/>` +
			`</Relationships>`,
	);
	zip.file('ppt/charts/chart1.xml', bar3DChartXml('rId1'));

	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const relsXml: string = await zip.file(relsPath)!.async('string');
	zip.file(
		relsPath,
		relsXml.replace(
			'</Relationships>',
			`<Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`,
		),
	);

	const slidePath = 'ppt/slides/slide1.xml';
	const slideXml: string = await zip.file(slidePath)!.async('string');
	const frame =
		`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="200" name="Chart"/>` +
		`<p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
		`<p:xfrm><a:off x="0" y="0"/><a:ext cx="8000000" cy="4000000"/></p:xfrm>` +
		`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
		`<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId100"/>` +
		`</a:graphicData></a:graphic></p:graphicFrame>`;
	const at = slideXml.lastIndexOf('</p:spTree>');
	zip.file(slidePath, slideXml.slice(0, at) + frame + slideXml.slice(at));

	contentTypes = contentTypes.replace(
		'</Types>',
		`<Default Extension="png" ContentType="image/png"/>` +
			`<Override PartName="/ppt/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`,
	);
	zip.file('[Content_Types].xml', contentTypes);

	return zip.generateAsync({ type: 'uint8array' });
}

describe('bar3D chart picture-fill image resolution', () => {
	it('resolves the picture fill as a data: URL (not blob:), so the sync pixel decoder can read it', async () => {
		const bytes = await buildBar3DPictureFillDeck();
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
		);

		const chartEl = data.slides[0].elements.find((el) => el.type === 'chart');
		expect(chartEl).toBeDefined();
		const imageUrl =
			chartEl && 'chartData' in chartEl
				? chartEl.chartData?.series?.[0]?.picture?.imageUrl
				: undefined;
		expect(imageUrl).toBeDefined();
		expect(imageUrl!.startsWith('data:')).toBeTruthy();
		expect(imageUrl!.startsWith('blob:')).toBeFalsy();

		// And the whole point: the sync decoder can read pixel (0,0) off it.
		const base64 = imageUrl!.split(',')[1]!;
		const pngBytes = new Uint8Array(Buffer.from(base64, 'base64'));
		expect(sampleFirstPixelColorFromBytes(pngBytes)).toBe('#00ff00');
	});
});
