/**
 * Types, constants, and error classes for the OLE2 parser.
 *
 * Reference: [MS-CFB] Compound Binary File Format
 * @see https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb
 *
 * @module ole2-parser-types
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** OLE2 Compound Binary File magic signature. */
export const OLE_MAGIC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** Special sector index: end of chain. */
export const ENDOFCHAIN = 0xfffffffe;
/** Special sector index: free sector. */
export const FREESECT = 0xffffffff;
/** Special sector index: FAT sector. */
export const FATSECT = 0xfffffffd;
/** Special sector index: DIFAT sector. */
export const DIFSECT = 0xfffffffc;
/** Maximum regular sector index. */
export const MAXREGSECT = 0xfffffffa;

/** Directory entry object type: empty. */
export const ENTRY_TYPE_EMPTY = 0;
/** Directory entry object type: storage (folder). */
export const ENTRY_TYPE_STORAGE = 1;
/** Directory entry object type: stream (file). */
export const ENTRY_TYPE_STREAM = 2;
/** Directory entry object type: root entry. */
export const ENTRY_TYPE_ROOT = 5;

/** Directory entry size is always 128 bytes. */
export const DIR_ENTRY_SIZE = 128;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * Parsed OLE2 directory entry.
 */
export interface Ole2DirectoryEntry {
	/** Entry name (UTF-16LE decoded). */
	name: string;
	/** Object type (ENTRY_TYPE_* constant). */
	type: number;
	/** Starting sector for this entry's data. */
	startSector: number;
	/** Size of the entry's data in bytes. */
	size: number;
	/** Index of the child directory entry (-1 if none). */
	childId: number;
	/** Index of the left sibling directory entry (-1 if none). */
	leftSiblingId: number;
	/** Index of the right sibling directory entry (-1 if none). */
	rightSiblingId: number;
}

/**
 * Parsed OLE2 compound file with stream access.
 */
export interface Ole2File {
	/** All parsed directory entries. */
	entries: Ole2DirectoryEntry[];
	/**
	 * Retrieve a named stream's binary data.
	 *
	 * @param name - The stream name to look up.
	 * @returns The stream data, or undefined if not found.
	 */
	getStream(name: string): Uint8Array | undefined;
}

/* ------------------------------------------------------------------ */
/*  Error                                                              */
/* ------------------------------------------------------------------ */

/**
 * Error thrown when OLE2 parsing fails.
 */
export class Ole2ParseError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'Ole2ParseError';
	}
}
