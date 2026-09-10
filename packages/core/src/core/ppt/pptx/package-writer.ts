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
import type { HyperlinkRelAllocator } from './hyperlink-xml';
import { slideLayoutXml, slideMasterXml, themeXml } from './master-writer';
import {
	addSlideOleRelationships,
	computeOleFileNumbers,
	writeOleEmbeddings,
} from './package-writer-ole';
import { contentTypesXml, presentationRelsXml, presentationXml } from './package-writer-parts';
import type { MediaUsage } from './package-writer-parts';
import { shapeXml } from './shape-writer';
import type { ShapeWriterContext } from './shape-writer';
import { PML_XMLNS, solidFill } from './xml-utils';

const HYPERLINK_REL_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

/**
 * Build a `HyperlinkRelAllocator` that appends each newly registered
 * relationship's XML to `relsOut`, starting `rId` allocation after
 * `startCounter` (the highest `rId` number already used by this part, e.g.
 * the layout/media relationships a slide already carries).
 */
function makeHyperlinkRelAllocator(
	relsOut: string[],
	startCounter: { n: number },
): HyperlinkRelAllocator {
	return {
		addRel(target, external, type = HYPERLINK_REL_TYPE): string {
			const relId = `rId${++startCounter.n}`;
			const mode = external ? ' TargetMode="External"' : '';
			relsOut.push(`  <Relationship Id="${relId}" Type="${type}" Target="${target}"${mode}/>`);
			return relId;
		},
	};
}

function slideXml(
	deck: PptDeck,
	slide: PptSlideModel,
	relIdByPicture: Map<number, string>,
	relIdByOle: Map<number, string>,
	relsOut: string[],
	relCounterStart: { n: number },
): string {
	let nextId = 2;
	const ctx: ShapeWriterContext = {
		nextId: () => nextId++,
		mediaRel: (pictureIndex) => {
			const relId = relIdByPicture.get(pictureIndex);
			return relId ? { relId } : undefined;
		},
		oleRel: (exObjId) => {
			const relId = relIdByOle.get(exObjId);
			if (!relId) {
				return undefined;
			}
			const embed = deck.oleEmbeds.get(exObjId);
			return { relId, progId: embed?.progId, clsId: embed?.clsId };
		},
		hyperlinkRels: makeHyperlinkRelAllocator(relsOut, relCounterStart),
		slideCount: deck.slides.length,
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
<p:sld ${PML_XMLNS}${showMaster}>
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
			if (shape.kind === 'picture' || shape.kind === 'ole') {
				indexes.push(shape.pictureIndex);
			} else if (shape.kind === 'group') {
				visit(shape.children);
			}
		}
	};
	visit(slide.shapes);
	return indexes;
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

	// Assign embedding file numbers to every used OLE embed that resolved to
	// non-empty storage bytes, and write those parts.
	const oleFileNumbers = computeOleFileNumbers(deck);
	writeOleEmbeddings(zip, deck, oleFileNumbers);

	zip.file('[Content_Types].xml', contentTypesXml(deck, usage, oleFileNumbers.size > 0));
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
	const masterRels: string[] = [];
	const masterCtx: ShapeWriterContext = {
		nextId: () => masterShapeId++,
		mediaRel: () => undefined,
		oleRel: () => undefined,
		hyperlinkRels: makeHyperlinkRelAllocator(masterRels, { n: 2 }),
		slideCount: deck.slides.length,
	};
	const masterXml = slideMasterXml(deck, masterCtx);
	zip.file('ppt/slideMasters/slideMaster1.xml', masterXml);
	zip.file(
		'ppt/slideMasters/_rels/slideMaster1.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
${masterRels.join('\n')}
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
		const relCounterState = { n: relCounter };
		const relIdByOle = addSlideOleRelationships(slide, oleFileNumbers, relCounterState, mediaRels);
		const slideBody = slideXml(deck, slide, relIdByPicture, relIdByOle, mediaRels, relCounterState);
		zip.file(`ppt/slides/slide${i + 1}.xml`, slideBody);
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
