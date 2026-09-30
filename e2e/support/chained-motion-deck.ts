import JSZip from 'jszip';
import { PptxHandler, ShapeBuilder } from 'pptx-viewer-core';

export async function chainedDeck(): Promise<Buffer> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	const target = ShapeBuilder.create('rect')
		.position(100, 180)
		.size(60, 60)
		.solidFill('#FF0000')
		.build();
	target.shapeId = '60';
	const trigger = ShapeBuilder.create('rect')
		.position(100, 60)
		.size(120, 60)
		.solidFill('#00AA00')
		.build();
	trigger.shapeId = '61';
	data.slides[0].elements = [target, trigger];
	data.slides[0].isDirty = true;
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	handler.dispose();
	const segment = (id: number, delay: number, path: string) =>
		`<p:par><p:cTn id="${id}" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>` +
		`<p:par><p:cTn id="${id + 1}" presetClass="path" nodeType="withEffect" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
		`<p:animMotion origin="layout" pathEditMode="relative" path="${path}"><p:cBhvr><p:cTn id="${id + 2}" dur="1000" fill="hold"/><p:tgtEl><p:spTgt spid="60"/></p:tgtEl></p:cBhvr></p:animMotion>` +
		`</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
	const timing =
		`<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" nodeType="tmRoot"><p:childTnLst>` +
		`<p:seq><p:cTn id="2" dur="indefinite" nodeType="interactiveSeq"><p:stCondLst><p:cond evt="onClick" delay="0"><p:tgtEl><p:spTgt spid="61"/></p:tgtEl></p:cond></p:stCondLst><p:childTnLst>${segment(
			10,
			500,
			'M 0 0 L 0.2 0 E',
		)}${segment(
			20,
			1500,
			'M 0.2 0 L 0.2 0.2 E',
		)}</p:childTnLst></p:cTn></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
	const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	zip.file('ppt/slides/slide1.xml', xml.replace('</p:sld>', `${timing}</p:sld>`));
	return zip.generateAsync({ type: 'nodebuffer' });
}
