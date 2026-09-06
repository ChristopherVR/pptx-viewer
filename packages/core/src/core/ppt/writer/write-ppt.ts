/**
 * Top-level orchestrator for the legacy binary `.ppt` writer: lays out the
 * "PowerPoint Document" stream (see `document-stream-layout.ts`), appends
 * the persist directory and user edit (RC4-encrypting the content when a
 * password is given), builds the "Current User" and optional "Pictures"
 * streams, and wraps everything in an OLE2 compound file via the existing
 * `buildOle2`.
 *
 * @module ppt/writer/write-ppt
 */

import { buildOle2 } from '../../utils/ole2-parser-write';
import { ByteWriter } from './byte-writer';
import { buildCurrentUserStream } from './current-user-writer';
import { layoutDocumentStream } from './document-stream-layout';
import { buildCryptSession, encryptDocumentStream, encryptPicturesStream } from './encrypt-writer';
import {
	buildEncryptedUserEditAtom,
	buildPersistDirectoryAtom,
	buildUserEditAtom,
} from './persist-writer';
import { PPT_STORAGE_CLSID } from './ppt-clsid';
import type { WDeck } from './write-model';

/** Options for building a legacy `.ppt` file. */
export interface BuildPptOptions {
	/** Encrypts the output with RC4 CryptoAPI encryption when given. */
	password?: string;
}

/** Result of appending the persist directory + user edit to a document stream layout. */
interface FinishedStream {
	documentBytes: Uint8Array;
	picturesBytes: Uint8Array | undefined;
	offsetToCurrentEdit: number;
}

async function finishUnencrypted(
	layout: ReturnType<typeof layoutDocumentStream>,
	lastSlideId: number,
): Promise<FinishedStream> {
	const w = new ByteWriter().append(layout.bytes);
	const dirAtom = buildPersistDirectoryAtom(layout.offsets);
	const dirOffset = w.size;
	w.bytes(dirAtom);
	const userEdit = buildUserEditAtom({
		offsetPersistDirectory: dirOffset,
		docPersistIdRef: layout.docId,
		maxPersistWritten: layout.maxPersistId,
		lastSlideId,
	});
	const offsetToCurrentEdit = w.size;
	w.bytes(userEdit);
	return { documentBytes: w.toBytes(), picturesBytes: layout.picturesStream, offsetToCurrentEdit };
}

async function finishEncrypted(
	layout: ReturnType<typeof layoutDocumentStream>,
	lastSlideId: number,
	password: string,
): Promise<FinishedStream> {
	const ctx = await buildCryptSession(password);
	const cryptId = layout.maxPersistId + 1;
	const w = new ByteWriter().append(layout.bytes);
	const cryptOffset = w.size;
	w.bytes(ctx.cryptSessionRecord);

	const dirAtom = buildPersistDirectoryAtom([...layout.offsets, [cryptId, cryptOffset]]);
	const dirOffset = w.size;
	w.bytes(dirAtom);

	const userEdit = buildEncryptedUserEditAtom({
		offsetPersistDirectory: dirOffset,
		docPersistIdRef: layout.docId,
		maxPersistWritten: cryptId,
		lastSlideId,
		encryptSessionPersistIdRef: cryptId,
	});
	const offsetToCurrentEdit = w.size;
	w.bytes(userEdit);

	const skipRanges = [
		{ start: cryptOffset, end: cryptOffset + ctx.cryptSessionRecord.length },
		{ start: dirOffset, end: dirOffset + dirAtom.length },
		{ start: offsetToCurrentEdit, end: offsetToCurrentEdit + userEdit.length },
	];
	const documentBytes = await encryptDocumentStream(w.toBytes(), skipRanges, ctx);
	const picturesBytes = layout.picturesStream
		? await encryptPicturesStream(layout.picturesStream, ctx)
		: undefined;
	return { documentBytes, picturesBytes, offsetToCurrentEdit };
}

/** Build a complete legacy binary `.ppt` (OLE2 compound file) from `deck`. */
export async function buildPptFile(
	deck: WDeck,
	options: BuildPptOptions = {},
): Promise<Uint8Array> {
	const layout = layoutDocumentStream(deck);
	const lastSlideId = 256 + Math.max(0, deck.slides.length - 1);
	const encrypted = Boolean(options.password);

	const finished = encrypted
		? await finishEncrypted(layout, lastSlideId, options.password!)
		: await finishUnencrypted(layout, lastSlideId);

	const currentUser = buildCurrentUserStream(finished.offsetToCurrentEdit, encrypted);

	const streams = new Map<string, Uint8Array>();
	streams.set('Current User', currentUser);
	streams.set('PowerPoint Document', finished.documentBytes);
	if (finished.picturesBytes && finished.picturesBytes.length > 0) {
		streams.set('Pictures', finished.picturesBytes);
	}

	// miniStreamCutoff=0: see buildOle2's doc comment. A tiny deck's `Current
	// User` / `PowerPoint Document` streams are small enough to qualify for
	// the mini stream, which real PowerPoint's COM-driven CFB reader rejects
	// even though this writer's mini-FAT implementation is spec-correct and
	// round-trips through our own reader; real PowerPoint-authored files
	// sidestep this by padding those streams to the 4096-byte cutoff instead.
	return new Uint8Array(buildOle2(streams, PPT_STORAGE_CLSID, 0));
}
