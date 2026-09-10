/**
 * `slide-transition-fragments-radial` - radial wedge-shard fragment builders
 * for `shred` and `fracture`.
 *
 * Both were measured via COM `CreateVideo` as a burst of triangular shards
 * radiating outward from the slide's centre - a pinwheel of many thin,
 * regular wedges for `shred` (`p14:shred/@pattern`: many for `strip`, fewer
 * and wider for `rectangle`), a handful of large, irregular shards for
 * `fracture`. Both reuse the same wedge-fan builder with different counts
 * and regularity.
 *
 * @module render/slide-transition-fragments-radial
 */

import type { FragmentedLayer, TransitionFragment } from './slide-transition-fragment-types';
import { deg, pct, round, seededUnit } from './slide-transition-fragment-types';

/**
 * A pie-slice `clip-path` from the slide centre spanning `[a0, a1)` degrees,
 * approximated with `arcSteps` chords at a radius well past every corner
 * (max centre-to-corner distance is ~70.7%), so the union of every wedge in a
 * full sweep tiles the slide with no gaps.
 */
function wedgeClipPath(a0: number, a1: number, arcSteps: number): string {
	const radius = 150;
	const points = ['50% 50%'];
	for (let i = 0; i <= arcSteps; i++) {
		const a = a0 + ((a1 - a0) * i) / arcSteps;
		const rad = (Math.PI / 180) * a;
		const x = 50 + radius * Math.cos(rad);
		const y = 50 + radius * Math.sin(rad);
		points.push(`${round(x)}% ${round(y)}%`);
	}
	return `polygon(${points.join(', ')})`;
}

interface RadialWedgeOptions {
	count: number;
	/** Irregular angular spans (fracture's organic crack look) vs even (shred's pinwheel). */
	irregular: boolean;
	arcSteps: number;
	/** Outward flight distance as a percentage of the slide box. */
	flightPct: number;
	/** Max +/- rotation applied per shard, degrees. */
	maxRotateDeg: number;
	durationMs: number;
	keyframesName: string;
	idPrefix: string;
	seedOffset: number;
}

function buildRadialWedges(options: RadialWedgeOptions): FragmentedLayer {
	const {
		count,
		irregular,
		arcSteps,
		flightPct,
		maxRotateDeg,
		durationMs,
		keyframesName,
		idPrefix,
		seedOffset,
	} = options;

	const weights: number[] = [];
	let total = 0;
	for (let i = 0; i < count; i++) {
		const w = irregular ? 0.5 + seededUnit(seedOffset + i * 7) : 1;
		weights.push(w);
		total += w;
	}

	const fragments: TransitionFragment[] = [];
	let angle = -90; // start at the top, matches the measured burst origin.
	for (let i = 0; i < count; i++) {
		const span = (weights[i] / total) * 360;
		const a0 = angle;
		const a1 = angle + span;
		angle = a1;
		const bisector = (a0 + a1) / 2;
		const rad = (Math.PI / 180) * bisector;
		const jitter = seededUnit(seedOffset + i * 13);
		const dx = Math.cos(rad) * flightPct * (0.75 + jitter * 0.4);
		const dy = Math.sin(rad) * flightPct * (0.75 + jitter * 0.4);
		const rot = (jitter - 0.5) * 2 * maxRotateDeg;
		const delayMs = round(jitter * durationMs * 0.12);
		fragments.push({
			id: `${idPrefix}-${i}`,
			clipPath: wedgeClipPath(a0, a1, arcSteps),
			vars: {
				'--frag-dx': pct(dx),
				'--frag-dy': pct(dy),
				'--frag-rot': deg(rot),
			},
			delayMs,
			transformOrigin: '50% 50%',
		});
	}
	return {
		keyframesName,
		durationMs: Math.round(durationMs * 0.85),
		easing: 'ease-in',
		fragments,
	};
}

/**
 * Shred: `pattern="rectangle"` (`p14:shred/@pattern`) reads as fewer, wider
 * wedges in real PowerPoint than the default `strip` pattern's many thin
 * pinwheel blades - capped at 20 strips / 10 rectangles.
 */
export function shredFragments(durationMs: number, pattern: string | undefined): FragmentedLayer {
	const isRectangle = pattern === 'rectangle';
	return buildRadialWedges({
		count: isRectangle ? 10 : 20,
		irregular: false,
		arcSteps: isRectangle ? 2 : 1,
		flightPct: 85,
		maxRotateDeg: isRectangle ? 25 : 70,
		durationMs,
		keyframesName: 'pptx-tr-frag-shred-out',
		idPrefix: 'shred',
		seedOffset: isRectangle ? 200 : 100,
	});
}

/** Fracture: 9 large, irregular shards, matching the measured "crack" look. */
export function fractureFragments(durationMs: number): FragmentedLayer {
	return buildRadialWedges({
		count: 9,
		irregular: true,
		arcSteps: 3,
		flightPct: 55,
		maxRotateDeg: 35,
		durationMs,
		keyframesName: 'pptx-tr-frag-fracture-out',
		idPrefix: 'fracture',
		seedOffset: 300,
	});
}
