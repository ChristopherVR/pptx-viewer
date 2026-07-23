import type { PptxTransitionType } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	CINEMATIC_TRANSITION_KEYFRAMES,
	getCinematicTransitionAnimations,
} from './slide-transition-cinematic';
import { getSlideTransitionAnimations } from './slide-transition-css';

const DUR = 800;

/** Every p15 cinematic type this module owns. */
const CINEMATIC_TYPES: readonly PptxTransitionType[] = [
	'cube',
	'flip',
	'rotate',
	'orbit',
	'fallOver',
	'drape',
	'curtains',
	'wind',
	'prestige',
	'fracture',
	'crush',
	'peelOff',
	'pageCurlSingle',
	'pageCurlDouble',
	'airplane',
	'origami',
];

/** Keyframe names the incoming layer reuses from the core (non-cinematic) block. */
const CORE_REUSED = new Set(['pptx-tr-fade-in']);

/** Pull the leading `@keyframes NAME` off an `animation` shorthand, or `undefined`. */
function keyframeName(animation: string): string | undefined {
	if (animation === 'none') {
		return undefined;
	}
	return animation.split(/\s+/u)[0];
}

describe('getCinematicTransitionAnimations', () => {
	it('returns undefined for non-cinematic types', () => {
		for (const type of ['fade', 'push', 'conveyor', 'morph', 'none'] as PptxTransitionType[]) {
			expect(getCinematicTransitionAnimations(type, DUR, undefined)).toBeUndefined();
		}
	});

	it('owns every p15 cinematic type with a real (non-cross-fade) result', () => {
		for (const type of CINEMATIC_TYPES) {
			const result = getCinematicTransitionAnimations(type, DUR, undefined);
			expect(result).toBeDefined();
			// A real cinematic effect never leaves the outgoing layer on a plain
			// symmetric cross-fade (`pptx-tr-fade-out`), which is the default sentinel.
			expect(result?.outgoing.startsWith('pptx-tr-fade-out ')).toBeFalsy();
			// At least one layer must carry an animation.
			expect(result?.outgoing === 'none' && result?.incoming === 'none').toBeFalsy();
		}
	});

	it('threads the configured duration into the shorthand', () => {
		const result = getCinematicTransitionAnimations('cube', 640, 'l');
		expect(result?.outgoing).toContain('640ms');
		expect(result?.incoming).toContain('640ms');
	});

	it('produces a distinct keyframe pair per cinematic type', () => {
		// Signature is the (outgoing keyframe, incoming keyframe) pair: pageCurl
		// single/double deliberately share the outgoing curl but differ on incoming.
		const signatures = new Set<string>();
		for (const type of CINEMATIC_TYPES) {
			const result = getCinematicTransitionAnimations(type, DUR, undefined);
			const out = keyframeName(result?.outgoing ?? 'none') ?? '-';
			const inc = keyframeName(result?.incoming ?? 'none') ?? '-';
			expect(out === '-' && inc === '-').toBeFalsy();
			signatures.add(`${out}|${inc}`);
		}
		// 16 types resolve to 16 distinct outgoing/incoming keyframe signatures.
		expect(signatures.size).toBe(CINEMATIC_TYPES.length);
	});

	it('respects direction for cube (left/right/up/down are distinct)', () => {
		const left = getCinematicTransitionAnimations('cube', DUR, 'l');
		const right = getCinematicTransitionAnimations('cube', DUR, 'r');
		const up = getCinematicTransitionAnimations('cube', DUR, 'u');
		const down = getCinematicTransitionAnimations('cube', DUR, 'd');
		expect(left?.outgoing).toContain('pptx-tr-cube-out-left');
		expect(right?.outgoing).toContain('pptx-tr-cube-out-right');
		expect(up?.outgoing).toContain('pptx-tr-cube-out-up');
		expect(down?.outgoing).toContain('pptx-tr-cube-out-down');
	});

	it('maps rotate direction to clockwise / counter-clockwise spin', () => {
		expect(getCinematicTransitionAnimations('rotate', DUR, 'r')?.outgoing).toContain(
			'pptx-tr-rotate-out-cw',
		);
		expect(getCinematicTransitionAnimations('rotate', DUR, 'l')?.outgoing).toContain(
			'pptx-tr-rotate-out-ccw',
		);
	});

	it('blows wind left or right per direction', () => {
		expect(getCinematicTransitionAnimations('wind', DUR, 'r')?.outgoing).toContain(
			'pptx-tr-wind-out-right',
		);
		expect(getCinematicTransitionAnimations('wind', DUR, 'l')?.outgoing).toContain(
			'pptx-tr-wind-out-left',
		);
	});

	it('reveals the stationary incoming slide for curl / peel / drape effects', () => {
		expect(getCinematicTransitionAnimations('pageCurlSingle', DUR, undefined)?.incoming).toBe(
			'none',
		);
		expect(getCinematicTransitionAnimations('peelOff', DUR, undefined)?.incoming).toBe('none');
		expect(getCinematicTransitionAnimations('curtains', DUR, undefined)?.incoming).toBe('none');
		expect(getCinematicTransitionAnimations('drape', DUR, undefined)?.outgoing).toBe('none');
	});
});

describe('cinematic transition keyframes', () => {
	it('defines a @keyframes block for every referenced keyframe name', () => {
		// Directional types need all four cardinal variants exercised.
		const directions = [undefined, 'l', 'r', 'u', 'd'];
		for (const type of CINEMATIC_TYPES) {
			for (const dir of directions) {
				const result = getCinematicTransitionAnimations(type, DUR, dir);
				for (const layer of [result?.outgoing, result?.incoming]) {
					const name = keyframeName(layer ?? 'none');
					if (!name || CORE_REUSED.has(name)) {
						continue;
					}
					expect(CINEMATIC_TRANSITION_KEYFRAMES).toContain(`@keyframes ${name} `);
				}
			}
		}
	});

	it('keeps every keyframe under the pptx-tr- namespace', () => {
		const names = CINEMATIC_TRANSITION_KEYFRAMES.match(/@keyframes\s+([\w-]+)/gu) ?? [];
		expect(names.length).toBeGreaterThan(0);
		for (const decl of names) {
			expect(decl).toContain('@keyframes pptx-tr-');
		}
	});
});

describe('getSlideTransitionAnimations wiring (p15 cinematic)', () => {
	it('routes every cinematic type away from the default cross-fade', () => {
		for (const type of CINEMATIC_TYPES) {
			const viaMain = getSlideTransitionAnimations(type, DUR, undefined);
			const viaOwn = getCinematicTransitionAnimations(type, DUR, undefined);
			expect(viaMain).toStrictEqual(viaOwn);
			// The default fallback would be fade-out + fade-in; assert we escaped it.
			expect(viaMain.outgoing.startsWith('pptx-tr-fade-out ')).toBeFalsy();
		}
	});
});
