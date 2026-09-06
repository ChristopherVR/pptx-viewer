/**
 * Per-catalogue-entry sample generators for the stock effect-sound gallery.
 * Each function returns raw (un-normalised) samples for one of the 19
 * PowerPoint stock sounds (`effect-sound-catalogue.ts`), built from the pure
 * primitives in `effect-sound-dsp.ts`. `effect-sound-synth.ts` normalises and
 * WAV-encodes the result.
 *
 * These are not attempts to reproduce Microsoft's copyrighted assets (which
 * this repo cannot redistribute) - they are distinct, recognisable
 * placeholders built entirely from synthesis, matched to each sound's real
 * character (a decaying harmonic bell for "Chime", a short noise burst for
 * "Click", a descending sweep for "Laser", ...).
 *
 * @module render/effect-sound-generators
 */
import {
	adEnvelope,
	add,
	concat,
	decayEnvelope,
	lowpass,
	multiply,
	samplesFor,
	scale,
	sineTone,
	sweepTone,
	whiteNoise,
} from './effect-sound-dsp';

/** A short filtered noise transient (clicks, hits, impacts). */
function noiseBurst(durationSec: number, seed: number, lowpassAlpha = 1): Float32Array {
	const noise = whiteNoise(durationSec, seed);
	const filtered = lowpassAlpha < 1 ? lowpass(noise, lowpassAlpha) : noise;
	return multiply(filtered, decayEnvelope(filtered.length, 14 / Math.max(durationSec, 0.01)));
}

/** A decaying harmonic bell/ding: a fundamental plus two overtones. */
function bell(freqHz: number, durationSec: number): Float32Array {
	const envelope = decayEnvelope(samplesFor(durationSec), 5 / durationSec);
	const tone = add(
		scale(sineTone(freqHz, durationSec), 1),
		scale(sineTone(freqHz * 2, durationSec), 0.4),
		scale(sineTone(freqHz * 3, durationSec), 0.2),
	);
	return multiply(tone, envelope);
}

/** A low-frequency percussive thump (bomb/explosion/hammer/push). */
function thump(freqHz: number, durationSec: number): Float32Array {
	const envelope = decayEnvelope(samplesFor(durationSec), 8 / durationSec);
	return multiply(sineTone(freqHz, durationSec), envelope);
}

/** A train of short clicks, evenly spaced with a trailing gap. */
function clickTrain(count: number, clickSec: number, gapSec: number, seed: number): Float32Array {
	const parts: Float32Array[] = [];
	for (let i = 0; i < count; i++) {
		parts.push(noiseBurst(clickSec, seed + i, 0.8));
		parts.push(new Float32Array(samplesFor(gapSec)));
	}
	return concat(...parts);
}

/** Slow amplitude modulation applied to a noise bed (applause/wind/breeze). */
function modulatedNoise(
	durationSec: number,
	seed: number,
	lpAlpha: number,
	lfoHz: number,
): Float32Array {
	const noise = lowpass(whiteNoise(durationSec, seed), lpAlpha);
	const lfo = sineTone(lfoHz, durationSec);
	const modulation = new Float32Array(lfo.length);
	for (let i = 0; i < lfo.length; i++) {
		modulation[i] = 0.6 + 0.4 * Math.abs(lfo[i]);
	}
	return multiply(noise, modulation);
}

type EffectSoundGenerator = () => Float32Array;

/** Sample generator for every catalogue id in `effect-sound-catalogue.ts`. */
export const EFFECT_SOUND_GENERATORS: Readonly<Record<string, EffectSoundGenerator>> = {
	applause: () => modulatedNoise(1.4, 1, 0.35, 6),
	arrow: () => add(sweepTone(1200, 300, 0.3), noiseBurst(0.06, 2, 0.9)),
	bomb: () => add(thump(55, 0.7), noiseBurst(0.8, 3, 0.4)),
	breeze: () => modulatedNoise(1.4, 4, 0.06, 0.8),
	camera: () =>
		concat(noiseBurst(0.015, 5, 1), new Float32Array(samplesFor(0.07)), noiseBurst(0.02, 6, 1)),
	cashRegister: () => concat(bell(1500, 0.25), noiseBurst(0.15, 7, 0.6)),
	chime: () => bell(1046.5, 1.2),
	click: () => noiseBurst(0.01, 8, 1),
	coin: () => bell(2093, 0.35),
	drumRoll: () => clickTrain(14, 0.05, 0.015, 9),
	explosion: () => add(thump(45, 1.4), noiseBurst(1.5, 10, 0.35)),
	hammer: () => concat(thump(120, 0.15), new Float32Array(samplesFor(0.1)), thump(100, 0.2)),
	laser: () => multiply(sweepTone(2200, 200, 0.35), decayEnvelope(samplesFor(0.35), 6)),
	push: () => thump(150, 0.3),
	suction: () => multiply(sweepTone(200, 1600, 0.4), adEnvelope(samplesFor(0.4), 0.05)),
	typewriter: () => concat(clickTrain(6, 0.02, 0.05, 11), bell(1800, 0.3)),
	voltage: () => modulatedNoise(0.8, 12, 0.9, 90),
	whoosh: () => multiply(lowpass(whiteNoise(0.6, 13), 0.5), adEnvelope(samplesFor(0.6), 0.2)),
	wind: () => modulatedNoise(1.5, 14, 0.05, 0.5),
};
