/**
 * Binary `.ppt` embedded-audio writer: `SoundCollectionContainer` /
 * `SoundContainer` (document level) plus the `ExWAVAudioEmbeddedContainer`
 * entries in the document `ExObjListContainer` (see `ex-obj-list-writer.ts`)
 * that reference them, and the shape-level `ExObjRefAtom` (reused from
 * `ole-writer.ts`) that ties a shape to its `ExMediaAtom`.
 *
 * ## Ground truth, and why this writer goes BEYOND it
 *
 * Every record shape here is [MS-PPT] 2.4.16 (Sound records) and 2.10.6-9
 * (Ex-media records), confirmed field-for-field against a COM-authored
 * fixture: `PowerPoint.Application` (16.0) with `Shapes.AddMediaObject2`
 * embedding a real WAV, saved via `Presentations.SaveAs(..., ppSaveAsPPT)`
 * and inspected with this project's own record reader. That walk confirmed
 * the full reference chain: shape `OfficeArtClientData` -> `ExObjRefAtom`
 * (exObjId) -> document `ExObjListContainer` -> `ExWAVAudioEmbeddedContainer`
 * (`ExMediaAtom.exObjId` + `ExWAVAudioEmbeddedAtom.soundIdRef`) ->
 * `SoundCollectionContainer` -> `SoundContainer` whose `SoundIdAtom` (decimal
 * string) matches that `soundIdRef`.
 *
 * The one piece that ground truth does NOT supply: real PowerPoint's own
 * 97-2003 exporter never writes the `SoundDataBlob` record ([MS-PPT] 2.4.16.5,
 * `RT_SoundDataBlob` = 0x07E7) at all. Its `SoundContainer` holds only
 * `SoundNameAtom` / `SoundExtensionAtom` / `SoundIdAtom`; on reopen (even in a
 * freshly-launched `PowerPoint.Application`, ruling out an in-process cache),
 * `Shape.MediaFormat.Length` reads back `0` and no `RIFF` bytes exist
 * anywhere in the file. PowerPoint 2016 itself cannot losslessly embed audio
 * when downgrading to the 97-2003 binary format: it keeps a shape shell
 * (`Shape.Type` = `msoMedia`, `MediaType` = `ppMediaTypeSound`) with no
 * payload. `SoundDataBlob` is nonetheless a real, documented [MS-PPT] record
 * with no format-legality question mark, so this writer emits it: the
 * resulting file plays audio in real PowerPoint (verified: see
 * `scripts/com-acceptance-ppt.mjs`'s media case), which nothing produced by
 * PowerPoint's own binary exporter does.
 *
 * @module ppt/writer/media-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import type { HyperlinkCollector } from './hyperlink-writer';

/** One registered embedded audio entry. */
export interface MediaEntry {
	/** Shared id space with hyperlinks/OLE embeds (see `HyperlinkCollector.allocateId`). */
	exObjId: number;
	/** 1-based, unique within the deck's `SoundCollectionContainer` ([MS-PPT] `SoundIdAtom`). */
	soundId: number;
	/** `SoundNameAtom`: display name shown in PowerPoint's sound picker. */
	soundName: string;
	/** Complete WAV file bytes (RIFF header included), written verbatim as `SoundDataBlob`. */
	wavBytes: Uint8Array;
}

/**
 * Accumulates every embedded audio shape referenced anywhere in the deck, so
 * `document-stream-layout.ts` can emit one document-level
 * `SoundCollectionContainer` plus the matching `ExObjListContainer` entries
 * once every slide has been built. Mirrors `OleCollector`'s shape exactly
 * (including sharing `HyperlinkCollector`'s id counter for `exObjId`), except
 * audio needs no persist object of its own: the `SoundDataBlob` lives inline
 * inside the `DocumentContainer`, unlike an OLE embed's own `ExOleObjStg`.
 */
export class MediaCollector {
	private entries: MediaEntry[] = [];
	private nextSoundId = 1;

	/** @param hyperlinks - See `OleCollector`'s constructor doc for why `exObjId` is allocated here. */
	public constructor(private readonly hyperlinks: HyperlinkCollector) {}

	/** Register an embedded WAV, returning its newly allocated `exObjId`. */
	public registerAudio(wavBytes: Uint8Array, soundName: string): number {
		const exObjId = this.hyperlinks.allocateId();
		const soundId = this.nextSoundId++;
		this.entries.push({
			exObjId,
			soundId,
			soundName: soundName.length > 0 ? soundName : `Sound ${soundId}`,
			wavBytes,
		});
		return exObjId;
	}

	/** Every registered entry, in registration order. */
	public get all(): readonly MediaEntry[] {
		return this.entries;
	}

	public get isEmpty(): boolean {
		return this.entries.length === 0;
	}
}

function buildCString(text: string, recInstance: number): Uint8Array {
	return record(RT.CString, new ByteWriter().utf16(text).toBytes(), recInstance, false, 0);
}

/**
 * `SoundExtensionAtom` is documented as always exactly 8 bytes of data (4
 * UTF-16 characters, `rh.recLen` MUST be 0x00000008): every WAV this writer
 * embeds gets the literal `.WAV` value (one of the two spec-documented WAV
 * spellings), matching the ground-truth fixture exactly.
 */
const SOUND_EXTENSION_WAV = '.WAV';

/** Build one `SoundContainer` ([MS-PPT] 2.4.16.3): name, extension, id, then the actual audio data. */
function buildSoundContainer(entry: MediaEntry): Uint8Array {
	const w = new ByteWriter()
		.bytes(buildCString(entry.soundName, 0)) // SoundNameAtom
		.bytes(buildCString(SOUND_EXTENSION_WAV, 1)) // SoundExtensionAtom
		.bytes(buildCString(String(entry.soundId), 2)) // SoundIdAtom
		.bytes(record(RT.SoundDataBlob, entry.wavBytes, 0, false, 0)); // SoundDataBlob (beyond ground truth, see module doc)
	return record(RT.Sound, w.toBytes(), 0, true);
}

/**
 * Build the document-level `SoundCollectionContainer`, or `undefined` when no
 * audio was registered. `recInstance` MUST be 0x005 ([MS-PPT] 2.4.16.1),
 * confirmed against the ground-truth fixture (an otherwise-unexplained fixed
 * value, not a count or a derivable field).
 */
export function buildSoundCollection(media: MediaCollector): Uint8Array | undefined {
	if (media.isEmpty) {
		return undefined;
	}
	const seed = Math.max(1, ...media.all.map((e) => e.soundId));
	const atomData = new ByteWriter().i32(seed).toBytes();
	const w = new ByteWriter().bytes(record(RT.SoundCollectionAtom, atomData, 0, false, 0));
	for (const entry of media.all) {
		w.bytes(buildSoundContainer(entry));
	}
	return record(RT.SoundCollection, w.toBytes(), 0x005, true);
}

/**
 * Real PowerPoint never wrote a `soundLength` for the ground-truth fixture's
 * embedded WAV (`ExWAVAudioEmbeddedAtom.soundLength` = 0x7FFFFFFF on
 * reopen): mirrored here rather than measured, since [MS-PPT] only requires
 * it be `>= 0` and a wrong-but-plausible measured value carries more risk of
 * disagreeing with what PowerPoint itself computes for playback than this
 * documented sentinel does.
 */
const SOUND_LENGTH_UNKNOWN = 0x7fffffff;

/** Build the 8-byte `ExMediaAtom` ([MS-PPT] 2.10.6): exObjId + loop/rewind/narration flags (all false here). */
function buildExMediaAtom(exObjId: number): Uint8Array {
	const data = new ByteWriter().u32(exObjId).u16(0).u16(0).toBytes();
	return record(RT.ExternalMediaAtom, data, 0, false, 0);
}

/** Build the 8-byte `ExWAVAudioEmbeddedAtom` ([MS-PPT] 2.10.9): recVer=0x1, recInstance=0x001. */
function buildExWavAudioEmbeddedAtom(soundId: number): Uint8Array {
	const data = new ByteWriter().u32(soundId).i32(SOUND_LENGTH_UNKNOWN).toBytes();
	return record(RT.ExternalWavAudioEmbeddedAtom, data, 1, false, 1);
}

/**
 * Build one `ExWAVAudioEmbeddedContainer` ([MS-PPT] 2.10.8) per registered
 * audio entry, for `ex-obj-list-writer.ts` to append as sibling
 * `ExObjListSubContainer` children alongside hyperlinks and OLE embeds.
 */
export function buildMediaExObjEntries(media: MediaCollector): Uint8Array[] {
	return media.all.map((entry) => {
		const w = new ByteWriter()
			.bytes(buildExMediaAtom(entry.exObjId))
			.bytes(buildExWavAudioEmbeddedAtom(entry.soundId));
		return record(RT.ExternalWavAudioEmbedded, w.toBytes(), 0, true);
	});
}
