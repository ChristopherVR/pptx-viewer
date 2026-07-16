import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { Model3DPptxElement } from '../../core/types';

const GLB_DATA = 'data:model/gltf-binary;base64,Z2xURgIAAAAMAAAA';
const REPLACEMENT_GLB_DATA = 'data:model/gltf.binary;base64,Z2xURgIAAAAMAAAA';
const PNG_DATA =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function saveSdkModel(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	const slide = createSlide('Blank').build();
	slide.elements.push({
		id: 'sdk-model',
		type: 'model3d',
		x: 100,
		y: 80,
		width: 320,
		height: 180,
		modelData: GLB_DATA,
		modelMimeType: 'model/gltf-binary',
		posterImage: PNG_DATA,
		altText: '3D product model',
	} satisfies Model3DPptxElement);
	data.slides.push(slide);
	return handler.save(data.slides);
}

describe('3D model package integration', () => {
	it('authors GLB and poster parts with official relationships and reloads them', async () => {
		const saved = await saveSdkModel();
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
		const types = await zip.file('[Content_Types].xml')!.async('string');

		expect(slideXml).toContain('Requires="p16"');
		expect(slideXml).toContain('<p16:model3D>');
		expect(slideXml).toContain('<p16:model3Drel r:id="');
		expect(slideXml).toContain('<p16:spPr>');
		expect(slideXml).toContain('<p16:posterImage r:embed="');
		expect(slideXml).toContain('<mc:Fallback><p:pic>');
		expect(rels).toContain(
			'Type="http://schemas.microsoft.com/office/2017/06/relationships/model3d"',
		);
		expect(rels).toMatch(/Target="\.\.\/media\/image\d+\.glb"/u);
		expect(rels).toContain('/relationships/image');
		expect(types).toContain('Extension="glb" ContentType="model/gltf-binary"');
		const modelPath = Object.keys(zip.files).find((path) =>
			/^ppt\/media\/image\d+\.glb$/u.test(path),
		);
		expect(modelPath).toBeTruthy();
		await expect(zip.file(modelPath!)!.async('uint8array')).resolves.toStrictEqual(
			new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]),
		);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer, {
			eagerDecodeImages: true,
		});
		const model = reloaded.slides[0].elements.find(
			(element): element is Model3DPptxElement => element.type === 'model3d',
		);
		expect(model).toMatchObject({
			type: 'model3d',
			x: 100,
			y: 80,
			width: 320,
			height: 180,
			modelMimeType: 'model/gltf-binary',
		});
		expect(model?.modelData).toMatch(/^data:model\/gltf-binary;base64,/u);
		expect(model?.imagePath).toMatch(/\.png$/u);
		expect(model?.imageData).toBeTruthy();
	});

	it('preserves unknown model XML on dirty save and tolerates legacy GLB MIME spelling', async () => {
		const authored = await saveSdkModel();
		const authoredZip = await JSZip.loadAsync(authored);
		const slidePath = 'ppt/slides/slide1.xml';
		const xml = await authoredZip.file(slidePath)!.async('string');
		authoredZip.file(
			slidePath,
			xml.replace(
				'</p16:model3D>',
				'<p:extLst><p:ext uri="urn:model3d:preserve"><p:vendorData val="keep"/></p:ext></p:extLst></p16:model3D>',
			),
		);
		const types = await authoredZip.file('[Content_Types].xml')!.async('string');
		authoredZip.file(
			'[Content_Types].xml',
			types.replace('model/gltf-binary', 'model/gltf.binary'),
		);
		const legacyMimePackage = await authoredZip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const data = await handler.load(legacyMimePackage.buffer as ArrayBuffer, {
			eagerDecodeImages: true,
		});
		const model = data.slides[0].elements.find(
			(element): element is Model3DPptxElement => element.type === 'model3d',
		)!;
		expect(model.modelPath).toMatch(/\.glb$/u);
		model.x = 240;
		model.width = 360;
		model.modelData = REPLACEMENT_GLB_DATA;
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const savedXml = await zip.file(slidePath)!.async('string');
		expect(savedXml).toContain('uri="urn:model3d:preserve"');
		expect(savedXml).toContain('val="keep"');
		expect(savedXml).toContain('x="2286000"');
		expect(savedXml).toContain('cx="3429000"');
		expect(savedXml.match(/x="2286000"/gu)).toHaveLength(2);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer, {
			eagerDecodeImages: true,
		});
		expect(reloaded.slides[0].elements.find((element) => element.type === 'model3d')).toMatchObject(
			{
				type: 'model3d',
				x: 240,
				width: 360,
				modelMimeType: 'model/gltf-binary',
			},
		);
	});
});
