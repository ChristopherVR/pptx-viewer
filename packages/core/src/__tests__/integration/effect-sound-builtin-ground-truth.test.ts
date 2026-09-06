import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { PptxData } from '../../index';
import { requireFixture } from '../require-fixture';

/**
 * Real PowerPoint-authored fixture (Office16 x64 COM, `pwsh -File
 * scripts/make-effect-sound-fixture.ps1`, 2026-09-06), pinning EXACTLY what
 * PowerPoint 2016 writes when a user attaches one of its 19 built-in stock
 * sounds to an animation effect (Chime) and to a slide transition (Applause):
 *
 *   - Effect sound: a `p:audio/p:cMediaNode/p:tgtEl/p:sndTgt` node inside the
 *     effect's own `p:subTnLst` (a sibling of `p:childTnLst`), NOT the legacy
 *     `p:stSnd` this project used to write - see `extractSoundAction`'s doc
 *     comment in `native-animation-helpers.ts`.
 *   - Transition sound: `p:transition/p:sndAc/p:stSnd/p:snd`.
 *   - BOTH carry `@_name="CHIMES.WAV"` / `@_name="APPLAUSE.WAV"` and NO
 *     `@_builtIn` (or equivalent) attribute anywhere: reopening the deck via
 *     COM and reading `Effect.EffectInformation.SoundEffect.Name`/`.Type` and
 *     `SlideShowTransition.SoundEffect.Name`/`.Type` confirmed PowerPoint
 *     recognises a stock sound purely by this name string, matched
 *     case-insensitively (see `effect-sound-catalogue.ts`'s
 *     `findEffectSoundCatalogueEntry`).
 *
 * Microsoft's own WAV bytes are NOT committed: the fixture-generation script
 * overwrites both embedded `ppt/media/audioN.wav` parts with a tiny
 * synthesised placeholder after PowerPoint embeds the real ones, keeping the
 * part names, relationships and `@_name` attributes untouched. A follow-up
 * COM reopen of the fixture AS COMMITTED (placeholder audio and all) still
 * reported `SOUND_NAME: 'CHIMES.WAV'` / `'APPLAUSE.WAV'`, confirming
 * PowerPoint's recognition is name-based, not audio-content-based.
 */
const FIXTURE = requireFixture(path.resolve(__dirname, '../fixtures/effect-sound-builtin.pptx'));

async function loadFixture(): Promise<PptxData> {
	const buf = readFileSync(FIXTURE);
	const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	return new PptxHandler().load(ab);
}

describe('effect-sound-builtin ground-truth fixture', () => {
	it('parses the effect sound (Chime) with its resolved path and catalogue name', async () => {
		const data = await loadFixture();
		const slide = data.slides[0];
		const nativeAnim = slide.nativeAnimations?.find((anim) => anim.soundRId);
		expect(nativeAnim).toBeDefined();
		expect(nativeAnim?.soundName).toBe('CHIMES.WAV');
		expect(nativeAnim?.soundPath).toMatch(/^ppt\/media\/audio\d+\.wav$/u);
	});

	it('parses the transition sound (Applause) with its name and resolved path', async () => {
		const data = await loadFixture();
		const transition = data.slides[0].transition;
		expect(transition?.soundName).toBe('APPLAUSE.WAV');
		expect(transition?.soundPath).toMatch(/^ppt\/media\/audio\d+\.wav$/u);
	});

	it('round-trips both stock sound names through a save with no edits', async () => {
		const buf = readFileSync(FIXTURE);
		const handler = new PptxHandler();
		const data = await handler.load(
			buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
		);
		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);

		const nativeAnim = reloaded.slides[0].nativeAnimations?.find((anim) => anim.soundRId);
		expect(nativeAnim?.soundName).toBe('CHIMES.WAV');
		expect(reloaded.slides[0].transition?.soundName).toBe('APPLAUSE.WAV');
	});
});
