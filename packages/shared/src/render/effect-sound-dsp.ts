/**
 * Pure, deterministic PCM synthesis primitives for the stock effect-sound
 * gallery (see `effect-sound-catalogue.ts` / `effect-sound-generators.ts`).
 *
 * Every helper is a function of its numeric parameters only: no DOM API, no
 * `Math.random()`. `noiseAt` replaces `Math.random()` with a deterministic
 * hash-of-index generator so a noise-based sound (applause, drum roll, ...)
 * synthesises byte-for-byte identical samples on every run, which is what
 * `effect-sound-synth.test.ts` asserts.
 *
 * @module render/effect-sound-dsp
 */

/** Sample rate every stock sound is synthesised at (22.05 kHz mono). */
export const SAMPLE_RATE = 22050;

/** Deterministic pseudo-random value in [-1, 1) for sample index `i`. */
function noiseAt(i: number, seed: number): number {
	const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
	return 2 * (x - Math.floor(x)) - 1;
}

/** Number of samples spanning `durationSec` at {@link SAMPLE_RATE}. */
export function samplesFor(durationSec: number): number {
	return Math.max(1, Math.round(durationSec * SAMPLE_RATE));
}

/** `durationSec` of silence. */
export function silence(durationSec: number): Float32Array {
	return new Float32Array(samplesFor(durationSec));
}

/** Deterministic white noise, `seed` selecting a distinct sequence. */
export function whiteNoise(durationSec: number, seed = 0): Float32Array {
	const n = samplesFor(durationSec);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		out[i] = noiseAt(i, seed);
	}
	return out;
}

/** One-pole low-pass filter; smaller `alpha` means heavier smoothing. */
export function lowpass(input: Float32Array, alpha: number): Float32Array {
	const out = new Float32Array(input.length);
	let prev = 0;
	for (let i = 0; i < input.length; i++) {
		prev += alpha * (input[i] - prev);
		out[i] = prev;
	}
	return out;
}

/** A pure sine tone at `freqHz` for `durationSec`. */
export function sineTone(freqHz: number, durationSec: number, phase = 0): Float32Array {
	const n = samplesFor(durationSec);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		out[i] = Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE + phase);
	}
	return out;
}

/** A linear frequency sweep (chirp) from `freqStartHz` to `freqEndHz`. */
export function sweepTone(
	freqStartHz: number,
	freqEndHz: number,
	durationSec: number,
): Float32Array {
	const n = samplesFor(durationSec);
	const out = new Float32Array(n);
	let phase = 0;
	for (let i = 0; i < n; i++) {
		const t = i / SAMPLE_RATE;
		const freq = freqStartHz + (freqEndHz - freqStartHz) * (t / Math.max(durationSec, 1e-6));
		phase += (2 * Math.PI * freq) / SAMPLE_RATE;
		out[i] = Math.sin(phase);
	}
	return out;
}

/** Exponential decay envelope: 1 at sample 0, decaying toward 0. */
export function decayEnvelope(n: number, decayRate: number): Float32Array {
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		out[i] = Math.exp((-decayRate * i) / SAMPLE_RATE);
	}
	return out;
}

/** Linear attack/decay envelope: 0 -> 1 over `attackSec`, then 1 -> 0. */
export function adEnvelope(n: number, attackSec: number): Float32Array {
	const out = new Float32Array(n);
	const attackN = Math.max(1, Math.round(attackSec * SAMPLE_RATE));
	for (let i = 0; i < n; i++) {
		out[i] = i < attackN ? i / attackN : Math.max(0, 1 - (i - attackN) / Math.max(1, n - attackN));
	}
	return out;
}

/** Element-wise multiply, truncated to the shorter input. */
export function multiply(a: Float32Array, b: Float32Array): Float32Array {
	const n = Math.min(a.length, b.length);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		out[i] = a[i] * b[i];
	}
	return out;
}

/** Uniform gain. */
export function scale(a: Float32Array, gain: number): Float32Array {
	const out = new Float32Array(a.length);
	for (let i = 0; i < a.length; i++) {
		out[i] = a[i] * gain;
	}
	return out;
}

/** Sum multiple buffers (mixing), sized to the longest input. */
export function add(...arrays: Float32Array[]): Float32Array {
	const n = arrays.reduce((max, a) => Math.max(max, a.length), 0);
	const out = new Float32Array(n);
	for (const arr of arrays) {
		for (let i = 0; i < arr.length; i++) {
			out[i] += arr[i];
		}
	}
	return out;
}

/** Sequence buffers end-to-end (splicing, not mixing). */
export function concat(...arrays: Float32Array[]): Float32Array {
	const total = arrays.reduce((sum, a) => sum + a.length, 0);
	const out = new Float32Array(total);
	let offset = 0;
	for (const arr of arrays) {
		out.set(arr, offset);
		offset += arr.length;
	}
	return out;
}

/** Scale so the loudest sample hits `peak` (default 0.9, leaving headroom). */
export function normalize(samples: Float32Array, peak = 0.9): Float32Array {
	let max = 0;
	for (const s of samples) {
		max = Math.max(max, Math.abs(s));
	}
	return max === 0 ? samples : scale(samples, peak / max);
}
