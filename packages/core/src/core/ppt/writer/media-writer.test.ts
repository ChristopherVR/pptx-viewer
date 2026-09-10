/**
 * Tests for the legacy binary `.ppt` embedded-audio writer.
 *
 * Unlike `ppt-writer-roundtrip.test.ts`'s other cases, none of these reload
 * the SAVED `.ppt` back through `PptxHandler.load`: the importer does not
 * parse `SoundCollection` back into a `media` `PptxElement` yet (see this
 * writer's module doc and `docs/guide/limitations.md`). Instead these assert
 * directly on the written record stream with this project's own reader
 * (`record-stream.ts` / `ole2-parser.ts`), which is format-level,
 * framework-independent proof the bytes are well-formed; COM acceptance
 * (`scripts/com-acceptance-ppt.mjs`) is the proof real PowerPoint accepts and
 * losslessly re-exports them. The last case DOES load a `.pptx` (a normal,
 * fully-supported read) before saving it as `.ppt`, to prove the
 * `mediaPath`-only (no `mediaData`) shape a REAL imported deck's audio takes.
 *
 * @module ppt/writer/media-writer.test
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import { parseOle2 } from '../../utils/ole2-parser';
import { findChild, findDescendant, iterateChildren, readRecordOrThrow } from '../record-stream';
import { RT } from '../record-types';
import { ByteWriter } from './byte-writer';
import { HyperlinkCollector } from './hyperlink-writer';
import { buildMediaExObjEntries, buildSoundCollection, MediaCollector } from './media-writer';

/** A minimal, valid 44-byte-header WAV (8 bytes of silent PCM data). */
function tinyWav(): Uint8Array {
	const dataSize = 8;
	const w = new ByteWriter();
	w.ansi('RIFF')
		.u32(36 + dataSize)
		.ansi('WAVE')
		.ansi('fmt ')
		.u32(16)
		.u16(1) // PCM
		.u16(1) // mono
		.u32(8000)
		.u32(16000)
		.u16(2)
		.u16(16)
		.ansi('data')
		.u32(dataSize)
		.bytes(new Uint8Array(dataSize));
	return w.toBytes();
}

describe('media-writer: record shape', () => {
	it('builds a SoundCollectionContainer with recInstance 0x005 and the WAV bytes verbatim', () => {
		const hyperlinks = new HyperlinkCollector();
		const media = new MediaCollector(hyperlinks);
		const wav = tinyWav();
		media.registerAudio(wav, 'MySound');

		const bytes = buildSoundCollection(media)!;
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const soundCollection = readRecordOrThrow(view, 0);
		expect(soundCollection.recType).toBe(RT.SoundCollection);
		expect(soundCollection.recInstance).toBe(0x005);

		const soundContainer = findChild(view, soundCollection, RT.Sound)!;
		expect(soundContainer).toBeDefined();

		const cstrings = [...iterateChildren(view, soundContainer)].filter(
			(c) => c.recType === RT.CString,
		);
		expect(cstrings.map((c) => c.recInstance).sort()).toStrictEqual([0, 1, 2]);

		const dataBlob = findChild(view, soundContainer, RT.SoundDataBlob)!;
		expect(dataBlob).toBeDefined();
		const blobBytes = new Uint8Array(view.buffer, dataBlob.dataOffset, dataBlob.recLen);
		expect(Array.from(blobBytes)).toStrictEqual(Array.from(wav));
	});

	it('builds one ExWAVAudioEmbeddedContainer per registered audio, referencing its SoundIdAtom', () => {
		const hyperlinks = new HyperlinkCollector();
		const media = new MediaCollector(hyperlinks);
		media.registerAudio(tinyWav(), 'A');
		media.registerAudio(tinyWav(), 'B');

		const entries = buildMediaExObjEntries(media);
		expect(entries).toHaveLength(2);
		for (const [i, entryBytes] of entries.entries()) {
			const view = new DataView(entryBytes.buffer, entryBytes.byteOffset, entryBytes.byteLength);
			const container = readRecordOrThrow(view, 0);
			expect(container.recType).toBe(RT.ExternalWavAudioEmbedded);
			const exMedia = findChild(view, container, RT.ExternalMediaAtom)!;
			expect(view.getUint32(exMedia.dataOffset, true)).toBe(media.all[i]!.exObjId);
			const exWav = findChild(view, container, RT.ExternalWavAudioEmbeddedAtom)!;
			expect(exWav.recVer).toBe(1);
			expect(exWav.recInstance).toBe(1);
			expect(view.getUint32(exWav.dataOffset, true)).toBe(media.all[i]!.soundId);
		}
	});

	it('omits SoundCollection entirely when no audio was registered', () => {
		const hyperlinks = new HyperlinkCollector();
		const media = new MediaCollector(hyperlinks);
		expect(buildSoundCollection(media)).toBeUndefined();
		expect(buildMediaExObjEntries(media)).toHaveLength(0);
	});
});

describe('legacy .ppt writer: embedded audio end to end', () => {
	it('writes a real SoundDataBlob the SDK-authored deck carries verbatim through save()', async () => {
		const { handler, data, createSlide } = await PptxHandler.create({ initialSlideCount: 0 });
		const slide = createSlide('Blank');
		const wav = tinyWav();
		let binary = '';
		for (const b of wav) {
			binary += String.fromCharCode(b);
		}
		const dataUrl = `data:audio/wav;base64,${btoa(binary)}`;
		slide.addMedia('audio', dataUrl, { x: 50, y: 50, width: 200, height: 50, name: 'Sound1' });
		data.slides.push(slide.build());

		const bytes = await handler.save(data.slides, { outputFormat: 'ppt' });
		expect(Array.from(bytes.subarray(0, 8))).toStrictEqual([
			0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
		]);

		const ole = parseOle2(bytes.buffer as ArrayBuffer);
		const doc = ole.getStream('PowerPoint Document')!;
		const view = new DataView(doc.buffer, doc.byteOffset, doc.byteLength);
		const docContainer = readRecordOrThrow(view, 0);
		const soundData = findDescendant(view, docContainer, RT.SoundDataBlob)!;
		expect(soundData).toBeDefined();
		const blobBytes = new Uint8Array(view.buffer, soundData.dataOffset, soundData.recLen);
		expect(Array.from(blobBytes)).toStrictEqual(Array.from(wav));

		// The document-level ExMediaAtom exists with a valid (non-zero) exObjId;
		// the shape-level ExObjRefAtom referencing the SAME id lives in a
		// separate top-level persist object (the Slide container), not nested
		// under docContainer, so `media-writer.test.ts`'s pure-record test above
		// (and the COM acceptance script) cover that cross-object linkage.
		const exMedia = findDescendant(view, docContainer, RT.ExternalMediaAtom)!;
		expect(exMedia).toBeDefined();
		expect(view.getUint32(exMedia.dataOffset, true)).toBeGreaterThan(0);
	});

	it('embeds real WAV bytes for audio loaded from a .pptx (mediaPath, no mediaData)', async () => {
		// e2e/fixtures/audio-embed.pptx (generate-audio-embed-fixture.ts): one
		// slide, one p:pic with an a:audioFile r:embed relationship to a real
		// WAV. The loader leaves such an element with `mediaPath` set and
		// `mediaData` undefined (see `PptxHandlerRuntimeSaveLegacyPpt.ts`'s
		// `resolveAudioMediaBytes` doc comment), so this is the path a REAL
		// imported deck takes, not just an SDK-authored one.
		const fixturePath = new URL('../../../../../../e2e/fixtures/audio-embed.pptx', import.meta.url);
		const fixtureBytes = readFileSync(fixturePath);

		const handler = new PptxHandler();
		const loaded = await handler.load(
			fixtureBytes.buffer.slice(
				fixtureBytes.byteOffset,
				fixtureBytes.byteOffset + fixtureBytes.byteLength,
			) as ArrayBuffer,
		);
		const mediaEl = loaded.slides[0]!.elements[0] as {
			mediaData?: string;
			mediaPath?: string;
		};
		expect(mediaEl.mediaData).toBeUndefined();
		expect(mediaEl.mediaPath).toBe('ppt/media/fixture-sound.wav');

		const bytes = await handler.save(loaded.slides, { outputFormat: 'ppt' });
		const ole = parseOle2(bytes.buffer as ArrayBuffer);
		const doc = ole.getStream('PowerPoint Document')!;
		const view = new DataView(doc.buffer, doc.byteOffset, doc.byteLength);
		const docContainer = readRecordOrThrow(view, 0);
		const soundData = findDescendant(view, docContainer, RT.SoundDataBlob)!;
		expect(soundData).toBeDefined();
		expect(soundData.recLen).toBe(844);
	});
});
