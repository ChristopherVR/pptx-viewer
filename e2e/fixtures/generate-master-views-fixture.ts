/** Deterministic Notes Master and Handout Master fixture for cross-binding E2E coverage. */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const NOTES_MASTER_TEXT = 'NOTES-MASTER-ORIG';
export const HANDOUT_MASTER_TEXT = 'HANDOUT-MASTER-ORIG';
export const NOTES_MASTER_BACKGROUND = '#f2f7ff';
export const HANDOUT_MASTER_BACKGROUND = '#fff4e6';

function shapeXml(id: number, text: string, placeholderType: string): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${text}"></p:cNvPr>` +
		`<p:cNvSpPr></p:cNvSpPr><p:nvPr><p:ph type="${placeholderType}"></p:ph></p:nvPr></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="914400" y="914400"></a:off>` +
		`<a:ext cx="5486400" cy="914400"></a:ext></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst></a:avLst></a:prstGeom>` +
		`<a:solidFill><a:srgbClr val="4472C4"></a:srgbClr></a:solidFill></p:spPr>` +
		`<p:txBody><a:bodyPr></a:bodyPr><a:lstStyle></a:lstStyle>` +
		`<a:p><a:r><a:rPr lang="en-US"></a:rPr><a:t>${text}</a:t></a:r></a:p>` +
		`</p:txBody></p:sp>`
	);
}

/* oxlint-disable eslint/prefer-template -- Keep the deterministic OpenXML fixture readable as ordered fragments. */
function masterXml(
	root: 'notesMaster' | 'handoutMaster',
	background: string,
	text: string,
): string {
	const placeholder = root === 'notesMaster' ? 'body' : 'hdr';
	const notesStyle = root === 'notesMaster' ? '<p:notesStyle></p:notesStyle>' : '';
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<p:${root} xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
		`xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
		`xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
		`<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background.slice(1)}"></a:srgbClr>` +
		`</a:solidFill><a:effectLst></a:effectLst></p:bgPr></p:bg>` +
		`<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""></p:cNvPr><p:cNvGrpSpPr></p:cNvGrpSpPr>` +
		`<p:nvPr></p:nvPr></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"></a:off>` +
		`<a:ext cx="0" cy="0"></a:ext><a:chOff x="0" y="0"></a:chOff>` +
		`<a:chExt cx="0" cy="0"></a:chExt></a:xfrm></p:grpSpPr>${shapeXml(2, text, placeholder)}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" ` +
		`accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" ` +
		`hlink="hlink" tx1="dk1" tx2="dk2"></p:clrMap>` +
		`<p:hf hdr="1" ftr="1" dt="1" sldNum="1"></p:hf>` +
		notesStyle +
		`</p:${root}>`
	);
}
/* oxlint-enable eslint/prefer-template */

function addContentType(xml: string, partName: string, contentType: string): string {
	if (xml.includes(`PartName="${partName}"`)) {
		return xml;
	}
	return xml.replace(
		'</Types>',
		`<Override PartName="${partName}" ContentType="${contentType}"/></Types>`,
	);
}

export async function generateMasterViewsFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Master Views Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(
		createSlide('Blank')
			.addText('MASTER-VIEWS-SLIDE', { x: 100, y: 100, width: 500, height: 80 })
			.build(),
	);
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file(
		'ppt/notesMasters/notesMaster1.xml',
		masterXml('notesMaster', NOTES_MASTER_BACKGROUND, NOTES_MASTER_TEXT),
	);
	zip.file(
		'ppt/handoutMasters/handoutMaster1.xml',
		masterXml('handoutMaster', HANDOUT_MASTER_BACKGROUND, HANDOUT_MASTER_TEXT),
	);
	zip.file(
		'ppt/notesMasters/_rels/notesMaster1.xml.rels',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
	);
	zip.file(
		'ppt/handoutMasters/_rels/handoutMaster1.xml.rels',
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
	);
	let contentTypes = await zip.file('[Content_Types].xml')!.async('string');
	contentTypes = addContentType(
		contentTypes,
		'/ppt/notesMasters/notesMaster1.xml',
		'application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml',
	);
	contentTypes = addContentType(
		contentTypes,
		'/ppt/handoutMasters/handoutMaster1.xml',
		'application/vnd.openxmlformats-officedocument.presentationml.handoutMaster+xml',
	);
	zip.file('[Content_Types].xml', contentTypes);

	const outPath = resolve(__dirname, 'master-views.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-master-views-fixture.ts')) {
	generateMasterViewsFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
