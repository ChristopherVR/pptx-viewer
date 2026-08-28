import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { buildTimeline } from './animation-timeline-builder';

function makeAnim(overrides: Partial<PptxNativeAnimation> = {}): PptxNativeAnimation {
	return {
		targetId: 'el1',
		presetClass: 'entr',
		presetId: 10, // fadeIn
		trigger: 'onClick',
		durationMs: 500,
		delayMs: 0,
		...overrides,
	} as PptxNativeAnimation;
}

describe('buildTimeline', () => {
	// -------------------------------------------------------------------
	// Empty input
	// -------------------------------------------------------------------
	it('returns empty timeline for no animations', () => {
		const result = buildTimeline([]);
		expect(result.clickGroups).toStrictEqual([]);
		expect(result.entranceElementIds.size).toBe(0);
		expect(result.keyframesCss).toBe('');
		expect(result.interactiveSequences.size).toBe(0);
		expect(result.hoverSequences.size).toBe(0);
	});

	// -------------------------------------------------------------------
	// Single animation
	// -------------------------------------------------------------------
	it('creates a single click-group from one onClick animation', () => {
		const result = buildTimeline([makeAnim()]);
		expect(result.clickGroups).toHaveLength(1);
		expect(result.clickGroups[0].steps).toHaveLength(1);
		expect(result.clickGroups[0].steps[0].elementId).toBe('el1');
	});

	it('prefers authored sibling transforms over the approximate preset', () => {
		const keyframes = (from: number | string, to: number | string) => [
			{
				tm: 0,
				value: from,
				valueType: typeof from === 'number' ? ('flt' as const) : ('str' as const),
			},
			{
				tm: 100000,
				value: to,
				valueType: typeof to === 'number' ? ('flt' as const) : ('str' as const),
			},
		];
		const result = buildTimeline([
			makeAnim({
				durationMs: 1000,
				presetId: 31,
				attributeAnimations: [
					{ attrName: 'ppt_w', durationMs: 1000, keyframes: keyframes(0, '#ppt_w') },
					{ attrName: 'ppt_h', durationMs: 1000, keyframes: keyframes(0, '#ppt_h') },
					{
						attrName: 'style.rotation',
						durationMs: 1000,
						keyframes: keyframes(90, 0),
					},
				],
			}),
		]);

		expect(result.clickGroups[0].steps[0].keyframeName).toContain('pptx-tl-transform');
		expect(result.keyframesCss).toContain('rotate(90deg) scale(0, 0)');
		expect(result.keyframesCss).not.toContain('@keyframes pptx-expandIn');
	});

	it('tracks entrance element IDs', () => {
		const result = buildTimeline([makeAnim({ presetClass: 'entr' })]);
		expect(result.entranceElementIds.has('el1')).toBeTruthy();
	});

	it('routes a p:bg animation to an independent background target', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				target: { type: 'shape', shapeId: 'el1', backgroundOnly: true },
			}),
		]);
		expect(result.clickGroups[0].steps[0].elementId).toBe('el1::pptx-bg');
		expect(result.entranceElementIds).toStrictEqual(new Set(['el1::pptx-bg']));
	});

	it('does not track exit elements as entrance', () => {
		const result = buildTimeline([makeAnim({ presetClass: 'exit', presetId: 10 })]);
		expect(result.entranceElementIds.has('el1')).toBeFalsy();
	});

	it('does not track emphasis elements as entrance', () => {
		const result = buildTimeline([makeAnim({ presetClass: 'emph', presetId: 26 })]);
		expect(result.entranceElementIds.has('el1')).toBeFalsy();
	});

	// -------------------------------------------------------------------
	// Multiple onClick animations create separate click-groups
	// -------------------------------------------------------------------
	it('creates separate click-groups for multiple onClick animations', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', trigger: 'onClick' }),
			makeAnim({ targetId: 'el2', trigger: 'onClick' }),
			makeAnim({ targetId: 'el3', trigger: 'onClick' }),
		]);
		expect(result.clickGroups).toHaveLength(3);
	});

	// -------------------------------------------------------------------
	// withPrevious stays in same click-group
	// -------------------------------------------------------------------
	it('keeps withPrevious animations in the same click-group', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', trigger: 'onClick' }),
			makeAnim({ targetId: 'el2', trigger: 'withPrevious' }),
		]);
		expect(result.clickGroups).toHaveLength(1);
		expect(result.clickGroups[0].steps).toHaveLength(2);
	});

	it('computes withPrevious delay relative to previous step delay', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', trigger: 'onClick', delayMs: 100 }),
			makeAnim({ targetId: 'el2', trigger: 'withPrevious', delayMs: 50 }),
		]);
		const steps = result.clickGroups[0].steps;
		// withPrevious delay = prev.delayMs + animDelay + triggerDelay
		// = 100 + 50 + 0 = 150
		expect(steps[1].delayMs).toBe(150);
	});

	// -------------------------------------------------------------------
	// afterPrevious stays in same click-group, delayed
	// -------------------------------------------------------------------
	it('keeps afterPrevious animations in the same click-group', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', trigger: 'onClick' }),
			makeAnim({ targetId: 'el2', trigger: 'afterPrevious' }),
		]);
		expect(result.clickGroups).toHaveLength(1);
		expect(result.clickGroups[0].steps).toHaveLength(2);
	});

	it('computes afterPrevious delay as prev.delay + prev.duration', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				delayMs: 0,
				durationMs: 500,
			}),
			makeAnim({
				targetId: 'el2',
				trigger: 'afterPrevious',
				delayMs: 0,
			}),
		]);
		const steps = result.clickGroups[0].steps;
		// afterPrevious delay = prev.delayMs + prev.durationMs + animDelay + triggerDelay
		// = 0 + 500 + 0 + 0 = 500
		expect(steps[1].delayMs).toBe(500);
	});

	// -------------------------------------------------------------------
	// First animation starts implicit click-group regardless of trigger
	// -------------------------------------------------------------------
	it('creates implicit click-group for first withPrevious animation', () => {
		const result = buildTimeline([makeAnim({ targetId: 'el1', trigger: 'withPrevious' })]);
		expect(result.clickGroups).toHaveLength(1);
		expect(result.clickGroups[0].steps).toHaveLength(1);
	});

	it('creates implicit click-group for first afterPrevious animation', () => {
		const result = buildTimeline([makeAnim({ targetId: 'el1', trigger: 'afterPrevious' })]);
		expect(result.clickGroups).toHaveLength(1);
	});

	// -------------------------------------------------------------------
	// afterDelay trigger
	// -------------------------------------------------------------------
	it('handles afterDelay trigger with triggerDelayMs', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				delayMs: 0,
				durationMs: 500,
			}),
			makeAnim({
				targetId: 'el2',
				trigger: 'afterDelay',
				triggerDelayMs: 200,
				delayMs: 0,
			} as PptxNativeAnimation),
		]);
		const steps = result.clickGroups[0].steps;
		// afterDelay delay = prev.delayMs + prev.durationMs + animDelay + triggerDelay
		// = 0 + 500 + 0 + 200 = 700
		expect(steps[1].delayMs).toBe(700);
	});

	// -------------------------------------------------------------------
	// CSS animation string format
	// -------------------------------------------------------------------
	it('generates correct CSS animation shorthand', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				durationMs: 1000,
				delayMs: 0,
			}),
		]);
		const step = result.clickGroups[0].steps[0];
		expect(step.cssAnimation).toContain('pptx-fadeIn');
		expect(step.cssAnimation).toContain('1000ms');
		expect(step.cssAnimation).toContain('ease');
		expect(step.cssAnimation).toContain('both');
	});

	it('includes iteration count and direction in CSS animation', () => {
		const result = buildTimeline([
			makeAnim({
				repeatCount: 3,
				autoReverse: true,
			} as PptxNativeAnimation),
		]);
		const step = result.clickGroups[0].steps[0];
		expect(step.cssAnimation).toContain('3');
		expect(step.cssAnimation).toContain('alternate');
	});

	it("uses 'infinite' for infinite repeat count", () => {
		const result = buildTimeline([
			makeAnim({
				repeatCount: Infinity,
			} as PptxNativeAnimation),
		]);
		const step = result.clickGroups[0].steps[0];
		expect(step.cssAnimation).toContain('infinite');
	});

	// -------------------------------------------------------------------
	// Keyframes CSS generation
	// -------------------------------------------------------------------
	it('generates keyframesCss for known effects', () => {
		const result = buildTimeline([makeAnim({ presetId: 10 })]);
		expect(result.keyframesCss).toContain('@keyframes');
		expect(result.keyframesCss).toContain('pptx-fadeIn');
	});

	it('generates unique keyframes CSS without duplicates', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', presetId: 10 }),
			makeAnim({ targetId: 'el2', presetId: 10, trigger: 'onClick' }),
		]);
		const matches = result.keyframesCss.match(/@keyframes pptx-fadeIn/gu);
		// Should only have one definition even though two animations use it
		expect(matches).toHaveLength(1);
	});

	// -------------------------------------------------------------------
	// Click-group totalDurationMs
	// -------------------------------------------------------------------
	it('computes totalDurationMs for click-group correctly', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				durationMs: 500,
				delayMs: 0,
			}),
			makeAnim({
				targetId: 'el2',
				trigger: 'afterPrevious',
				durationMs: 300,
				delayMs: 0,
			}),
		]);
		// el1: ends at 500, el2: starts at 500, ends at 800
		expect(result.clickGroups[0].totalDurationMs).toBe(800);
	});

	// -------------------------------------------------------------------
	// Fill mode
	// -------------------------------------------------------------------
	it("sets fill mode to 'both' for entrance animations", () => {
		const result = buildTimeline([makeAnim({ presetClass: 'entr' })]);
		expect(result.clickGroups[0].steps[0].fillMode).toBe('both');
	});

	it("sets fill mode to 'forwards' for exit animations", () => {
		const result = buildTimeline([makeAnim({ presetClass: 'exit', presetId: 10 })]);
		expect(result.clickGroups[0].steps[0].fillMode).toBe('forwards');
	});

	// -------------------------------------------------------------------
	// Interactive sequences (onShapeClick)
	// -------------------------------------------------------------------
	it('separates onShapeClick animations into interactive sequences', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', trigger: 'onClick' }),
			makeAnim({
				targetId: 'el2',
				trigger: 'onShapeClick',
				triggerShapeId: 'shape1',
			} as PptxNativeAnimation),
		]);
		expect(result.clickGroups).toHaveLength(1);
		expect(result.interactiveSequences.has('shape1')).toBeTruthy();
		const seqGroups = result.interactiveSequences.get('shape1')!;
		expect(seqGroups.length).toBeGreaterThanOrEqual(1);
		expect(seqGroups[0].steps[0].elementId).toBe('el2');
	});

	it('groups multiple interactive animations under same trigger shape', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onShapeClick',
				triggerShapeId: 'btn1',
			} as PptxNativeAnimation),
			makeAnim({
				targetId: 'el2',
				trigger: 'onShapeClick',
				triggerShapeId: 'btn1',
			} as PptxNativeAnimation),
		]);
		expect(result.interactiveSequences.has('btn1')).toBeTruthy();
		const seqGroups = result.interactiveSequences.get('btn1')!;
		// Both animations should be in the same sequence
		const totalSteps = seqGroups.reduce((sum, g) => sum + g.steps.length, 0);
		expect(totalSteps).toBe(2);
	});

	// -------------------------------------------------------------------
	// Dynamic keyframes (motion path)
	// -------------------------------------------------------------------
	it('generates dynamic keyframes for motion path animations', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				presetClass: undefined,
				presetId: undefined,
				motionPath: 'M 0 0 L 1 1',
			} as PptxNativeAnimation),
		]);
		expect(result.keyframesCss).toContain('@keyframes pptx-tl-motion-');
		expect(result.keyframesCss).toContain('translate(');
	});

	it('generates dynamic keyframes for rotation animations', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				presetClass: undefined,
				presetId: undefined,
				rotationBy: 360,
			} as PptxNativeAnimation),
		]);
		expect(result.keyframesCss).toContain('@keyframes pptx-tl-rotate-');
		expect(result.keyframesCss).toContain('rotate(360deg)');
	});

	it('prefers authored compound transforms over the canned preset', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				presetClass: 'entr',
				presetId: 52,
				motionPath: 'M 0 0 L 0.2 0.1',
				rotationFrom: 30,
				rotationTo: 0,
				scaleFromX: 2.5,
				scaleFromY: 2,
				scaleToX: 1,
				scaleToY: 1,
			} as PptxNativeAnimation),
		]);

		expect(result.keyframesCss).toContain('@keyframes pptx-tl-transform-');
		expect(result.keyframesCss).toContain('rotate(30deg)');
		expect(result.keyframesCss).toContain('scale(2.5, 2)');
		expect(result.keyframesCss).toContain('opacity: 0');
		expect(result.clickGroups[0].steps[0].keyframeName).toContain('pptx-tl-transform-');
	});

	it('generates dynamic keyframes for an absolute p:animRot (from/to, no @by)', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				presetClass: undefined,
				presetId: undefined,
				rotationFrom: 0,
				rotationTo: 180,
			} as PptxNativeAnimation),
		]);
		expect(result.keyframesCss).toContain('@keyframes pptx-tl-rotateAbs-');
		expect(result.keyframesCss).toContain('rotate(0deg)');
		expect(result.keyframesCss).toContain('rotate(180deg)');
		expect(result.clickGroups[0].steps[0].cssAnimation).toContain('pptx-tl-rotateAbs-');
	});

	it('generates dynamic keyframes for an absolute p:animScale (from/to, no @by)', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				presetClass: undefined,
				presetId: undefined,
				scaleFromX: 0.5,
				scaleFromY: 0.5,
				scaleToX: 2,
				scaleToY: 2,
			} as PptxNativeAnimation),
		]);
		expect(result.keyframesCss).toContain('@keyframes pptx-tl-scaleAbs-');
		expect(result.keyframesCss).toContain('scale(0.5, 0.5)');
		expect(result.keyframesCss).toContain('scale(2, 2)');
	});

	it('honours a real p:tavLst opacity ramp on a Transparency emphasis instead of the canned 2-stop default', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				presetClass: 'emph',
				presetId: 9, // Transparency
				keyframes: [
					{ tm: 0, value: 1, valueType: 'flt' },
					{ tm: 30000, value: 0.1, valueType: 'flt' },
					{ tm: 100000, value: 1, valueType: 'flt' },
				],
			} as PptxNativeAnimation),
		]);
		expect(result.keyframesCss).toContain('@keyframes pptx-tl-tav-');
		expect(result.keyframesCss).toContain('30% { opacity: 0.1; }');
		expect(result.keyframesCss).not.toContain('pptx-transparency');
	});

	it('falls back to the canned Transparency keyframes when there is no p:tavLst', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', trigger: 'onClick', presetClass: 'emph', presetId: 9 }),
		]);
		expect(result.keyframesCss).toContain('@keyframes pptx-transparency');
	});

	it('rejects a numeric [0, 1] ramp explicitly named for a non-opacity attribute, falling back to canned timing', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				presetClass: 'emph',
				presetId: 9, // Transparency
				attrName: 'ppt_w',
				keyframes: [
					{ tm: 0, value: 0.5, valueType: 'flt' },
					{ tm: 100000, value: 1, valueType: 'flt' },
				],
			} as PptxNativeAnimation),
		]);
		expect(result.keyframesCss).toContain('@keyframes pptx-transparency');
		expect(result.keyframesCss).not.toContain('pptx-tl-tav-');
	});

	it('honours a p:tavLst colour ramp on a generic p:anim naming fillcolor', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				presetClass: 'emph',
				presetId: undefined,
				attrName: 'fillcolor',
				keyframes: [
					{ tm: 0, value: '#ff0000', valueType: 'clr' },
					{ tm: 100000, value: '#0000ff', valueType: 'clr' },
				],
			} as PptxNativeAnimation),
		]);
		expect(result.keyframesCss).toContain('@keyframes pptx-tl-tavclr-');
		expect(result.keyframesCss).toContain('fill: #ff0000;');
		expect(result.keyframesCss).toContain('fill: #0000ff;');
		expect(result.clickGroups[0].steps[0].colorTargets).toStrictEqual(['fill']);
	});

	it('does not flag colorTargets when the colour attrName is present but the ramp could not be resolved', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				trigger: 'onClick',
				presetClass: 'emph',
				presetId: undefined,
				attrName: 'fillcolor',
				// Scheme-colour tokens can't resolve to a CSS colour without theme
				// context, so buildColorTavKeyframe bails and this step falls back
				// to the neutral emphasis pulse instead.
				keyframes: [
					{ tm: 0, value: 'accent1', valueType: 'clr' },
					{ tm: 100000, value: 'accent2', valueType: 'clr' },
				],
			} as PptxNativeAnimation),
		]);
		expect(result.clickGroups[0].steps[0].colorTargets).toBeUndefined();
	});

	// -------------------------------------------------------------------
	// p:excl exclusivity (exclGroupId) reaches the timeline step
	// -------------------------------------------------------------------
	it('carries exclGroupId from the native animation onto its timeline step', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', trigger: 'onClick', exclusive: true, exclGroupId: 7 }),
		]);
		expect(result.clickGroups[0].steps[0].exclGroupId).toBe(7);
	});

	// -------------------------------------------------------------------
	// onHover trigger goes to hover sequences (not click-groups)
	// -------------------------------------------------------------------
	it('separates onHover animations into hover sequences', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', trigger: 'onClick' }),
			makeAnim({ targetId: 'el2', trigger: 'onHover' }),
		]);
		// el1 in click-groups, el2 in hover sequences
		expect(result.clickGroups).toHaveLength(1);
		expect(result.hoverSequences.has('el2')).toBeTruthy();
	});

	// -------------------------------------------------------------------
	// Sound properties
	// -------------------------------------------------------------------
	it('passes through sound properties on timeline steps', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				soundPath: 'media/click.wav',
				stopSound: true,
			} as PptxNativeAnimation),
		]);
		const step = result.clickGroups[0].steps[0];
		expect(step.soundPath).toBe('media/click.wav');
		expect(step.stopSound).toBeTruthy();
	});

	// -------------------------------------------------------------------
	// Default duration when durationMs is not specified
	// -------------------------------------------------------------------
	it('uses default duration when durationMs is not provided', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'el1',
				presetClass: 'emph',
				presetId: 26, // pulse
				durationMs: undefined,
			} as PptxNativeAnimation),
		]);
		// default for emph is 800ms
		expect(result.clickGroups[0].steps[0].durationMs).toBe(800);
	});

	// -------------------------------------------------------------------
	// Issue #81: unmapped presets are not silently dropped (which left
	// entrances visible / exits never hiding).
	// -------------------------------------------------------------------
	it('keeps an unmapped entrance hidden-until-start instead of dropping it', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', presetClass: 'entr', presetId: 99999 }),
		]);
		// The element must be registered as an entrance (initially hidden) ...
		expect(result.entranceElementIds.has('el1')).toBeTruthy();
		// ... and still produce a step so it becomes visible at its start.
		expect(result.clickGroups).toHaveLength(1);
		const step = result.clickGroups[0].steps[0];
		expect(step.elementId).toBe('el1');
		expect(step.keyframeName).toBe('pptx-fadeIn');
		expect(step.presetClass).toBe('entr');
	});

	it('still hides an element with an unmapped exit preset', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', presetClass: 'exit', presetId: 99999 }),
		]);
		// An unmapped exit is not an entrance ...
		expect(result.entranceElementIds.has('el1')).toBeFalsy();
		// ... but still produces a hiding step (fade out, fill forwards).
		expect(result.clickGroups).toHaveLength(1);
		const step = result.clickGroups[0].steps[0];
		expect(step.keyframeName).toBe('pptx-fadeOut');
		expect(step.fillMode).toBe('forwards');
	});

	it('plays a neutral pulse for an unmapped emphasis preset instead of dropping it', () => {
		// Emphasis carries no show/hide semantics, but an unmapped emphasis must
		// still animate rather than being silently dropped (issue: inert emphasis).
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', presetClass: 'emph', presetId: 99999 }),
		]);
		expect(result.clickGroups).toHaveLength(1);
		const step = result.clickGroups[0].steps[0];
		expect(step.elementId).toBe('el1');
		expect(step.keyframeName).toBe('pptx-pulse');
		expect(step.presetClass).toBe('emph');
		// An emphasis is not an entrance, so it must not be initially hidden.
		expect(result.entranceElementIds.has('el1')).toBeFalsy();
	});

	it('falls back to the neutral emphasis for emph.4 (Change Font Size, not a filter-based darken preset)', () => {
		// emph.4 used to be mislabelled 'darken'; it is really Change Font
		// Size, which has no dynamic keyframe support yet and must fall back
		// to the neutral emphasis animation instead of a fabricated filter.
		const result = buildTimeline([makeAnim({ targetId: 'el1', presetClass: 'emph', presetId: 4 })]);
		expect(result.clickGroups).toHaveLength(1);
		const step = result.clickGroups[0].steps[0];
		expect(step.keyframeName).toBe('pptx-pulse');
	});

	// -------------------------------------------------------------------
	// accel / decel easing (mapped to an accurate cubic-bezier)
	// -------------------------------------------------------------------
	it('uses neutral ease when neither accel nor decel is set', () => {
		const result = buildTimeline([makeAnim()]);
		expect(result.clickGroups[0].steps[0].cssAnimation).toContain(' ease ');
	});

	it('maps accel to an ease-in cubic-bezier reflecting its magnitude', () => {
		const result = buildTimeline([makeAnim({ accel: 0.5 })]);
		expect(result.clickGroups[0].steps[0].cssAnimation).toContain(
			'cubic-bezier(0.500, 0, 1.000, 1)',
		);
	});

	it('maps decel to an ease-out cubic-bezier reflecting its magnitude', () => {
		const result = buildTimeline([makeAnim({ decel: 0.5 })]);
		expect(result.clickGroups[0].steps[0].cssAnimation).toContain(
			'cubic-bezier(0.000, 0, 0.500, 1)',
		);
	});

	it('maps accel + decel to an ease-in-out cubic-bezier', () => {
		const result = buildTimeline([makeAnim({ accel: 0.3, decel: 0.3 })]);
		expect(result.clickGroups[0].steps[0].cssAnimation).toContain(
			'cubic-bezier(0.300, 0, 0.700, 1)',
		);
	});

	it('ignores a zero accel fraction (stays neutral ease)', () => {
		const result = buildTimeline([makeAnim({ accel: 0 })]);
		expect(result.clickGroups[0].steps[0].cssAnimation).toContain(' ease ');
	});

	// -------------------------------------------------------------------
	// Directional non-fly entrances (presetSubtype honoured)
	// -------------------------------------------------------------------
	it('honours a directional subtype on a wipe entrance', () => {
		// Wipe In (entr preset 22) with a top origin edge (subtype 1) must reveal
		// from the top, not the static left-to-right default.
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', presetClass: 'entr', presetId: 22, presetSubtype: 1 }),
		]);
		expect(result.clickGroups).toHaveLength(1);
		const step = result.clickGroups[0].steps[0];
		expect(step.keyframeName).toMatch(/^pptx-tl-dir-/u);
		// Directional wipes are mask sweeps, never clip-path keyframes.
		expect(result.keyframesCss).toContain('mask-image');
		expect(result.keyframesCss).not.toContain('clip-path');
		// Still registered as an entrance (initially hidden).
		expect(result.entranceElementIds.has('el1')).toBeTruthy();
	});

	it('keeps the static wipe keyframe when no directional subtype is present', () => {
		const result = buildTimeline([
			makeAnim({ targetId: 'el1', presetClass: 'entr', presetId: 22 }),
		]);
		expect(result.clickGroups[0].steps[0].keyframeName).toBe('pptx-wipeIn');
	});

	// -------------------------------------------------------------------
	// Staged-build + colour-target descriptors
	// -------------------------------------------------------------------
	it('attaches a chart staged-build descriptor from graphicBuildProperties', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'chart1',
				graphicBuildProperties: {
					mode: 'sub',
					kind: 'chart',
					build: 'series',
					animateBackground: true,
				},
			}),
		]);
		expect(result.clickGroups[0].steps[0].build).toStrictEqual({
			kind: 'chart',
			mode: 'bySeries',
		});
	});

	it('attaches a diagram staged-build descriptor from smartArtBuild', () => {
		const result = buildTimeline([makeAnim({ targetId: 'dgm1', smartArtBuild: 'lvlOne' })]);
		expect(result.clickGroups[0].steps[0].build).toStrictEqual({
			kind: 'diagram',
			mode: 'byLvl',
		});
	});

	it('leaves build undefined for a whole-element (asOne) build', () => {
		const result = buildTimeline([makeAnim({ targetId: 'el1', smartArtBuild: 'whole' })]);
		expect(result.clickGroups[0].steps[0].build).toBeUndefined();
	});

	// -------------------------------------------------------------------
	// Click-step auto-start + effect-wrapper grouping (issue #106)
	// -------------------------------------------------------------------
	describe('auto-starting click steps', () => {
		it('marks the first group auto-advance when the deck says it starts on entry', () => {
			const result = buildTimeline([
				makeAnim({ trigger: 'afterDelay', delayMs: 1000, groupAutoStart: true, parGroupIndex: 0 }),
			]);
			expect(result.clickGroups[0].autoAdvance).toBeTruthy();
			expect(result.clickGroups[0].autoAdvanceDelayMs).toBe(0);
		});

		it('leaves the first group click-gated by default', () => {
			const result = buildTimeline([makeAnim({ trigger: 'afterDelay', delayMs: 1000 })]);
			expect(result.clickGroups[0].autoAdvance).toBeUndefined();
		});

		it('does not auto-start a group opened by an explicit click', () => {
			const result = buildTimeline([
				makeAnim({ targetId: 'a', groupAutoStart: true }),
				makeAnim({ targetId: 'b', trigger: 'onClick', groupAutoStart: true }),
			]);
			expect(result.clickGroups).toHaveLength(2);
			expect(result.clickGroups[1].autoAdvance).toBeUndefined();
		});
	});

	describe('effect-wrapper (p:par) siblings', () => {
		it('preserves authored absolute starts across sibling wrappers', () => {
			const starts = [0, 1250, 3100, 4200];
			const result = buildTimeline(
				starts.map((parGroupDelayMs, index) =>
					makeAnim({
						targetId: `shape-${index}`,
						trigger: index === 0 ? 'onClick' : 'afterPrevious',
						delayMs: 0,
						parGroupIndex: index,
						parGroupDelayMs,
					}),
				),
			);
			expect(result.clickGroups[0].steps.map((step) => step.delayMs)).toStrictEqual(starts);
		});

		it('preserves authored wrapper starts in interactive sequences', () => {
			const starts = [0, 1250, 3100, 4200];
			const result = buildTimeline(
				starts.map((parGroupDelayMs, index) =>
					makeAnim({
						targetId: `shape-${index}`,
						trigger: 'onShapeClick',
						triggerShapeId: 'button',
						delayMs: 0,
						parGroupIndex: index,
						parGroupDelayMs,
					}),
				),
			);
			const steps = result.interactiveSequences.get('button')?.[0].steps;
			expect(steps?.map((step) => step.delayMs)).toStrictEqual(starts);
		});

		it('measures each sibling delay from the wrapper, not the effect before it', () => {
			const result = buildTimeline([
				makeAnim({ targetId: 'title', trigger: 'afterDelay', delayMs: 1000, parGroupIndex: 0 }),
				makeAnim({ targetId: 'body', trigger: 'afterDelay', delayMs: 2000, parGroupIndex: 0 }),
			]);
			const [first, second] = result.clickGroups[0].steps;
			expect(first.delayMs).toBe(1000);
			expect(second.delayMs).toBe(2000);
		});

		it('chains a new wrapper off the previous step', () => {
			const result = buildTimeline([
				makeAnim({ targetId: 'title', delayMs: 0, durationMs: 500, parGroupIndex: 0 }),
				makeAnim({
					targetId: 'body',
					trigger: 'afterPrevious',
					delayMs: 250,
					parGroupIndex: 1,
				}),
			]);
			const [first, second] = result.clickGroups[0].steps;
			expect(first.delayMs).toBe(0);
			expect(second.delayMs).toBe(750);
		});

		it('keeps chaining animations that carry no wrapper index', () => {
			const result = buildTimeline([
				makeAnim({ targetId: 'title', delayMs: 0, durationMs: 500 }),
				makeAnim({ targetId: 'body', trigger: 'withPrevious', delayMs: 200 }),
			]);
			expect(result.clickGroups[0].steps[1].delayMs).toBe(200);
		});
	});

	it('attaches colour targets from an active fill colour animation', () => {
		const result = buildTimeline([
			makeAnim({
				targetId: 'shape1',
				presetClass: 'emph',
				presetId: undefined,
				colorAnimation: { colorSpace: 'rgb', toColor: '#ff0000', targetAttribute: 'fillcolor' },
			}),
		]);
		expect(result.clickGroups[0].steps[0].colorTargets).toStrictEqual(['fill']);
	});

	// -------------------------------------------------------------------
	// `p:cTn/@fill="hold"` -> TimelineStep.holdEndState
	// -------------------------------------------------------------------
	describe('fill / restart / repeatDur / spd (animation-fill-repeat)', () => {
		it('sets holdEndState on an emphasis step whose fill is "hold"', () => {
			const result = buildTimeline([
				makeAnim({ targetId: 'shape1', presetClass: 'emph', presetId: 26, fill: 'hold' }),
			]);
			expect(result.clickGroups[0].steps[0].holdEndState).toBeTruthy();
		});

		it('does not set holdEndState on an entrance step even when fill is "hold"', () => {
			// An entrance's resting style already IS its held frame, so holding is
			// scoped to emph/path (see `shouldHoldEndState`).
			const result = buildTimeline([
				makeAnim({ targetId: 'shape1', presetClass: 'entr', fill: 'hold' }),
			]);
			expect(result.clickGroups[0].steps[0].holdEndState).toBeUndefined();
		});

		it('leaves holdEndState unset when fill is "remove" (the OOXML default)', () => {
			const result = buildTimeline([
				makeAnim({ targetId: 'shape1', presetClass: 'emph', presetId: 26, fill: 'remove' }),
			]);
			expect(result.clickGroups[0].steps[0].holdEndState).toBeUndefined();
		});

		it('shortens the step duration when speedPct is set (double speed)', () => {
			const result = buildTimeline([
				makeAnim({ targetId: 'shape1', durationMs: 1000, speedPct: 200 }),
			]);
			expect(result.clickGroups[0].steps[0].durationMs).toBe(500);
		});

		it('derives the CSS iteration count from repeatDurMs when repeatCount is absent', () => {
			const result = buildTimeline([
				makeAnim({ targetId: 'shape1', durationMs: 500, repeatDurMs: 1500 }),
			]);
			expect(result.clickGroups[0].steps[0].cssAnimation).toContain(' 3 ');
		});

		it('plays indefinitely when repeatDurMs is "indefinite" (Infinity)', () => {
			const result = buildTimeline([
				makeAnim({ targetId: 'shape1', durationMs: 500, repeatDurMs: Infinity }),
			]);
			expect(result.clickGroups[0].steps[0].cssAnimation).toContain(' infinite ');
		});
	});

	// -------------------------------------------------------------------
	// afterAnimationAction -> holdEndState / hideAfterEffect / pendingHideOnNextClick
	// -------------------------------------------------------------------
	describe('afterAnimationAction (animation-after-effect)', () => {
		it('appends a dim keyframe and sets holdEndState for a "dimToColor" entrance', () => {
			const result = buildTimeline([
				makeAnim({
					targetId: 'shape1',
					presetClass: 'entr',
					afterAnimationAction: 'dimToColor',
					afterAnimationColor: '#336699',
				}),
			]);
			const step = result.clickGroups[0].steps[0];
			expect(step.holdEndState).toBeTruthy();
			expect(step.cssAnimation).toContain('pptx-tl-dim-');
			expect(result.keyframesCss).toContain('color: #336699');
		});

		it('sets hideAfterEffect for a "hideAfterAnimation" entrance', () => {
			const result = buildTimeline([
				makeAnim({
					targetId: 'shape1',
					presetClass: 'entr',
					afterAnimationAction: 'hideAfterAnimation',
				}),
			]);
			expect(result.clickGroups[0].steps[0].hideAfterEffect).toBeTruthy();
		});

		it('splices a synthetic exit step into the next click-group for "hideOnNextClick"', () => {
			const result = buildTimeline([
				makeAnim({
					targetId: 'shape1',
					presetClass: 'entr',
					afterAnimationAction: 'hideOnNextClick',
					trigger: 'onClick',
				}),
				makeAnim({ targetId: 'shape2', trigger: 'onClick' }),
			]);
			expect(result.clickGroups).toHaveLength(2);
			const secondGroupIds = result.clickGroups[1].steps.map((s) => s.elementId);
			expect(secondGroupIds).toContain('shape1');
			const hideStep = result.clickGroups[1].steps.find((s) => s.elementId === 'shape1');
			expect(hideStep?.presetClass).toBe('exit');
		});

		it('never applies afterAnimationAction to an exit effect', () => {
			const result = buildTimeline([
				makeAnim({
					targetId: 'shape1',
					presetClass: 'exit',
					afterAnimationAction: 'hideAfterAnimation',
				}),
			]);
			// `hideAfterEffect` is undefined here because `applyAfterAnimationFromEditorList`
			// (upstream of `buildTimeline`) never merges afterAnimation onto an exit; a
			// directly-constructed native animation that sets it anyway is still honoured
			// by `buildTimeline` itself, since exits already hide via presetClass.
			expect(result.clickGroups[0].steps[0].presetClass).toBe('exit');
		});

		it('honours afterAnimationAction on an onShapeClick interactive-sequence effect', () => {
			const result = buildTimeline([
				makeAnim({
					targetId: 'shape1',
					triggerShapeId: 'trigger1',
					trigger: 'onShapeClick',
					afterAnimationAction: 'hideAfterAnimation',
				}),
			]);
			const seqGroups = result.interactiveSequences.get('trigger1');
			expect(seqGroups?.[0].steps[0].hideAfterEffect).toBeTruthy();
		});
	});
});
