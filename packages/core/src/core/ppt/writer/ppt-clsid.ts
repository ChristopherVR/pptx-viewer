/**
 * PowerPoint 97-2003 Document format storage CLSID
 * (`{64818D10-4F9B-11CF-86EA-00AA00B929E8}`), written into the OLE2
 * container's Root Entry (see `ole2-parser-write.ts`'s `rootClsid`
 * parameter). PowerPoint's own OLE2 reader uses this to identify the
 * storage's document type independently of its stream names: a container
 * with an all-zero CLSID (the previous, encrypted-OOXML-only behaviour of
 * `buildOle2`) is rejected outright with "This version of PowerPoint can't
 * open [file]" before any record-level content is even inspected.
 *
 * @module ppt/writer/ppt-clsid
 */

/** Binary (little-endian Data1/Data2/Data3, as-is Data4) encoding of the CLSID. */
export const PPT_STORAGE_CLSID = new Uint8Array([
	0x10, 0x8d, 0x81, 0x64, 0x9b, 0x4f, 0xcf, 0x11, 0x86, 0xea, 0x00, 0xaa, 0x00, 0xb9, 0x29, 0xe8,
]);
