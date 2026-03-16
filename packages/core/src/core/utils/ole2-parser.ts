/**
 * Minimal OLE2 Compound Binary File (CBFF) parser.
 *
 * Reads the OLE2 container structure used by encrypted OOXML packages
 * to extract named streams (e.g. "EncryptionInfo", "EncryptedPackage").
 *
 * Reference: [MS-CFB] Compound Binary File Format
 * @see https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb
 *
 * @module ole2-parser
 */

// Re-export types, constants, and error class
export {
	OLE_MAGIC,
	ENDOFCHAIN,
	FREESECT,
	FATSECT,
	DIFSECT,
	MAXREGSECT,
	ENTRY_TYPE_EMPTY,
	ENTRY_TYPE_STORAGE,
	ENTRY_TYPE_STREAM,
	ENTRY_TYPE_ROOT,
	DIR_ENTRY_SIZE,
	Ole2ParseError,
	type Ole2DirectoryEntry,
	type Ole2File,
} from './ole2-parser-types';

// Re-export reader
export { parseOle2 } from './ole2-parser-read';

// Re-export writer
export { buildOle2 } from './ole2-parser-write';
