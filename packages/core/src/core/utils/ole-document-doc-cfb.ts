import { readDocFib } from './ole-document-doc-fib';
/**
 * Unwrap/rewrap the OLE2 (MS-CFB) container around a legacy `.doc` (Word
 * 97-2003) embedding's `WordDocument` and table (`0Table`/`1Table`) streams.
 *
 * Mirrors `ole-sheet-xls-cfb.ts`'s `.xls` pattern exactly, generalised to two
 * streams that must be edited together (the piece table lives in the table
 * stream, but its FKP pages and text bytes live in `WordDocument`; a
 * paragraph edit touches both). Every other stream (`\x01CompObj`,
 * `\x05SummaryInformation`, etc.) and the root entry's CLSID round-trip
 * byte-for-byte.
 *
 * @module ole-document-doc-cfb
 */
import { isOle2CompoundFile } from './ole-embedded-extract';
import { parseOle2 } from './ole2-parser-read';
import { ENTRY_TYPE_ROOT, ENTRY_TYPE_STREAM } from './ole2-parser-types';
import { buildOle2 } from './ole2-parser-write';

export interface DocCfbUnwrap {
	/** The `WordDocument` stream's bytes. */
	wordDocBytes: Uint8Array;
	/** The `0Table`/`1Table` stream `readDocFib` selected. */
	tableStreamName: '0Table' | '1Table';
	tableBytes: Uint8Array;
	/** Rebuild the full compound file with edited `WordDocument`/table stream bytes, preserving every other stream and the root CLSID. */
	rewrap: (editedWordDocBytes: Uint8Array, editedTableBytes: Uint8Array) => Uint8Array;
}

/** Unwrap a `.doc` payload's CFB container. Returns `undefined` if it is not a readable `WordDocument` CFB payload. */
export function unwrapDocBytes(bytes: Uint8Array): DocCfbUnwrap | undefined {
	if (!isOle2CompoundFile(bytes)) {
		return undefined;
	}
	try {
		const buffer = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
		const ole = parseOle2(buffer);
		const wordDocBytes = ole.getStream('WordDocument');
		if (!wordDocBytes) {
			return undefined;
		}
		const fib = readDocFib(wordDocBytes);
		const tableBytes = ole.getStream(fib.tableStreamName);
		if (!tableBytes) {
			return undefined;
		}
		const rootClsid = ole.entries.find((e) => e.type === ENTRY_TYPE_ROOT)?.clsid;
		return {
			wordDocBytes,
			tableStreamName: fib.tableStreamName,
			tableBytes,
			rewrap: (editedWordDocBytes, editedTableBytes) => {
				const streams = new Map<string, Uint8Array>();
				for (const entry of ole.entries) {
					if (entry.type !== ENTRY_TYPE_STREAM) {
						continue;
					}
					const data =
						entry.name === 'WordDocument'
							? editedWordDocBytes
							: entry.name === fib.tableStreamName
								? editedTableBytes
								: ole.getStream(entry.name);
					if (data) {
						streams.set(entry.name, data);
					}
				}
				return new Uint8Array(buildOle2(streams, rootClsid));
			},
		};
	} catch {
		return undefined;
	}
}
