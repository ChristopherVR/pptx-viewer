/**
 * OLE embedding part/relationship bookkeeping for `package-writer.ts`, split
 * out to stay under this repo's 300-LOC file budget.
 *
 * @module ppt/pptx/package-writer-ole
 */

import type JSZip from 'jszip';

import type { PptDeck, PptSlideModel } from '../ppt-model';

/** Relationship type for embedded OLE binary parts. */
export const OLE_OBJECT_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject';

/**
 * Content type for a `ppt/embeddings/oleObjectN.bin` part: the standard
 * OOXML convention for an embedded legacy OLE binary (a real `.pptx` saved
 * by PowerPoint itself uses this exact content type for the same kind of
 * part), regardless of what the nested storage actually contains. The
 * existing OOXML load pipeline determines the real embedded file's type
 * from its own content (`unwrapOleEmbedding`) and the `p:oleObj`
 * `progId`/`classid` attributes, not from this content type.
 */
export const OLE_OBJECT_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.oleObject';

/** Every `exObjId` an OLE shape in this slide (recursing into groups) references. */
export function collectOleExObjIds(slide: PptSlideModel): number[] {
	const ids: number[] = [];
	const visit = (shapes: PptSlideModel['shapes']): void => {
		for (const shape of shapes) {
			if (shape.kind === 'ole') {
				ids.push(shape.exObjId);
			} else if (shape.kind === 'group') {
				visit(shape.children);
			}
		}
	};
	visit(slide.shapes);
	return ids;
}

/** Assign a 1-based embedding file number to every used OLE embed with non-empty storage bytes. */
export function computeOleFileNumbers(deck: PptDeck): Map<number, number> {
	const usedExObjIds = new Set<number>();
	for (const slide of deck.slides) {
		for (const exObjId of collectOleExObjIds(slide)) {
			usedExObjIds.add(exObjId);
		}
	}
	const fileNumbers = new Map<number, number>();
	let counter = 0;
	for (const exObjId of usedExObjIds) {
		const embed = deck.oleEmbeds.get(exObjId);
		if (embed && embed.data.length > 0) {
			fileNumbers.set(exObjId, ++counter);
		}
	}
	return fileNumbers;
}

/** Write `ppt/embeddings/oleObjectN.bin` for every assigned file number. */
export function writeOleEmbeddings(
	zip: JSZip,
	deck: PptDeck,
	fileNumbers: Map<number, number>,
): void {
	for (const [exObjId, fileNumber] of fileNumbers) {
		const embed = deck.oleEmbeds.get(exObjId);
		if (embed) {
			zip.file(`ppt/embeddings/oleObject${fileNumber}.bin`, embed.data);
		}
	}
}

/**
 * Register this slide's OLE embedding relationships (appending their XML to
 * `relsOut` and advancing `relCounter.n`), returning the `exObjId -> rId`
 * map `slideXml`'s `oleRel` callback needs.
 */
export function addSlideOleRelationships(
	slide: PptSlideModel,
	fileNumbers: Map<number, number>,
	relCounter: { n: number },
	relsOut: string[],
): Map<number, string> {
	const relIdByOle = new Map<number, string>();
	for (const exObjId of collectOleExObjIds(slide)) {
		const fileNumber = fileNumbers.get(exObjId);
		if (fileNumber === undefined || relIdByOle.has(exObjId)) {
			continue;
		}
		const relId = `rId${++relCounter.n}`;
		relIdByOle.set(exObjId, relId);
		relsOut.push(
			`  <Relationship Id="${relId}" Type="${OLE_OBJECT_RELATIONSHIP_TYPE}" Target="../embeddings/oleObject${fileNumber}.bin"/>`,
		);
	}
	return relIdByOle;
}
