/**
 * Lays out every persist object of the "PowerPoint Document" stream
 * (DocumentContainer, MainMaster, one Slide per slide, optional Notes
 * containers) sequentially and records each one's offset, ready for
 * `write-ppt.ts` to append the persist directory / user edit and optionally
 * encrypt.
 *
 * @module ppt/writer/document-stream-layout
 */

import { buildPictureStore } from './bstore-writer';
import { ByteWriter } from './byte-writer';
import {
	buildDocumentContainer,
	buildSlidePersistAtom,
	MASTER_SLIDE_ID_SENTINEL,
} from './document-writer';
import { buildExObjList } from './ex-obj-list-writer';
import { HyperlinkCollector } from './hyperlink-writer';
import { buildSoundCollection, MediaCollector } from './media-writer';
import { buildNotesContainer } from './notes-writer';
import { buildExOleObjStg, OleCollector } from './ole-writer';
import { buildMainMasterContainer, buildSlideContainer } from './slide-writer';
import type { WDeck } from './write-model';

/** Count every shape (recursively) in one drawing's shape list, +1 for the patriarch. */
function countDrawingShapes(shapes: WDeck['slides'][number]['shapes']): number {
	let count = 1;
	const walk = (list: WDeck['slides'][number]['shapes']): void => {
		for (const shape of list) {
			count++;
			if (shape.kind === 'group') {
				walk(shape.children);
			}
		}
	};
	walk(shapes);
	return count;
}

/** Collect every distinct font name referenced anywhere in the deck. */
function collectFonts(deck: WDeck): string[] {
	const collect = (shape: WDeck['slides'][number]['shapes'][number]): string[] => {
		if (shape.kind === 'group') {
			return shape.children.flatMap(collect);
		}
		if (shape.kind !== 'shape' || !shape.text) {
			return [];
		}
		return shape.text.paragraphs.flatMap((p) =>
			p.runs.map((r) => r.fontName).filter((n): n is string => Boolean(n)),
		);
	};
	const fonts = Array.from(new Set(deck.slides.flatMap((slide) => slide.shapes.flatMap(collect))));
	return fonts.length > 0 ? fonts : ['Calibri'];
}

/** Result of laying out the unencrypted document stream. */
export interface DocumentStreamLayout {
	bytes: ByteWriter;
	offsets: Array<[number, number]>;
	docId: number;
	maxPersistId: number;
	picturesStream: Uint8Array | undefined;
}

/** Persist id of the DocumentContainer. */
export const DOC_ID = 1;
/** Persist id of the MainMaster. */
export const MASTER_ID = 2;

/** Lay out the full unencrypted "PowerPoint Document" stream content. */
export function layoutDocumentStream(deck: WDeck): DocumentStreamLayout {
	const slideRect = { x: 0, y: 0, w: deck.widthEmu, h: deck.heightEmu };
	const notesRect = { x: 0, y: 0, w: deck.heightEmu, h: deck.widthEmu };

	const slideIds = deck.slides.map((_, i) => 3 + i);
	let nextId = 3 + deck.slides.length;
	const notesIds = deck.slides.map((slide) => (slide.notesParagraphs?.length ? nextId++ : 0));

	// Drawing ids: 1 = master, 2..N+1 = slides in order, then one per slide
	// that has notes. Every drawing in the document needs a distinct id (see
	// `drawing-writer.ts#buildDrawing`'s doc comment).
	const masterDrawingId = 1;
	const slideDrawingIds = deck.slides.map((_, i) => 2 + i);
	let nextDrawingId = 2 + deck.slides.length;
	const notesDrawingIds = deck.slides.map((slide) =>
		slide.notesParagraphs?.length ? nextDrawingId++ : 0,
	);
	const shapesPerDrawing = [
		1, // master: patriarch only, no decorative shapes
		...deck.slides.map((slide) => countDrawingShapes(slide.shapes)),
		...deck.slides.filter((s) => s.notesParagraphs?.length).map(() => 2), // patriarch + body placeholder
	];

	const fonts = collectFonts(deck);
	const { dggContainer, picturesStream } = buildPictureStore(deck.pictures, shapesPerDrawing);

	// Document-wide: every hyperlink/click-action target, every OLE embed, and
	// every embedded audio shape anywhere in the deck (shape and text-run
	// level, across every slide, notes page and the master) shares these
	// three collectors, matching real PowerPoint's single document-level
	// ExObjListContainer (see `ex-obj-list-writer.ts`) and (for audio) single
	// document-level SoundCollectionContainer (see `media-writer.ts`).
	const hyperlinks = new HyperlinkCollector();
	const oleEmbeds = new OleCollector(hyperlinks);
	const mediaEmbeds = new MediaCollector(hyperlinks);

	const slideContainers = deck.slides.map((slide, i) =>
		buildSlideContainer(
			slide,
			slideRect,
			MASTER_ID,
			notesIds[i]!,
			fonts,
			slideDrawingIds[i]!,
			hyperlinks,
			oleEmbeds,
			mediaEmbeds,
		),
	);
	const notesContainers = deck.slides
		.map((slide, i) =>
			notesIds[i]
				? buildNotesContainer(
						slide.notesParagraphs!,
						notesRect,
						slideIds[i]!,
						fonts,
						notesDrawingIds[i]!,
						hyperlinks,
						oleEmbeds,
						mediaEmbeds,
					)
				: undefined,
		)
		.filter((c): c is Uint8Array => c !== undefined);

	const masterContainer = buildMainMasterContainer(
		slideRect,
		masterDrawingId,
		hyperlinks,
		oleEmbeds,
		mediaEmbeds,
	);
	const masterPersistAtom = buildSlidePersistAtom(MASTER_ID, MASTER_SLIDE_ID_SENTINEL);
	// flags=4: real (COM-written) files set this bit on a SLIDE's own
	// SlidePersistAtom (never on a master's); see buildSlidePersistAtom's doc.
	const slidePersistAtoms = slideIds.map((id, i) => buildSlidePersistAtom(id, 256 + i, 4));

	// Every OLE embed's ExOleObjStg is its own persist object (referenced by
	// ExOleObjAtom.persistIdRef), allocated AFTER every slide/notes/master
	// container above so every embed anywhere in the deck has already been
	// registered. One entry per embed, appended to the same id sequence notes
	// used.
	const oleStgIds = oleEmbeds.all.map(() => nextId++);
	oleEmbeds.all.forEach((entry, i) => {
		entry.persistIdRef = oleStgIds[i];
	});
	const oleStgRecords = oleEmbeds.all.map((entry) => buildExOleObjStg(entry.storage));

	// Built AFTER every slide/notes/master container above so every
	// hyperlink/OLE/media target referenced anywhere in the deck has already
	// been registered.
	const exObjList = buildExObjList(hyperlinks, oleEmbeds, mediaEmbeds);
	const soundCollection = buildSoundCollection(mediaEmbeds);

	const documentInput = {
		widthEmu: deck.widthEmu,
		heightEmu: deck.heightEmu,
		fonts,
		masterPersistAtom,
		slidePersistAtoms,
		dggContainer,
		exObjList,
		soundCollection,
	};
	const maxPersistId = nextId - 1;
	const contentSizeWithoutPadding =
		buildDocumentContainer(documentInput).length +
		masterContainer.length +
		slideContainers.reduce((sum, c) => sum + c.length, 0) +
		notesContainers.reduce((sum, c) => sum + c.length, 0) +
		oleStgRecords.reduce((sum, c) => sum + c.length, 0);
	const paddingBytes = ensureMinimumDocumentStreamSize(contentSizeWithoutPadding, maxPersistId);
	const documentContainer = buildDocumentContainer({ ...documentInput, paddingBytes });

	const layout = new ByteWriter();
	const offsets: Array<[number, number]> = [];
	const place = (id: number, bytes: Uint8Array): void => {
		offsets.push([id, layout.size]);
		layout.bytes(bytes);
	};
	place(DOC_ID, documentContainer);
	place(MASTER_ID, masterContainer);
	slideIds.forEach((id, i) => place(id, slideContainers[i]!));
	let notesCursor = 0;
	notesIds.forEach((id) => {
		if (id) {
			place(id, notesContainers[notesCursor++]!);
		}
	});
	oleStgIds.forEach((id, i) => place(id, oleStgRecords[i]!));

	return { bytes: layout, offsets, docId: DOC_ID, maxPersistId, picturesStream };
}

/**
 * How many extra bytes `buildDocumentContainer` needs as a padding `List`
 * record so the finished "PowerPoint Document" stream (this content, plus
 * the `PersistDirectoryAtom` and `UserEditAtom` `write-ppt.ts` appends
 * after it) ends up in a STRICTLY LARGER 512-byte CFB sector count than the
 * 4096-byte (8-sector) "Current User" stream `current-user-writer.ts`
 * always writes.
 *
 * Confirmed required by direct COM testing across a size sweep (both by
 * slide count and by run length, independently): `Presentations.Open`
 * fails whenever "PowerPoint Document" is <= 4096 bytes (tied with or
 * smaller than "Current User"'s sector count) and succeeds once it reaches
 * 4608 bytes (9 sectors) - a boundary unrelated to slide count, persist-id
 * count, or any of this writer's other fixes. Real PowerPoint never needs
 * this: with a full embedded theme, its own "PowerPoint Document" is always
 * orders of magnitude past this threshold already.
 */
function ensureMinimumDocumentStreamSize(
	contentSizeWithoutPadding: number,
	maxPersistId: number,
): number {
	const CFB_SECTOR_SIZE = 512;
	const CURRENT_USER_STREAM_SIZE = 4096;
	const TARGET_MINIMUM = CURRENT_USER_STREAM_SIZE + CFB_SECTOR_SIZE; // 4608: one whole sector past Current User
	// PersistDirectoryAtom (one contiguous run: 8-byte record header + 4-byte
	// group header + 4 bytes per persist id) + UserEditAtom (8-byte record
	// header + 28-byte data = 36 bytes), matching persist-writer.ts exactly.
	const persistTailSize = 8 + 4 + 4 * maxPersistId + 36;
	const projectedTotal = contentSizeWithoutPadding + persistTailSize;
	return Math.max(0, TARGET_MINIMUM - projectedTotal);
}
