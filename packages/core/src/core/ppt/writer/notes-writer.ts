/**
 * Notes container writer.
 *
 * The project's `.ppt` IMPORTER does not parse `RT.Notes` containers at all
 * (`document-parser.ts` never looks for one), so a round-trip through our
 * own importer cannot verify notes text; this writer still emits a correct
 * container for real PowerPoint, verified via COM (`Slide.NotesPage`).
 *
 * @module ppt/writer/notes-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import { buildDrawing } from './drawing-writer';
import type { HyperlinkCollector } from './hyperlink-writer';
import type { MediaCollector } from './media-writer';
import type { OleCollector } from './ole-writer';
import type { WParagraph, WRect, WShape } from './write-model';

function buildNotesAtom(slidePersistIdRef: number): Uint8Array {
	const data = new ByteWriter().i32(slidePersistIdRef).u16(0).u16(0).toBytes();
	return record(RT.NotesAtom, data, 0, false, 1);
}

/** Build a framed `Notes` container with a single body text placeholder. */
export function buildNotesContainer(
	paragraphs: WParagraph[],
	notesRect: WRect,
	slidePersistIdRef: number,
	fonts: string[],
	drawingId: number,
	hyperlinks: HyperlinkCollector,
	oleEmbeds: OleCollector,
	mediaEmbeds: MediaCollector,
): Uint8Array {
	const bodyShape: WShape = {
		kind: 'shape',
		spt: 202,
		isConnector: false,
		anchor: notesRect,
		placeholderType: 'body',
		text: { textType: 2, paragraphs },
	};
	const data = new ByteWriter()
		.bytes(buildNotesAtom(slidePersistIdRef))
		.bytes(
			buildDrawing(
				notesRect,
				[bodyShape],
				undefined,
				fonts,
				drawingId,
				hyperlinks,
				oleEmbeds,
				mediaEmbeds,
			),
		)
		.toBytes();
	return record(RT.Notes, data, 0, true);
}
