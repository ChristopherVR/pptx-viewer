import type { PptxElementAnimation, PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	appendDimAnimation,
	applyAfterAnimationFromEditorList,
	buildAfterAnimationDimKeyframes,
	injectHideOnNextClickSteps,
	resolveAfterAnimationStepFields,
} from './animation-after-effect';
import type { TimelineClickGroup, TimelineStep } from './animation-timeline-types';

function nativeAnim(overrides: Partial<PptxNativeAnimation> = {}): PptxNativeAnimation {
	return {
		targetId: 'sp1',
		presetClass: 'entr',
		presetId: 1,
		trigger: 'onClick',
		durationMs: 500,
		...overrides,
	};
}

function editorAnim(overrides: Partial<PptxElementAnimation> = {}): PptxElementAnimation {
	return {
		elementId: 'sp1',
		entrance: 'fadeIn',
		...overrides,
	};
}

describe('applyAfterAnimationFromEditorList', () => {
	it('returns a shallow copy unchanged when no editor animations are given', () => {
		const natives = [nativeAnim()];
		const result = applyAfterAnimationFromEditorList(natives, undefined);
		expect(result).toStrictEqual(natives);
		expect(result).not.toBe(natives);
	});

	it('returns a shallow copy unchanged when no editor animation carries afterAnimation', () => {
		const natives = [nativeAnim()];
		const result = applyAfterAnimationFromEditorList(natives, [editorAnim()]);
		expect(result[0].afterAnimationAction).toBeUndefined();
	});

	it('merges afterAnimation + afterAnimationColor onto the matching native animation by targetId', () => {
		const natives = [nativeAnim({ targetId: 'sp1' }), nativeAnim({ targetId: 'sp2' })];
		const editors = [
			editorAnim({
				elementId: 'sp1',
				afterAnimation: 'dimToColor',
				afterAnimationColor: '#ff0000',
			}),
		];
		const result = applyAfterAnimationFromEditorList(natives, editors);
		expect(result[0].afterAnimationAction).toBe('dimToColor');
		expect(result[0].afterAnimationColor).toBe('#ff0000');
		expect(result[1].afterAnimationAction).toBeUndefined();
	});

	it('clears a stale native scheme-colour ref when the editor overrides the colour', () => {
		const natives = [
			nativeAnim({
				afterAnimationAction: 'dimToColor',
				afterAnimationColorRef: { scheme: 'accent2' },
				targetId: 'sp1',
			}),
		];
		const editors = [
			editorAnim({
				afterAnimation: 'dimToColor',
				afterAnimationColor: '#ff0000',
				elementId: 'sp1',
			}),
		];
		const result = applyAfterAnimationFromEditorList(natives, editors);
		expect(result[0].afterAnimationColor).toBe('#ff0000');
		expect(result[0].afterAnimationColorRef).toBeUndefined();
	});

	it('never merges afterAnimation onto an exit effect', () => {
		const natives = [nativeAnim({ targetId: 'sp1', presetClass: 'exit' })];
		const editors = [editorAnim({ elementId: 'sp1', afterAnimation: 'hideAfterAnimation' })];
		const result = applyAfterAnimationFromEditorList(natives, editors);
		expect(result[0].afterAnimationAction).toBeUndefined();
	});

	it('ignores an editor entry whose afterAnimation is "none"', () => {
		const natives = [nativeAnim({ targetId: 'sp1' })];
		const editors = [editorAnim({ elementId: 'sp1', afterAnimation: 'none' })];
		const result = applyAfterAnimationFromEditorList(natives, editors);
		expect(result[0].afterAnimationAction).toBeUndefined();
	});

	it('leaves an animation with no targetId untouched', () => {
		const natives = [nativeAnim({ targetId: undefined })];
		const editors = [editorAnim({ afterAnimation: 'hideAfterAnimation' })];
		const result = applyAfterAnimationFromEditorList(natives, editors);
		expect(result[0].afterAnimationAction).toBeUndefined();
	});

	it('preserves a native-parsed afterAnimationAction (genuine third-party markup) with no editor list', () => {
		// `pptx-viewer-core`'s native-timing parser now decodes PowerPoint's
		// genuine `p:subTnLst` after-effect shape directly onto
		// `afterAnimationAction` / `afterAnimationColor` (see
		// `native-animation-after-effect.ts`), so a real-world deck with no
		// `pptx:editorMeta` still reaches playback correctly here.
		const natives = [
			nativeAnim({
				targetId: 'sp1',
				afterAnimationAction: 'dimToColor',
				afterAnimationColor: '#808080',
			}),
		];
		const result = applyAfterAnimationFromEditorList(natives, undefined);
		expect(result[0].afterAnimationAction).toBe('dimToColor');
		expect(result[0].afterAnimationColor).toBe('#808080');
	});

	it('lets an editor list entry override a native-parsed afterAnimationAction', () => {
		const natives = [nativeAnim({ targetId: 'sp1', afterAnimationAction: 'hideAfterAnimation' })];
		const editors = [
			editorAnim({
				elementId: 'sp1',
				afterAnimation: 'dimToColor',
				afterAnimationColor: '#ff0000',
			}),
		];
		const result = applyAfterAnimationFromEditorList(natives, editors);
		expect(result[0].afterAnimationAction).toBe('dimToColor');
		expect(result[0].afterAnimationColor).toBe('#ff0000');
	});
});

describe('resolveAfterAnimationStepFields', () => {
	it('resolves a dim-to-scheme-colour ref against the theme colour map', () => {
		const anim = nativeAnim({
			afterAnimationAction: 'dimToColor',
			afterAnimationColorRef: { scheme: 'accent2' },
		});
		const fields = resolveAfterAnimationStepFields(anim, 'fadeIn 500ms', false, 500, 'dim-0', {
			accent2: '#336699',
		});
		expect(fields.holdEndState).toBeTruthy();
		expect(fields.dimKeyframeBlock).toContain('color: #336699;');
	});

	it('falls back (no dim) when the scheme ref has no matching theme colour map slot', () => {
		const anim = nativeAnim({
			afterAnimationAction: 'dimToColor',
			afterAnimationColorRef: { scheme: 'accent2' },
		});
		const fields = resolveAfterAnimationStepFields(anim, 'fadeIn 500ms', false, 500, 'dim-0');
		expect(fields.dimKeyframeBlock).toBeUndefined();
		expect(fields.cssAnimation).toBe('fadeIn 500ms');
	});

	it('prefers an already-resolved afterAnimationColor over a stale ref', () => {
		const anim = nativeAnim({
			afterAnimationAction: 'dimToColor',
			afterAnimationColor: '#808080',
			afterAnimationColorRef: { scheme: 'accent2' },
		});
		const fields = resolveAfterAnimationStepFields(anim, 'fadeIn 500ms', false, 500, 'dim-0', {
			accent2: '#336699',
		});
		expect(fields.dimKeyframeBlock).toContain('color: #808080;');
	});
});

describe('buildAfterAnimationDimKeyframes', () => {
	it('builds a single-ended keyframe block with only a 100% stop', () => {
		const css = buildAfterAnimationDimKeyframes('#336699', 'pptx-tl-dim-0');
		expect(css).toContain('@keyframes pptx-tl-dim-0');
		expect(css).toContain('100% { color: #336699; }');
		expect(css).not.toMatch(/\n\s*0% \{/);
	});
});

describe('appendDimAnimation', () => {
	it('appends the dim keyframe as a second comma-separated animation', () => {
		const result = appendDimAnimation('pptx-fadeIn 500ms ease 0ms 1 both', 'pptx-tl-dim-0', 500);
		expect(result).toBe(
			'pptx-fadeIn 500ms ease 0ms 1 both, pptx-tl-dim-0 1ms linear 500ms 1 forwards',
		);
	});

	it('clamps a negative start delay to zero', () => {
		const result = appendDimAnimation('pptx-fadeIn 500ms ease 0ms 1 both', 'pptx-tl-dim-0', -20);
		expect(result).toContain('pptx-tl-dim-0 1ms linear 0ms 1 forwards');
	});
});

describe('injectHideOnNextClickSteps', () => {
	function baseStep(overrides: Partial<TimelineStep> = {}): TimelineStep {
		return {
			elementId: 'sp1',
			cssAnimation: 'pptx-fadeIn 500ms ease 0ms 1 both',
			keyframeName: 'pptx-fadeIn',
			trigger: 'onClick',
			delayMs: 0,
			durationMs: 500,
			fillMode: 'both',
			presetClass: 'entr',
			...overrides,
		};
	}

	it('splices a synthetic exit step into the following click-group', () => {
		const groups: TimelineClickGroup[] = [
			{ steps: [baseStep({ pendingHideOnNextClick: true })], totalDurationMs: 500 },
			{ steps: [baseStep({ elementId: 'sp2' })], totalDurationMs: 500 },
		];
		injectHideOnNextClickSteps(groups);
		expect(groups[1].steps).toHaveLength(2);
		const hideStep = groups[1].steps.find((s) => s.elementId === 'sp1');
		expect(hideStep).toBeDefined();
		expect(hideStep?.presetClass).toBe('exit');
		expect(hideStep?.durationMs).toBe(0);
	});

	it('appends the synthetic hide step to the same group when it is the last one', () => {
		const groups: TimelineClickGroup[] = [
			{ steps: [baseStep({ pendingHideOnNextClick: true })], totalDurationMs: 500 },
		];
		injectHideOnNextClickSteps(groups);
		expect(groups[0].steps).toHaveLength(2);
		expect(groups[0].steps[1].presetClass).toBe('exit');
	});

	it('is a no-op when no step is pending hide-on-next-click', () => {
		const groups: TimelineClickGroup[] = [{ steps: [baseStep()], totalDurationMs: 500 }];
		injectHideOnNextClickSteps(groups);
		expect(groups[0].steps).toHaveLength(1);
	});
});
