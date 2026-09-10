/**
 * Document-level PPTX part XML ([Content_Types].xml, presentation.xml, its
 * rels) for `package-writer.ts`, split out to stay under this repo's
 * 300-LOC file budget.
 *
 * @module ppt/pptx/package-writer-parts
 */

import type { PptDeck } from '../ppt-model';
import { OLE_OBJECT_CONTENT_TYPE } from './package-writer-ole';
import { PML_XMLNS } from './xml-utils';

/** Media usage the package writer computed: pictureIndex -> media file number (1-based). */
export interface MediaUsage {
	fileNumbers: Map<number, number>;
}

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

export function contentTypesXml(deck: PptDeck, usage: MediaUsage, hasOleEmbeds: boolean): string {
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
	const oleDefault = hasOleEmbeds
		? `\n  <Default Extension="bin" ContentType="${OLE_OBJECT_CONTENT_TYPE}"/>`
		: '';
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
${defaults}${oleDefault}
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
${slideOverrides}
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

export function presentationXml(deck: PptDeck): string {
	const slideIds = deck.slides
		.map((_slide, i) => `    <p:sldId id="${256 + i}" r:id="rId${3 + i}"/>`)
		.join('\n');
	const sldIdLst = deck.slides.length > 0 ? `  <p:sldIdLst>\n${slideIds}\n  </p:sldIdLst>\n` : '';
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation ${PML_XMLNS}>
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
${sldIdLst}  <p:sldSz cx="${deck.widthEmu}" cy="${deck.heightEmu}"/>
  <p:notesSz cx="${deck.heightEmu}" cy="${deck.widthEmu}"/>
</p:presentation>`;
}

export function presentationRelsXml(deck: PptDeck): string {
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
