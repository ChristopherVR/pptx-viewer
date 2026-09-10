/**
 * Binary `.ppt` OLE embed writer: wraps an arbitrary embedded payload (the
 * bytes already carried on `OlePptxElement.oleEmbeddedData`) as a classic
 * Windows "OLE Package" object (`\1CompObj` + `\1Ole10Native` streams inside
 * its own nested OLE2 compound file), then the `ExOleEmbedContainer` /
 * `ExOleObjAtom` / `ExOleEmbedAtom` records that reference it.
 *
 * ## Why "Package" for every embed, regardless of the original ProgID
 *
 * A genuinely native embed (e.g. a real `Excel.Sheet.12` binary BIFF
 * storage) needs that application's own on-disk storage format, which this
 * project cannot fabricate from an arbitrary payload (`oleEmbeddedData` may
 * be a modern `.xlsx`/`.docx` ZIP, a PDF, or any other file the source
 * `.pptx` embedded). The "OLE Package" object type Windows itself falls
 * back to for exactly this situation (`Insert Object > Create from File`
 * for a file type with no registered content-editable OLE server) has one
 * well-defined, content-independent storage shape and its primary verb
 * (`Activate`/`DoVerb`) simply opens the packaged file with its shell
 * association: every embed this writer produces behaves the same way,
 * which is the same guarantee `ppaction://ole` already assumes elsewhere
 * in this codebase.
 *
 * ## Ground truth
 *
 * Every byte layout here (the `\1CompObj` template, `\1Ole10Native`'s full
 * field sequence including its trailing Unicode mirror section, the root
 * storage CLSID, `ExOleObjAtom`'s `drawAspect`/`type`/`subType`, the
 * picture shape's own extra FOPT properties) is copied from a COM-authored
 * ground-truth fixture: real PowerPoint's own `Shapes.AddOLEObject` on a
 * plain file, saved via `Presentations.SaveAs(..., ppSaveAsPPT)` and
 * inspected with this project's own record reader.
 *
 * Getting real PowerPoint to accept a from-scratch embed took THREE
 * separate fixes past the spec-plausible first draft, found by reverse-
 * bisecting against the ground-truth fixture one piece at a time (each
 * alone still failed "Office has detected a problem with this file"):
 *   1. `\1Ole10Native`'s trailing Unicode mirror section (see
 *      `buildOle10Native`'s doc comment) - omitting it looked like a
 *      harmless redundant tail since `dataSize` alone bounds the payload,
 *      but real Office validates the WHOLE stream shape, not just what a
 *      consumer strictly needs to read.
 *   2. `MenuNameAtom` must be the class's fixed shell name
 *      (`"Packager Shell Object"`), never the embedded file's own name
 *      (see `PACKAGER_MENU_NAME`).
 *   3. The shape's own `OfficeArtFSP.grfPersistent` needs `fOleShape`
 *      (`0x0010`) set, AND its FOPT needs `pib`'s `fBid` bit plus two
 *      more boilerplate picture properties PowerPoint always writes (see
 *      `shape-writer.ts`'s `FSP_FLAG_OLE_SHAPE` and
 *      `shape-props-writer.ts`'s `buildShapeFoptProps`) - this one is not
 *      actually OLE-specific: it turned out a PLAIN (non-OLE) picture
 *      shape from this writer had never been opened through real
 *      PowerPoint before either, since `com-acceptance-ppt.mjs` never
 *      exercised `addImage`.
 *
 * @module ppt/writer/ole-writer
 */

import { buildOle2 } from '../../utils/ole2-parser-write';
import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import type { HyperlinkCollector } from './hyperlink-writer';
import type { WOleEmbed } from './write-model';

/** Root storage CLSID for a Windows "OLE Package" object: `{0003000C-0000-0000-C000-000000000046}`. */
const PACKAGE_ROOT_CLSID = new Uint8Array([
	0x0c, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46,
]);

/**
 * The `\1CompObj` stream is content-independent for a "Package" object
 * (`AnsiUserType` = "OLE Package", `AnsiClipboardFormat` = "Package"):
 * copied verbatim from the ground-truth fixture rather than re-derived,
 * since its exact byte meaning past the two ANSI strings is undocumented.
 */
const COMP_OBJ_HEX =
	'0100feff030a0000ffffffff0c00030000000000c0000000000000460c0000004f4c45205061636b6167650000000000080000005061636b61676500f439b271000000000000000000000000';

function hexToBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

/** Encode `text` as a NUL-terminated ANSI (Latin-1 subset) byte string. */
function ansiZ(text: string): Uint8Array {
	const out = new Uint8Array(text.length + 1);
	for (let i = 0; i < text.length; i++) {
		out[i] = text.charCodeAt(i) & 0xff;
	}
	return out;
}

/** Encode `text` as UTF-16LE with NO terminator (used only for the trailing Unicode mirror fields below). */
function utf16NoZ(text: string): Uint8Array {
	const out = new Uint8Array(text.length * 2);
	const view = new DataView(out.buffer);
	for (let i = 0; i < text.length; i++) {
		view.setUint16(i * 2, text.charCodeAt(i), true);
	}
	return out;
}

/**
 * Build the `\1Ole10Native` stream: `streamSize` (u32, byte count
 * following this field) + `flags1` (u16, `2` = embedded) + NUL-terminated
 * `label` + NUL-terminated `fileName` + two reserved u16s (`0`, `3`) +
 * length-prefixed ANSI `command` + `dataSize` (u32) + `data`, followed by
 * three MORE length-prefixed fields (length in UTF-16 CODE UNITS, no
 * terminator): a Unicode mirror of `command`, then `label`, then
 * `fileName`, in that exact order. Office's own file-open validation
 * rejects a `Package` object missing this trailing section outright
 * ("Office has detected a problem with this file"), confirmed by
 * reverse-bisecting an earlier, spec-plausible but incomplete version of
 * this function against the COM-authored ground-truth fixture: appending
 * these three fields (empirically located by the exact byte count they
 * account for: this fixture's stream is `876` bytes, of which the section
 * this function's first version omitted comes to exactly `560` trailing
 * bytes = `4+127*2 + 4+12*2 + 4+135*2`, one 4-byte length + UTF-16 payload
 * per field) was the only change needed to make a from-scratch OLE embed
 * open in real PowerPoint again.
 */
function buildOle10Native(label: string, sourcePath: string, data: Uint8Array): Uint8Array {
	const labelZ = ansiZ(label);
	const pathZ = ansiZ(sourcePath);
	const commandZ = ansiZ(sourcePath);
	const commandU = utf16NoZ(sourcePath);
	const labelU = utf16NoZ(label);
	const fileNameU = utf16NoZ(sourcePath);
	const body = new ByteWriter()
		.u16(2) // flags1: embedded (not linked)
		.bytes(labelZ)
		.bytes(pathZ)
		.u16(0)
		.u16(3)
		.u32(commandZ.length)
		.bytes(commandZ)
		.u32(data.length)
		.bytes(data)
		.u32(sourcePath.length)
		.bytes(commandU)
		.u32(label.length)
		.bytes(labelU)
		.u32(sourcePath.length)
		.bytes(fileNameU)
		.toBytes();
	return new ByteWriter().u32(body.length).bytes(body).toBytes();
}

/**
 * Build the nested OLE2 compound file (`\1CompObj` + `\1Ole10Native`) that
 * `ExOleObjStg` wraps, given the embedded payload and a display label.
 */
export function buildPackageStorage(
	label: string,
	sourcePath: string,
	data: Uint8Array,
): Uint8Array {
	const streams = new Map<string, Uint8Array>();
	streams.set('CompObj', hexToBytes(COMP_OBJ_HEX));
	streams.set('Ole10Native', buildOle10Native(label, sourcePath, data));
	return new Uint8Array(buildOle2(streams, PACKAGE_ROOT_CLSID));
}

/** Build the framed `ExOleObjStgUncompressedAtom` wrapping `storage`. */
export function buildExOleObjStg(storage: Uint8Array): Uint8Array {
	return record(RT.ExternalOleObjectStg, storage, 0, false, 0);
}

/** Build the 8-byte `ExOleEmbedAtom`: no colour-follow, server cannot be locked. */
function buildExOleEmbedAtom(): Uint8Array {
	const data = new ByteWriter()
		.u32(0) // exColorFollow: ExColorFollow_None
		.u8(1) // fCantLockServer: true, matches the ground-truth fixture
		.u8(0) // fNoSizeToServer
		.u8(0) // fIsTable
		.u8(0) // unused
		.toBytes();
	return record(RT.ExternalOleEmbedAtom, data, 0, false, 0);
}

/** [MS-PPT] ExOleObjTypeEnum.ExOle_Embedded. */
const EX_OLE_EMBEDDED = 0;
/** [MS-PPT] DataViewAspectEnum (MS-OSHARED): DVASPECT_ICON. */
const DV_ASPECT_ICON = 4;
/** [MS-PPT] ExOleObjSubTypeEnum.ExOleSub_Default. */
const EX_OLE_SUB_DEFAULT = 0;

/** Build the 24-byte `ExOleObjAtom` (recVer=1) referencing `exObjId`/`persistIdRef`. */
function buildExOleObjAtom(exObjId: number, persistIdRef: number): Uint8Array {
	const data = new ByteWriter()
		.u32(DV_ASPECT_ICON)
		.u32(EX_OLE_EMBEDDED)
		.u32(exObjId)
		.u32(EX_OLE_SUB_DEFAULT)
		.u32(persistIdRef)
		.u32(0) // unused
		.toBytes();
	return record(RT.ExternalOleObjectAtom, data, 0, false, 1);
}

function buildCString(text: string, recInstance: number): Uint8Array {
	return record(RT.CString, new ByteWriter().utf16(text).toBytes(), recInstance, false, 0);
}

/**
 * `MenuNameAtom`'s fixed value for every "Package" embed: the registered
 * shell menu name of the Package OLE server itself, NOT the embedded
 * file's own name (confirmed against the ground-truth fixture: real
 * PowerPoint writes this exact string there regardless of what file was
 * embedded). Getting this wrong was one of two causes (see
 * `buildOle10Native`'s doc comment for the other) behind Office's file-open
 * validation rejecting a from-scratch OLE embed outright.
 */
const PACKAGER_MENU_NAME = 'Packager Shell Object';

/**
 * Build the `ExOleEmbedContainer` for one embedded OLE object: atoms first
 * (`ExOleEmbedAtom`, `ExOleObjAtom`), then `MenuNameAtom` (recInstance 1,
 * always `PACKAGER_MENU_NAME`), `ProgIDAtom` (recInstance 2, always
 * `"Package"`; see this module's doc comment), `ClipboardNameAtom`
 * (recInstance 3). No `MetafileBlob`: the ground-truth fixture omits it
 * too, and the shape's own picture-frame preview (see
 * `element-to-write-model.ts`) already supplies the icon.
 */
export function buildExOleEmbedContainer(exObjId: number, persistIdRef: number): Uint8Array {
	const w = new ByteWriter()
		.bytes(buildExOleEmbedAtom())
		.bytes(buildExOleObjAtom(exObjId, persistIdRef))
		.bytes(buildCString(PACKAGER_MENU_NAME, 1))
		.bytes(buildCString('Package', 2))
		.bytes(buildCString('Package', 3));
	return record(RT.ExternalOleEmbed, w.toBytes(), 0, true);
}

/** Build the 4-byte `ExObjRefAtom` referencing `exObjId`, for a shape's `OfficeArtClientData`. */
export function buildExObjRefAtom(exObjId: number): Uint8Array {
	return record(RT.ExternalObjectRefAtom, new ByteWriter().u32(exObjId).toBytes(), 0, false, 0);
}

/** One registered OLE embed, keyed by its allocated `exObjId`. */
export interface OleEntry {
	exObjId: number;
	label: string;
	/** The nested OLE2 compound file bytes (`buildPackageStorage`'s output). */
	storage: Uint8Array;
	/**
	 * The persist id this embed's `ExOleObjStg` was laid out at. Unset until
	 * `document-stream-layout.ts` has assigned one (shape/text building runs
	 * before persist ids exist at all), then filled in before the
	 * `ExOleEmbedContainer` is built.
	 */
	persistIdRef?: number;
}

/**
 * Accumulates every OLE embed referenced anywhere in the deck, so
 * `layoutDocumentStream` can lay out each one's `ExOleObjStg` as its own
 * persist object and then emit the matching `ExOleEmbedContainer` entries
 * in the document-level `ExObjListContainer` alongside any hyperlinks (see
 * `hyperlink-writer.ts#buildExObjList`).
 */
export class OleCollector {
	private entries: OleEntry[] = [];

	/**
	 * @param hyperlinks - `exObjId` and `ExHyperlinkId` share one id space
	 *   (see `HyperlinkCollector.allocateId`'s doc comment), so this
	 *   collector allocates through the SAME counter rather than keeping a
	 *   second one that could collide.
	 */
	public constructor(private readonly hyperlinks: HyperlinkCollector) {}

	/** Register an embed, returning its newly allocated `exObjId`. */
	public register(embed: WOleEmbed): number {
		const exObjId = this.hyperlinks.allocateId();
		this.entries.push({
			exObjId,
			label: embed.label,
			storage: buildPackageStorage(embed.label, embed.label, embed.data),
		});
		return exObjId;
	}

	/** Every registered entry, in registration order (mutable: `persistIdRef` is filled in later). */
	public get all(): OleEntry[] {
		return this.entries;
	}

	public get isEmpty(): boolean {
		return this.entries.length === 0;
	}
}
