/**
 * Unwrap/rewrap the OLE2 (MS-CFB) container around a legacy `.xls` (BIFF8)
 * embedding's `Workbook` stream.
 *
 * A real `Excel.Sheet.8` object PowerPoint embeds (`Shapes.AddOLEObject`
 * against a `.xls` file, verified via COM) is a full compound binary file:
 * the BIFF8 record stream `ole-sheet-xls-biff8*.ts` reads/writes lives
 * inside its `Workbook` (or legacy `Book`) stream, alongside sibling
 * streams such as `\x05SummaryInformation` that must survive an edit
 * byte-for-byte. `readOleXlsGrid`/`writeOleXlsNumericCellEdit`/
 * `writeOleXlsStringCellEdit` all operate on the plain BIFF8 stream, so this
 * module is the seam that lets them do that against the real container
 * while a unit test can keep passing a bare BIFF8 array directly (no CFB
 * wrapper): `unwrapXlsBytes` recognises a non-CFB input and hands the bytes
 * back unchanged with no `rewrap`, matching the pre-CFB-aware behaviour.
 *
 * @module ole-sheet-xls-cfb
 */
import { isOle2CompoundFile } from './ole-embedded-extract';
import { parseOle2 } from './ole2-parser-read';
import { ENTRY_TYPE_ROOT, ENTRY_TYPE_STREAM } from './ole2-parser-types';
import { buildOle2 } from './ole2-parser-write';

const WORKBOOK_STREAM_NAMES = ['Workbook', 'Book'];

export interface XlsCfbUnwrap {
	/** The plain BIFF8 record stream to read or edit. */
	workbookBytes: Uint8Array;
	/**
	 * Rebuild the full compound file with an edited `Workbook` stream,
	 * preserving every other stream and the root entry's CLSID unchanged.
	 * Undefined when the original `bytes` were not themselves a compound
	 * file (already a bare BIFF8 stream): callers use the edited bytes
	 * directly in that case.
	 */
	rewrap?: (editedWorkbookBytes: Uint8Array) => Uint8Array;
}

/** Recognise and unwrap a `.xls` payload's CFB container, when it has one. */
export function unwrapXlsBytes(bytes: Uint8Array): XlsCfbUnwrap {
	if (!isOle2CompoundFile(bytes)) {
		return { workbookBytes: bytes };
	}
	try {
		const buffer = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
		const ole = parseOle2(buffer);
		const streamEntry = ole.entries.find(
			(e) => e.type === ENTRY_TYPE_STREAM && WORKBOOK_STREAM_NAMES.includes(e.name),
		);
		const workbookBytes = streamEntry ? ole.getStream(streamEntry.name) : undefined;
		if (!streamEntry || !workbookBytes) {
			return { workbookBytes: bytes };
		}
		const rootClsid = ole.entries.find((e) => e.type === ENTRY_TYPE_ROOT)?.clsid;
		return {
			workbookBytes,
			rewrap: (editedWorkbookBytes) => {
				const streams = new Map<string, Uint8Array>();
				for (const entry of ole.entries) {
					if (entry.type !== ENTRY_TYPE_STREAM) {
						continue;
					}
					const data =
						entry.name === streamEntry.name ? editedWorkbookBytes : ole.getStream(entry.name);
					if (data) {
						streams.set(entry.name, data);
					}
				}
				return new Uint8Array(buildOle2(streams, rootClsid));
			},
		};
	} catch {
		return { workbookBytes: bytes };
	}
}
