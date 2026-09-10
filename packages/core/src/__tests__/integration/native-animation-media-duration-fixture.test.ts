/**
 * Ground-truth regression for `native-animation-media-duration.ts`, using
 * the REAL `media-trigger-tgtel.pptx` fixture (authored over PowerPoint COM,
 * see its `fixture-corpus-manifest.ts` entry): PowerPoint's own "After
 * Previous" audio chaining writes a bare `<p:cond delay="2000"/>` on the
 * FOLLOWING click-group, copied verbatim from a separate "play the media"
 * effect node's own `p:cTn/@dur="2000"` - never an explicit `onStopAudio`
 * dependency. Neither node names the audio's `p:audio` declaration
 * structurally; `native-animation-media-duration-plain-delay.ts`'s
 * value-matched heuristic is what closes that gap.
 *
 * The fixture's own embedded `media1.wav` happens to real-decode to exactly
 * 2000ms too (COM's own estimate was accurate for it), so this test SWAPS in
 * a synthetic WAV of a deliberately different (5000ms) real duration -
 * simulating a clip trimmed or swapped after export - to prove the loader
 * corrects the STALE 2000ms estimate to the REAL 5000ms everywhere it
 * appears, rather than merely reproducing the already-matching original.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxNativeAnimation } from '../../core/types';
import { FIXTURE_DIRS } from './fixture-corpus-manifest';

function buildSyntheticWav(durationMs: number): Uint8Array {
	const sampleRate = 8000;
	const byteRate = sampleRate; // mono, 8-bit
	const dataSize = Math.round((byteRate * durationMs) / 1000);
	const buf = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buf);
	const writeAscii = (offset: number, s: string) => {
		for (let i = 0; i < s.length; i++) {
			view.setUint8(offset + i, s.charCodeAt(i));
		}
	};
	writeAscii(0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	writeAscii(8, 'WAVE');
	writeAscii(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, 1, true);
	view.setUint16(34, 8, true);
	writeAscii(36, 'data');
	view.setUint32(40, dataSize, true);
	return new Uint8Array(buf);
}

async function loadFixtureWithSwappedAudio(durationMs: number) {
	const fixturePath = join(FIXTURE_DIRS.e2e, 'media-trigger-tgtel.pptx');
	const originalBytes = readFileSync(fixturePath);
	const zip = await JSZip.loadAsync(originalBytes);
	zip.file('ppt/media/media1.wav', buildSyntheticWav(durationMs));
	const patchedBytes = await zip.generateAsync({ type: 'uint8array' });
	const handler = new PptxHandler();
	const buffer = patchedBytes.buffer.slice(
		patchedBytes.byteOffset,
		patchedBytes.byteOffset + patchedBytes.byteLength,
	);
	return handler.load(buffer as ArrayBuffer);
}

describe('native-animation-media-duration (media-trigger-tgtel.pptx ground truth)', () => {
	it("corrects the click-group's bare copied delay to the REAL audio duration when it differs from PowerPoint's stale estimate", async () => {
		const data = await loadFixtureWithSwappedAudio(5000);
		const nativeAnimations = data.slides[0]!.nativeAnimations as PptxNativeAnimation[] | undefined;
		expect(nativeAnimations).toBeDefined();

		// The "play the media" effect node (presetClass mediacall) and the media
		// declaration itself must both now carry the REAL duration.
		const mediaCallNode = nativeAnimations!.find(
			(a) => a.kind !== 'media' && a.durationMs === 5000,
		);
		expect(mediaCallNode, 'mediacall play-effect node was not corrected to 5000ms').toBeDefined();

		const mediaNode = nativeAnimations!.find((a) => a.kind === 'media');
		expect(mediaNode?.durationMs).toBe(5000);

		// The SECOND click-group's entrance effect carries the copied delay as
		// `parGroupDelayMs` (the wrapping `p:par`'s own start offset - see
		// `PptxNativeAnimation.parGroupDelayMs`'s doc comment - NOT a
		// `startConditions` entry), copied verbatim by PowerPoint from the (now
		// stale) 2000ms estimate; it must be corrected too.
		const entranceEffect = nativeAnimations!.find((a) => a.presetClass === 'entr');
		expect(entranceEffect?.parGroupDelayMs).toBe(5000);

		// No stale 2000ms value should remain anywhere in the timing tree's
		// conditions or parGroupDelayMs once the correction has fully propagated.
		const staleRemaining = nativeAnimations!.some(
			(a) =>
				a.parGroupDelayMs === 2000 ||
				[...(a.startConditions ?? []), ...(a.endConditions ?? [])].some((c) => c.delay === 2000),
		);
		expect(staleRemaining, 'a stale 2000ms delay survived the patch').toBeFalsy();
	});

	it('leaves the timing tree untouched when the real duration matches the authored estimate (the original fixture)', async () => {
		const original = readFileSync(join(FIXTURE_DIRS.e2e, 'media-trigger-tgtel.pptx'));
		const handler = new PptxHandler();
		const buffer = original.buffer.slice(
			original.byteOffset,
			original.byteOffset + original.byteLength,
		);
		const data = await handler.load(buffer as ArrayBuffer);
		const nativeAnimations = data.slides[0]!.nativeAnimations as PptxNativeAnimation[] | undefined;
		const mediaNode = nativeAnimations!.find((a) => a.kind === 'media');
		// The real embedded clip genuinely IS ~2000ms; nothing to correct.
		expect(mediaNode?.durationMs).toBeCloseTo(2000, -1);
	});
});
