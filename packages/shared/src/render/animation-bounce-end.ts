/**
 * `animation-bounce-end`: PowerPoint's "Bounce end" effect option
 * (`p:anim/@p14:bounceEnd`, mirrored on `p:cTn/@p14:presetBounceEnd`),
 * fitted to PowerPoint's own frames.
 *
 * ## Ground truth
 *
 * COM exposes the option as `Effect.Timing.BounceEnd` +
 * `BounceEndIntensity`; setting intensity `k` makes PowerPoint write
 * `p14:bounceEnd="k * 100000"` on each position `p:anim` of a Fly In. Decks
 * authored that way (k = 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 0.9; 2s, plus 3s
 * at k = 0.5) were exported with `CreateVideo` at 1080p / 62.5fps and the
 * shape's edge tracked per frame. What that measured:
 *
 *  - `bounceEnd` is the fraction of the duration spent BOUNCING, at the end.
 *    The travel is the plain linear ramp compressed into the first `1 - k`
 *    (the fitted slope matched `1 / (1 - k)` to four digits at every k); the
 *    earlier reading here (travel ENDS at `k`) was backwards.
 *  - The settle is a damped oscillation about the end value (overshooting in
 *    the direction of travel first), scale-free in time: the 3s capture
 *    matched the 2s one in settle-phase units. Its shape depends on `k` only:
 *    `x(s) = r v0 / w * exp(-l s) * sin(w s)` in units of the travel distance,
 *    with `s` the 0-1 settle-phase progress, `v0 = k / (1 - k)` the arrival
 *    speed (so the curve leaves the ramp without a kink), and `w`, `l`, `r`
 *    low-order polynomials in `k` ({@link BOUNCE_FIT}). A global least-squares
 *    fit over every capture leaves an RMS error of 0.0011 of the travel (worst
 *    sample 0.0036; per-k fits reach 0.0005, the pixel quantisation); the
 *    previous hand-tuned curve was off by 0.04 to 0.07.
 *
 * @module render/animation-bounce-end
 */

/** Fitted coefficients (see the module doc). */
export const BOUNCE_FIT = {
	/** Angular frequency in settle-phase units: `w = a + b k + c k^2`. */
	omega: [7.7846, 3.1207, 10.7958],
	/** Decay rate in settle-phase units: `l = a + b k + c k^2`. */
	decay: [2.7423, 5.3818, -1.5095],
	/** Launch speed relative to the arrival speed: `r = a + b k`. */
	speed: [0.8644, 0.0936],
} as const;

function poly(coefficients: readonly number[], k: number): number {
	return coefficients.reduce((sum, c, power) => sum + c * k ** power, 0);
}

/**
 * Largest `bounceEnd` honoured. At 1 there is no travel phase left and the
 * arrival speed is infinite; PowerPoint's own output there is erratic (the
 * shape leaves the slide), so it is not modelled.
 */
const MAX_BOUNCE_END = 0.95;

/** `% stops` generated across the settle phase, enough for ~6 half-swings. */
export const BOUNCE_SETTLE_SAMPLES = 32;

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/** Clamp an authored `bounceEnd` fraction to the modelled range. */
export function normalizeBounceEnd(bounceEnd: number): number {
	return Math.max(0, Math.min(MAX_BOUNCE_END, bounceEnd));
}

/** Local progress (0-1) at which the travel ends and the settle begins. */
export function bounceSettleStart(bounceEnd: number): number {
	return 1 - normalizeBounceEnd(bounceEnd);
}

/**
 * Signed displacement from the end value, in units of the travel distance,
 * `s` (0-1) into the settle phase. Positive is past the end value. The last
 * stretch is faded out so the value lands exactly on the end value at `s = 1`.
 */
export function bounceSettleOffset(bounceEnd: number, s: number): number {
	const k = normalizeBounceEnd(bounceEnd);
	if (k <= 0) {
		return 0;
	}
	const omega = poly(BOUNCE_FIT.omega, k);
	const decay = poly(BOUNCE_FIT.decay, k);
	const speed = poly(BOUNCE_FIT.speed, k) * (k / (1 - k));
	const t = clamp01(s);
	return (speed / omega) * Math.exp(-decay * t) * Math.sin(omega * t) * (1 - t ** 6);
}

/**
 * Progress along a start-to-end ramp (0 = start, 1 = end, beyond 1 =
 * overshoot) at `localProgress` of a behaviour carrying `bounceEnd`.
 */
export function bounceEndProgress(bounceEnd: number, localProgress: number): number {
	const settleStart = bounceSettleStart(bounceEnd);
	const t = clamp01(localProgress);
	if (t <= settleStart) {
		return settleStart <= 0 ? 1 : t / settleStart;
	}
	const s = (t - settleStart) / Math.max(Number.EPSILON, 1 - settleStart);
	return 1 + bounceSettleOffset(bounceEnd, s);
}
