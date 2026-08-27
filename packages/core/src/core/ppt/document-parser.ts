/**
 * DocumentContainer parsing ([MS-PPT] 2.4.1) and deck assembly.
 *
 * Reads the DocumentAtom (slide size), font collection, outline text
 * (SlideListWithText), color schemes, the main master and every referenced
 * SlideContainer via the persist object directory.
 *
 * @module ppt/document-parser
 */

import { DEFAULT_SCHEME, findSchemeColors } from './color-scheme';
import type { PptColorScheme } from './color-scheme';
import { EncryptedPptError } from './current-user';
import { buildPersistDirectory } from './persist-directory';
import type { PersistDirectory } from './persist-directory';
import { parsePictures } from './pictures';
import type { PptDeck, PptSlideModel } from './ppt-model';
import {
	PptParseError,
	findChild,
	findDescendant,
	iterateChildren,
	readRecordOrThrow,
} from './record-stream';
import type { PptRecord } from './record-stream';
import { OA, RT, masterToEmu } from './record-types';
import { parseMasterContainer, parseSlideContainer } from './slide-parser';
import { collectMasterStyles } from './text/master-styles';
import { collectOutlineText, decodeTextChars } from './text/text-atoms';
import type { PptRawText } from './text/text-atoms';

/** Everything needed from the compound file. */
export interface PptStreams {
	powerPointDocument: Uint8Array;
	pictures?: Uint8Array;
	offsetToCurrentEdit: number;
	/**
	 * True when the caller has already RC4-decrypted `powerPointDocument`
	 * (and `pictures`, if present) via {@link decryptLegacyPpt}. Skips the
	 * encrypted-session guard below, which otherwise rejects any stream
	 * whose UserEditAtom still references a CryptSession10Container (that
	 * reference is left in place by design; decryption does not rewrite the
	 * administrative records it deliberately leaves untouched).
	 */
	decrypted?: boolean;
}

/** Parse the font collection into font family names. */
function parseFonts(view: DataView, docContainer: PptRecord): string[] {
	const fonts: string[] = [];
	const environment = findChild(view, docContainer, RT.Environment);
	if (!environment) {
		return fonts;
	}
	const collection = findDescendant(view, environment, RT.FontCollection);
	if (!collection) {
		return fonts;
	}
	for (const child of iterateChildren(view, collection)) {
		if (child.recType === RT.FontEntityAtom) {
			// lfFaceName: 64 bytes UTF-16LE, null-terminated.
			const name = decodeTextChars(view, child.dataOffset, Math.min(64, child.recLen));
			const nul = name.indexOf('\0');
			fonts.push(nul >= 0 ? name.slice(0, nul) : name);
		}
	}
	return fonts;
}

/** Read slide persist references from a SlideListWithText (instance 0). */
function readSlidePersistIds(view: DataView, slideList: PptRecord): number[] {
	const ids: number[] = [];
	for (const child of iterateChildren(view, slideList)) {
		if (child.recType === RT.SlidePersistAtom && child.recLen >= 4) {
			ids.push(view.getUint32(child.dataOffset, true));
		}
	}
	return ids;
}

/** Resolve slide order: SlideListWithText order, else directory order. */
function resolveSlideOrder(
	view: DataView,
	docContainer: PptRecord,
	directory: PersistDirectory,
	scheme: PptColorScheme,
): { persistIds: number[]; outline: Map<number, PptRawText[]> } {
	for (const child of iterateChildren(view, docContainer)) {
		if (child.recType === RT.SlideListWithText && child.recInstance === 0x000) {
			return {
				persistIds: readSlidePersistIds(view, child),
				outline: collectOutlineText(view, child, scheme),
			};
		}
	}
	// Fallback: every persist entry that resolves to a SlideContainer.
	const persistIds: number[] = [];
	for (const [id, offset] of directory) {
		const rec = readRecordOrThrow(view, offset);
		if (rec.recType === RT.Slide) {
			persistIds.push(id);
		}
	}
	persistIds.sort((a, b) => a - b);
	return { persistIds, outline: new Map() };
}

/** Locate the BStore within the document's drawing group, if present. */
function findBStore(view: DataView, docContainer: PptRecord): PptRecord | undefined {
	const drawingGroup = findChild(view, docContainer, RT.DrawingGroup);
	if (!drawingGroup) {
		return undefined;
	}
	return findDescendant(view, drawingGroup, OA.BStoreContainer);
}

/**
 * Parse the live document from the PowerPoint Document stream.
 *
 * @param streams - Stream bytes plus the CurrentUserAtom edit offset.
 * @returns The parsed deck model.
 */
export async function parseDeck(streams: PptStreams): Promise<PptDeck> {
	const data = streams.powerPointDocument;
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

	const { currentEdit, directory } = buildPersistDirectory(view, streams.offsetToCurrentEdit);
	if (
		currentEdit.encryptSessionPersistIdRef !== undefined &&
		currentEdit.encryptSessionPersistIdRef !== 0 &&
		!streams.decrypted
	) {
		throw new EncryptedPptError();
	}
	const docOffset = directory.get(currentEdit.docPersistIdRef);
	if (docOffset === undefined) {
		throw new PptParseError('DocumentContainer persist object not found');
	}
	const docContainer = readRecordOrThrow(view, docOffset);
	if (docContainer.recType !== RT.Document) {
		throw new PptParseError(`Persist id ${currentEdit.docPersistIdRef} is not a DocumentContainer`);
	}

	// DocumentAtom: slide size in master units.
	let widthEmu = 9144000;
	let heightEmu = 6858000;
	const docAtom = findChild(view, docContainer, RT.DocumentAtom);
	if (docAtom && docAtom.recLen >= 40) {
		widthEmu = masterToEmu(view.getInt32(docAtom.dataOffset, true));
		heightEmu = masterToEmu(view.getInt32(docAtom.dataOffset + 4, true));
	}

	const fonts = parseFonts(view, docContainer);

	// Main master: first entry of the MasterListWithText (instance 1).
	let masterPersistId: number | undefined;
	for (const child of iterateChildren(view, docContainer)) {
		if (child.recType === RT.SlideListWithText && child.recInstance === 0x001) {
			const ids = readSlidePersistIds(view, child);
			masterPersistId = ids[0];
			break;
		}
	}

	const docScheme = findSchemeColors(view, docContainer) ?? DEFAULT_SCHEME;
	let scheme: PptColorScheme = docScheme;
	let masterBackgroundRgb: string | undefined;
	let masterShapes: PptDeck['masterShapes'] = [];
	let titleStyles: PptDeck['titleStyles'] = [];
	let bodyStyles: PptDeck['bodyStyles'] = [];

	const masterOffset = masterPersistId !== undefined ? directory.get(masterPersistId) : undefined;
	if (masterOffset !== undefined) {
		const masterRec = readRecordOrThrow(view, masterOffset);
		if (masterRec.recType === RT.MainMaster) {
			const master = parseMasterContainer(view, data, fonts, docScheme, masterRec);
			if (master.scheme) {
				scheme = master.scheme;
			}
			masterBackgroundRgb = master.backgroundRgb;
			masterShapes = master.shapes;
			const styles = collectMasterStyles(view, masterRec, scheme, fonts);
			titleStyles = styles.titleStyles;
			bodyStyles = styles.bodyStyles;
		}
	}

	// Slides in presentation order.
	const { persistIds, outline } = resolveSlideOrder(view, docContainer, directory, scheme);
	const slides: PptSlideModel[] = [];
	for (const persistId of persistIds) {
		const offset = directory.get(persistId);
		if (offset === undefined) {
			continue;
		}
		const rec = readRecordOrThrow(view, offset);
		if (rec.recType !== RT.Slide) {
			continue;
		}
		slides.push(
			parseSlideContainer(
				{
					view,
					data,
					fonts,
					masterScheme: scheme,
					outlineText: outline.get(persistId),
				},
				rec,
			),
		);
	}

	// Pictures.
	const bstoreRec = findBStore(view, docContainer);
	const pictures = await parsePictures(
		streams.pictures,
		bstoreRec ? { view, rec: bstoreRec } : undefined,
	);

	return {
		widthEmu,
		heightEmu,
		slides,
		masterShapes,
		masterBackgroundRgb,
		scheme,
		fonts,
		titleStyles,
		bodyStyles,
		pictures: pictures.map((p) => p ?? { extension: 'png', bytes: new Uint8Array(0) }),
	};
}
