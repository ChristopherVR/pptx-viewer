/**
 * Assembles a complete in-memory PPTX (OpenXML) package from the parsed
 * .ppt deck model. The generated package is then loaded through the normal
 * PPTX pipeline, so rendering, editing and saving behave exactly like a
 * native .pptx.
 *
 * @module ppt/pptx/package-writer
 */

import JSZip from 'jszip';

import { SCHEME } from '../color-scheme';
import type { PptDeck, PptSlideModel } from '../ppt-model';
import { slideLayoutXml, slideMasterXml, themeXml } from './master-writer';
import { shapeXml } from './shape-writer';
import type { ShapeWriterContext } from './shape-writer';
import { solidFill } from './xml-utils';

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	bmp: 'image/bmp',
	gif: 'image/gif',
	tiff: 'image/tiff',
	emf: 'image/x-emf',
	wmf: 'image/x-wmf',
	pict: 'image/x-pict',
};

const XMLNS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

interface MediaUsage {
	/** pictureIndex -> media file number (1-based). */
	fileNumbers: Map<number, number>;
}

function slideXml(
	deck: PptDeck,
	slide: PptSlideModel,
	relIdByPicture: Map<number, string>,
): string {
	let nextId = 2;
	const ctx: ShapeWriterContext = {
		nextId: () => nextId++,
		mediaRel: (pictureIndex) => {
			const relId = relIdByPicture.get(pictureIndex);
			return relId ? { relId } : undefined;
		},
	};
	const shapes = slide.shapes.map((shape) => shapeXml(shape, ctx)).join('');
	const backgroundRgb = slide.followMasterBackground
		? undefined
		: (slide.backgroundRgb ?? deck.scheme[SCHEME.background]);
	const bg = backgroundRgb
		? `<p:bg><p:bgPr>${solidFill(backgroundRgb)}<a:effectLst/></p:bgPr></p:bg>`
		: '';
	const showMaster = slide.followMasterObjects ? '' : ' showMasterSp="0"';
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${XMLNS}${showMaster}>
  <p:cSld>
    ${bg}
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${shapes}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function collectPictureIndexes(slide: PptSlideModel): number[] {
	const indexes: number[] = [];
	const visit = (shapes: PptSlideModel['shapes']): void => {
		for (const shape of shapes) {
			if (shape.kind === 'picture') {
				indexes.push(shape.pictureIndex);
			} else if (shape.kind === 'group') {
				visit(shape.children);
			}
		}
	};
	visit(slide.shapes);
	return indexes;
}

function contentTypesXml(deck: PptDeck, usage: MediaUsage): string {
	const extensions = new Set<string>();
	for (const [pictureIndex] of usage.fileNumbers) {
		const picture = deck.pictures[pictureIndex];
		if (picture) {
			extensions.add(picture.extension);
		}
	}
	const defaults = [...extensions]
		.map(
			(ext) =>
				`  <Default Extension="${ext}" ContentType="${CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream'}"/>`,
		)
		.join('\n');
	const slideOverrides = deck.slides
		.map(
			(_slide, i) =>
				`  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
${defaults}
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
${slideOverrides}
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function presentationXml(deck: PptDeck): string {
	const slideIds = deck.slides
		.map((_slide, i) => `    <p:sldId id="${256 + i}" r:id="rId${3 + i}"/>`)
		.join('\n');
	const sldIdLst = deck.slides.length > 0 ? `  <p:sldIdLst>\n${slideIds}\n  </p:sldIdLst>\n` : '';
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation ${XMLNS}>
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
${sldIdLst}  <p:sldSz cx="${deck.widthEmu}" cy="${deck.heightEmu}"/>
  <p:notesSz cx="${deck.heightEmu}" cy="${deck.widthEmu}"/>
</p:presentation>`;
}

function presentationRelsXml(deck: PptDeck): string {
	const slideRels = deck.slides
		.map(
			(_slide, i) =>
				`  <Relationship Id="rId${3 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
${slideRels}
</Relationships>`;
}

/**
 * Build the PPTX package bytes for a parsed deck.
 */
export async function buildPptxPackage(deck: PptDeck): Promise<ArrayBuffer> {
	const zip = new JSZip();

	// Assign media file numbers to used pictures with non-empty data.
	const usage: MediaUsage = { fileNumbers: new Map() };
	let mediaCounter = 0;
	for (const slide of deck.slides) {
		for (const pictureIndex of collectPictureIndexes(slide)) {
			const picture = deck.pictures[pictureIndex];
			if (picture && picture.bytes.length > 0 && !usage.fileNumbers.has(pictureIndex)) {
				usage.fileNumbers.set(pictureIndex, ++mediaCounter);
			}
		}
	}

	for (const [pictureIndex, fileNumber] of usage.fileNumbers) {
		const picture = deck.pictures[pictureIndex];
		zip.file(`ppt/media/image${fileNumber}.${picture.extension}`, picture.bytes);
	}

	zip.file('[Content_Types].xml', contentTypesXml(deck, usage));
	zip.file(
		'_rels/.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
	);

	zip.file('ppt/presentation.xml', presentationXml(deck));
	zip.file('ppt/_rels/presentation.xml.rels', presentationRelsXml(deck));

	let masterShapeId = 2;
	const masterCtx: ShapeWriterContext = {
		nextId: () => masterShapeId++,
		mediaRel: () => undefined,
	};
	zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml(deck, masterCtx));
	zip.file(
		'ppt/slideMasters/_rels/slideMaster1.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
	);
	zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml());
	zip.file(
		'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
	);
	zip.file('ppt/theme/theme1.xml', themeXml(deck));

	deck.slides.forEach((slide, i) => {
		const relIdByPicture = new Map<number, string>();
		const mediaRels: string[] = [];
		let relCounter = 1; // rId1 = layout
		for (const pictureIndex of collectPictureIndexes(slide)) {
			const fileNumber = usage.fileNumbers.get(pictureIndex);
			if (fileNumber === undefined || relIdByPicture.has(pictureIndex)) {
				continue;
			}
			const relId = `rId${++relCounter}`;
			relIdByPicture.set(pictureIndex, relId);
			const picture = deck.pictures[pictureIndex];
			mediaRels.push(
				`  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${fileNumber}.${picture.extension}"/>`,
			);
		}
		zip.file(`ppt/slides/slide${i + 1}.xml`, slideXml(deck, slide, relIdByPicture));
		zip.file(
			`ppt/slides/_rels/slide${i + 1}.xml.rels`,
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
${mediaRels.join('\n')}
</Relationships>`,
		);
	});

	zip.file(
		'docProps/core.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title></dc:title>
  <dc:creator>pptx-viewer ppt import</dc:creator>
</cp:coreProperties>`,
	);
	zip.file(
		'docProps/app.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>pptx-viewer ppt import</Application>
  <Slides>${deck.slides.length}</Slides>
</Properties>`,
	);

	return zip.generateAsync({ type: 'arraybuffer' });
}
