/**
 * `slide-transition-fragments-panels` - panel-based fragment builders for
 * `curtains` (vertical curtain slats) and `airplane` (a literal paper-plane
 * fold, measured via COM `CreateVideo` as the outgoing content folding into a
 * dart silhouette before flying off).
 *
 * @module render/slide-transition-fragments-panels
 */

import type { FragmentedLayer, TransitionFragment } from './slide-transition-fragment-types';
import { deg, pct, round } from './slide-transition-fragment-types';

/**
 * Curtains: measured as several vertical slats (not one flat sheet) that
 * lift away with a rippling, slightly folded stagger. Capped at 9 panels.
 */
const CURTAIN_PANELS = 9;

export function curtainsFragments(durationMs: number): FragmentedLayer {
	const fragments: TransitionFragment[] = [];
	const width = 100 / CURTAIN_PANELS;
	const center = (CURTAIN_PANELS - 1) / 2;
	for (let i = 0; i < CURTAIN_PANELS; i++) {
		const left = i * width;
		const distFromCenter = Math.abs(i - center) / center;
		const skew = (i % 2 === 0 ? 1 : -1) * (4 + distFromCenter * 6);
		const delayMs = round(distFromCenter * durationMs * 0.25);
		fragments.push({
			id: `curtains-${i}`,
			clipPath: `polygon(${pct(left)} 0%, ${pct(left + width)} 0%, ${pct(left + width)} 100%, ${pct(left)} 100%)`,
			vars: { '--frag-skew': deg(skew) },
			delayMs,
			transformOrigin: `${round(left + width / 2)}% 0%`,
		});
	}
	return {
		keyframesName: 'pptx-tr-frag-curtains-out',
		durationMs: Math.round(durationMs * 0.85),
		easing: 'ease-in',
		fragments,
	};
}

/**
 * Airplane: measured as the outgoing slide folding into a paper-dart
 * silhouette - five triangular panels sharing the fold's creases - which
 * then flies off along the same path the single-layer `pptx-tr-airplane-out`
 * keyframe already used (kept for continuity/back-compat as the non-fragment
 * fallback). Each panel gets its own small hinge rotation (`--frag-fold*`) so
 * the dart visibly creases before the shared flight phase.
 */
interface AirplanePanel {
	id: string;
	points: readonly [number, number][];
	foldDeg: number;
	foldXDeg: number;
	delayMs: number;
}

const AIRPLANE_PANELS: readonly AirplanePanel[] = [
	{
		id: 'top-outer',
		points: [
			[72, 47],
			[18, 30],
			[30, 40],
		],
		foldDeg: -18,
		foldXDeg: 6,
		delayMs: 0,
	},
	{
		id: 'top-inner',
		points: [
			[72, 47],
			[30, 40],
			[40, 47],
		],
		foldDeg: -8,
		foldXDeg: 3,
		delayMs: 40,
	},
	{
		id: 'bottom-inner',
		points: [
			[72, 47],
			[40, 47],
			[30, 54],
		],
		foldDeg: 8,
		foldXDeg: -3,
		delayMs: 80,
	},
	{
		id: 'bottom-outer',
		points: [
			[72, 47],
			[30, 54],
			[18, 64],
		],
		foldDeg: 18,
		foldXDeg: -6,
		delayMs: 120,
	},
	{
		id: 'spine-tail',
		points: [
			[18, 30],
			[40, 47],
			[18, 64],
		],
		foldDeg: 0,
		foldXDeg: 0,
		delayMs: 60,
	},
];

export function airplaneFragments(durationMs: number): FragmentedLayer {
	const fragments: TransitionFragment[] = AIRPLANE_PANELS.map((panel) => ({
		id: `airplane-${panel.id}`,
		clipPath: `polygon(${panel.points.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(', ')})`,
		vars: {
			'--frag-fold': deg(panel.foldDeg),
			'--frag-fold-x': deg(panel.foldXDeg),
		},
		delayMs: panel.delayMs,
		transformOrigin: '45% 47%',
	}));
	return {
		keyframesName: 'pptx-tr-frag-airplane-out',
		durationMs,
		easing: 'ease-in',
		fragments,
	};
}
