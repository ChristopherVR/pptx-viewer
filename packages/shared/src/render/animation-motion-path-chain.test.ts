import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildChainedMotionKeyframes,
	mergeChainedMotionPathAnims,
} from './animation-motion-path-chain';

const PREFIXES = {
	motion: 'motion',
	rotationAbsolute: 'rotation-absolute',
	rotationRelative: 'rotation-relative',
	scaleAbsolute: 'scale-absolute',
	scaleRelative: 'scale-relative',
	transform: 'transform',
};

function pathAnim(overrides: Partial<PptxNativeAnimation> = {}): PptxNativeAnimation {
	return {
		targetId: 'slide1.xml-shape-1',
		presetClass: 'path',
		motionPath: 'M 0 0 L 0.5 0 ',
		parGroupIndex: 0,
		parGroupDelayMs: 0,
		durationMs: 1000,
		trigger: 'onShapeClick',
		triggerShapeId: 'slide1.xml-shape-9',
		...overrides,
	} as PptxNativeAnimation;
}

describe('mergeChainedMotionPathAnims', () => {
	it('merges parsed delay-only start conditions', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ startConditions: [{ delay: 0 }] }),
			pathAnim({ startConditions: [{ delay: 0 }], parGroupIndex: 1, parGroupDelayMs: 1000 }),
		]);
		expect('motionChain' in merged[0]).toBeTruthy();
	});

	it('does not merge across a click on another target', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ trigger: 'onClick' }),
			pathAnim({
				targetId: 'other',
				presetClass: 'entr',
				motionPath: undefined,
				trigger: 'onClick',
			}),
			pathAnim({ trigger: 'withPrevious', parGroupIndex: 2, parGroupDelayMs: 1000 }),
		]);
		expect(merged.some((anim) => 'motionChain' in anim)).toBeFalsy();
	});

	it('requires absolute offsets even when wrapper indices exist', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ parGroupDelayMs: undefined }),
			pathAnim({ parGroupIndex: 1, parGroupDelayMs: undefined, delayMs: 1000 }),
		]);
		expect(merged.some((anim) => 'motionChain' in anim)).toBeFalsy();
	});

	it('includes effect delays in the authored segment starts', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ delayMs: 500 }),
			pathAnim({ parGroupIndex: 1, parGroupDelayMs: 1500, triggerDelayMs: 1000 }),
		]);
		expect((merged[0] as { motionChain?: { startMs: number }[] }).motionChain?.[1].startMs).toBe(
			2000,
		);
	});

	it('does not merge overlapping paths or different hover triggers', () => {
		for (const second of [
			{ parGroupDelayMs: 500 },
			{ triggerShapeId: 'other', parGroupDelayMs: 1000 },
		]) {
			const merged = mergeChainedMotionPathAnims([
				pathAnim({}),
				pathAnim({ parGroupIndex: 1, ...second }),
			]);
			expect(merged.some((anim) => 'motionChain' in anim)).toBeFalsy();
		}
	});

	it('merges two contiguous same-target path segments into one chained animation', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({
				parGroupDelayMs: 0,
				durationMs: 2000,
				motionPath: 'M 0 0 L 0.5 0 ',
			}),
			pathAnim({
				parGroupIndex: 1,
				parGroupDelayMs: 2000,
				durationMs: 2000,
				motionPath: 'M 0.5 0 L 0.5 0.5 ',
			}),
		]);

		// Array length is preserved; the swallowed tail is flagged in place.
		expect(merged).toHaveLength(2);
		const head = merged[0] as { motionChain?: unknown[]; motionChainSwallowed?: boolean };
		expect(head.motionChain).toHaveLength(2);
		expect(head.motionChainSwallowed).toBeUndefined();
		// The merged path walks both segments' waypoints.
		expect(merged[0].motionPath).toContain('M 0 0');
		expect(merged[0].motionPath).toContain('L 0.5 0');
		expect(merged[0].motionPath).toContain('L 0.5 0.5');
		// The window spans both segments.
		expect(merged[0].durationMs).toBe(4000);
	});

	it('keeps a gap between segments as part of the merged window', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ parGroupDelayMs: 0, durationMs: 1000, motionPath: 'M 0 0 L 0.2 0 ' }),
			pathAnim({
				parGroupIndex: 1,
				parGroupDelayMs: 3000,
				durationMs: 1000,
				motionPath: 'M 0.2 0 L 0.4 0 ',
			}),
		]);
		expect(merged[0].durationMs).toBe(4000);
	});

	it('does not merge segments targeting different elements', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ targetId: 'slide1.xml-shape-1' }),
			pathAnim({ targetId: 'slide1.xml-shape-2', parGroupIndex: 1, parGroupDelayMs: 1000 }),
		]);
		expect(merged).toHaveLength(2);
		expect(
			merged.every((anim) => (anim as { motionChain?: unknown[] }).motionChain === undefined),
		).toBeTruthy();
	});

	it('never collapses a click boundary: a later onClick member blocks the run', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ trigger: 'onClick' }),
			pathAnim({ trigger: 'onClick', parGroupIndex: 1, parGroupDelayMs: 1000 }),
		]);
		expect(merged).toHaveLength(2);
	});

	it('flags swallowed members so builders can skip them', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim(),
			pathAnim({ parGroupIndex: 1, parGroupDelayMs: 1000 }),
		]) as Array<{ motionChainSwallowed?: boolean }>;
		expect(merged[0].motionChainSwallowed).toBeUndefined();
		expect(merged[1].motionChainSwallowed).toBeTruthy();
	});

	it('merges segments that carry animation sounds (their cues re-fire as sound-only steps)', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ soundPath: 'media/move.wav', durationMs: 2000, motionPath: 'M 0 0 L 0.5 0 ' }),
			pathAnim({
				parGroupIndex: 1,
				parGroupDelayMs: 2000,
				soundPath: 'media/drop.wav',
				durationMs: 2000,
				motionPath: 'M 0.5 0 L 0.5 0.5 ',
			}),
		]) as Array<{ motionChain?: unknown[]; motionChainSwallowed?: boolean; soundPath?: string }>;
		expect((merged[0] as { motionChain?: unknown[] }).motionChain).toHaveLength(2);
		// The tail is flagged; its sound stays on it for the builder to emit
		// as a sound-only step at the segment's authored start.
		expect(merged[1].motionChainSwallowed).toBeTruthy();
		expect(merged[1].soundPath).toBe('media/drop.wav');
	});

	it('emits a leading opacity ramp when the run has a pre-chain exit', () => {
		// The deck parks the rope above the slide and hides it with an exit at
		// 0s; the merged journey must stay invisible through its own delay
		// phase (the 0% keyframe) and pop in as the descend begins.
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ presetClass: 'exit', motionPath: 'M 0 0 L 0 0 ', delayMs: 0, durationMs: 0 }),
			pathAnim({ parGroupDelayMs: 2000, durationMs: 2000, motionPath: 'M 0 0 L 0.5 0 ' }),
			pathAnim({
				parGroupIndex: 1,
				parGroupDelayMs: 4000,
				durationMs: 2000,
				motionPath: 'M 0.5 0 L 0.5 0.5 ',
			}),
		]) as Array<{ motionChainHideUntilStart?: boolean }>;
		// merged[0] is the authored exit (kept as-is); merged[1] is the chain.
		expect((merged[0] as { motionChain?: unknown[] }).motionChain).toBeUndefined();
		const head = merged[1] as Parameters<typeof buildChainedMotionKeyframes>[0];
		expect(head.motionChainHideUntilStart).toBeTruthy();
		const result = buildChainedMotionKeyframes(head, 9, PREFIXES);
		expect(result).toBeDefined();
		// 0% hides (through the delay phase), the next keyframe pops in.
		expect(result?.css).toMatch(/0% \{[^}]*opacity: 0;/);
		expect(result?.css).toMatch(/0\.01% \{[^}]*opacity: 1;/);
	});

	it('leaves single path animations untouched', () => {
		const merged = mergeChainedMotionPathAnims([pathAnim()]);
		expect(merged).toHaveLength(1);
		expect((merged[0] as { motionChain?: unknown[] }).motionChain).toBeUndefined();
	});

	it('does not merge segments without absolute wrapper offsets', () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ parGroupIndex: undefined, parGroupDelayMs: undefined }),
			pathAnim({
				parGroupIndex: undefined,
				parGroupDelayMs: undefined,
				delayMs: 1000,
			}),
		]);
		expect(merged).toHaveLength(2);
	});
});

describe('buildChainedMotionKeyframes', () => {
	it('places each segment at its authored time position', () => {
		const anim = mergeChainedMotionPathAnims([
			pathAnim({ parGroupDelayMs: 0, durationMs: 2000, motionPath: 'M 0 0 L 0.5 0 ' }),
			pathAnim({
				parGroupIndex: 1,
				parGroupDelayMs: 2000,
				durationMs: 2000,
				motionPath: 'M 0.5 0 L 0.5 0.5 ',
			}),
		])[0] as Parameters<typeof buildChainedMotionKeyframes>[0];

		const result = buildChainedMotionKeyframes(anim, 7, PREFIXES);
		expect(result).toBeDefined();
		// Halfway through the journey the shape sits at the first segment's end.
		expect(result?.css).toContain('50% {');
		expect(result?.css).toContain('calc(var(--pptx-slide-w, 1280px) * 0.5000)');
		// The journey ends at the second segment's end.
		expect(result?.css).toContain('100% {');
		expect(result?.css).toContain('calc(var(--pptx-slide-h, 720px) * 0.5000)');
	});

	it('holds the last position across a gap between segments', () => {
		const anim = mergeChainedMotionPathAnims([
			pathAnim({ parGroupDelayMs: 0, durationMs: 1000, motionPath: 'M 0 0 L 0.2 0 ' }),
			pathAnim({
				parGroupIndex: 1,
				parGroupDelayMs: 3000,
				durationMs: 1000,
				motionPath: 'M 0.2 0 L 0.4 0 ',
			}),
		])[0] as Parameters<typeof buildChainedMotionKeyframes>[0];

		const result = buildChainedMotionKeyframes(anim, 3, PREFIXES);
		expect(result).toBeDefined();
		// At 25% (end of segment 1) and 75% (start of segment 2) the x offset is
		// the same 0.2: the shape holds still across the gap.
		const at25 = result?.css.match(/25% \{[^}]*\}/)?.[0] ?? '';
		const at75 = result?.css.match(/75% \{[^}]*\}/)?.[0] ?? '';
		expect(at25).toContain('* 0.2000)');
		expect(at75).toContain('* 0.2000)');
	});

	it("carries each segment's accel/decel easing on its first keyframe", () => {
		const merged = mergeChainedMotionPathAnims([
			pathAnim({ accel: 0.5, decel: 0.5, durationMs: 1000, motionPath: 'M 0 0 L 0.2 0 ' }),
			pathAnim({
				parGroupIndex: 1,
				parGroupDelayMs: 1000,
				accel: 0,
				decel: 0,
				durationMs: 1000,
				motionPath: 'M 0.2 0 L 0.4 0 ',
			}),
		]);
		const anim = merged[0] as Parameters<typeof buildChainedMotionKeyframes>[0];
		const result = buildChainedMotionKeyframes(anim, 5, PREFIXES);
		expect(result).toBeDefined();
		// The 0% keyframe opens segment 1 with its eased timing function.
		expect(result?.css).toMatch(/0% \{ animation-timing-function: [^}]*transform:/);
	});
});
