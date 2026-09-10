/**
 * Generates `media-trigger-mismatched.pptx`: the REAL, PowerPoint-COM-authored
 * `media-trigger-tgtel.pptx` fixture (see its `fixture-corpus-manifest.ts`
 * entry) with its embedded `media1.wav` swapped for a synthetic clip of a
 * DELIBERATELY different (5000ms, vs. the original's ~2000ms) real duration -
 * simulating a clip trimmed or swapped after the deck was exported.
 *
 * The deck's authored timing tree still says `2000` everywhere (PowerPoint's
 * own estimate, copied verbatim onto the follow-on click-group's
 * `p:cond/@delay` - see `native-animation-media-duration-plain-delay.ts`'s
 * module doc for why that authored value carries no structural link back to
 * the audio node it estimated). `onstop-audio-real-duration.spec.ts` asserts
 * every binding uses the REAL 5000ms instead.
 *
 * Not registered in `e2e/global-setup.ts`: generated in the spec's own
 * `test.beforeAll` instead, so this fixture needs no edit to that
 * frequently-touched shared file. Deterministic (same technique as
 * `write-fixture.ts`'s other generators), so regenerating it on every
 * project's `beforeAll` is a cheap no-op past the first write.
 *
 * Run with: bun run e2e/fixtures/generate-media-trigger-mismatched-fixture.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type JSZipType from 'jszip';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

/** The real duration this fixture's swapped-in clip decodes to. */
export const MISMATCHED_REAL_DURATION_MS = 5000;
/** PowerPoint's stale authored estimate, still on disk in the timing tree. */
export const STALE_AUTHORED_DURATION_MS = 2000;

export async function generateMediaTriggerMismatchedFixture(): Promise<string> {
	const JSZip = (await import('jszip')).default as unknown as {
		loadAsync: (typeof JSZipType)['loadAsync'];
	};
	const originalPath = resolve(__dirname, 'media-trigger-tgtel.pptx');
	const originalBytes = readFileSync(originalPath);
	const zip = await JSZip.loadAsync(originalBytes);
	zip.file('ppt/media/media1.wav', buildSyntheticWav(MISMATCHED_REAL_DURATION_MS));
	const bytes = await zip.generateAsync({ type: 'uint8array' });

	const outPath = resolve(__dirname, 'media-trigger-mismatched.pptx');
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

if (process.argv[1]?.endsWith('generate-media-trigger-mismatched-fixture.ts')) {
	generateMediaTriggerMismatchedFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
