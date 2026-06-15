import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { ANIMATION_KEYFRAMES_CSS, initialHiddenStyle, resolveAnimationCss } from './animation-css';

function anim(overrides: Partial<PptxElementAnimation> = {}): PptxElementAnimation {
	return { elementId: 'e1', ...overrides };
}

describe('resolveAnimationCss', () => {
	it('maps a fade entrance to the fade keyframe and duration', () => {
		const result = resolveAnimationCss(anim({ entrance: 'fadeIn', durationMs: 600 }));
		expect(result).toBeDefined();
		expect(result!.animationName).toBe('pptx-vue-fadeIn');
		expect(result!.kind).toBe('entrance');
		expect(result!.style['animation-name']).toBe('pptx-vue-fadeIn');
		expect(result!.style['animation-duration']).toBe('600ms');
		expect(result!.style['animation-fill-mode']).toBe('forwards');
		// The referenced keyframe must exist in the injected CSS.
		expect(ANIMATION_KEYFRAMES_CSS).toContain('@keyframes pptx-vue-fadeIn');
	});

	it('uses the default duration when none is given', () => {
		const result = resolveAnimationCss(anim({ entrance: 'flyIn' }));
		expect(result!.style['animation-duration']).toBe('500ms');
		expect(result!.animationName).toBe('pptx-vue-flyIn');
	});

	it('maps an exit preset to the matching exit keyframe', () => {
		const result = resolveAnimationCss(anim({ exit: 'zoomOut', durationMs: 400 }));
		expect(result!.kind).toBe('exit');
		expect(result!.animationName).toBe('pptx-vue-zoomOut');
		expect(result!.style['animation-fill-mode']).toBe('forwards');
	});

	it('maps an emphasis preset to the matching keyframe with no fill', () => {
		const result = resolveAnimationCss(anim({ emphasis: 'pulse' }));
		expect(result!.kind).toBe('emphasis');
		expect(result!.animationName).toBe('pptx-vue-pulse');
		expect(result!.style['animation-fill-mode']).toBe('none');
		expect(result!.style['animation-duration']).toBe('1000ms');
	});

	it('falls back to fade for an unknown entrance preset', () => {
		// Cast through a known field with an unmapped (but valid-union) preset.
		const result = resolveAnimationCss(anim({ entrance: 'boomerangIn' as never }));
		expect(result!.animationName).toBe('pptx-vue-fadeIn');
	});

	it('prefers entrance over emphasis over exit', () => {
		const result = resolveAnimationCss(
			anim({ entrance: 'zoomIn', emphasis: 'spin', exit: 'fadeOut' }),
		);
		expect(result!.kind).toBe('entrance');
		expect(result!.animationName).toBe('pptx-vue-zoomIn');
	});

	it('treats "none" presets as absent', () => {
		expect(resolveAnimationCss(anim({ entrance: 'none' }))).toBeUndefined();
		expect(resolveAnimationCss(anim({ entrance: 'none', emphasis: 'spin' }))!.kind).toBe(
			'emphasis',
		);
	});

	it('honours timing curve and infinite repeat', () => {
		const result = resolveAnimationCss(
			anim({ emphasis: 'spin', timingCurve: 'linear', repeatCount: Infinity }),
		);
		expect(result!.style['animation-timing-function']).toBe('linear');
		expect(result!.style['animation-iteration-count']).toBe('infinite');
	});

	it('returns undefined when there is no effect', () => {
		expect(resolveAnimationCss(anim())).toBeUndefined();
	});
});

describe('initialHiddenStyle', () => {
	it('hides elements with a pending entrance', () => {
		expect(initialHiddenStyle(anim({ entrance: 'fadeIn' }))).toStrictEqual({ opacity: '0' });
	});

	it('does not hide emphasis/exit-only elements', () => {
		expect(initialHiddenStyle(anim({ emphasis: 'pulse' }))).toStrictEqual({});
		expect(initialHiddenStyle(anim({ exit: 'fadeOut' }))).toStrictEqual({});
	});
});

describe('aNIMATION_KEYFRAMES_CSS', () => {
	it('contains the common entrance/emphasis/exit keyframes', () => {
		for (const name of ['fadeIn', 'flyIn', 'wipeIn', 'zoomIn', 'floatIn', 'splitIn', 'appear']) {
			expect(ANIMATION_KEYFRAMES_CSS).toContain(`@keyframes pptx-vue-${name}`);
		}
		for (const name of ['pulse', 'spin', 'growShrink']) {
			expect(ANIMATION_KEYFRAMES_CSS).toContain(`@keyframes pptx-vue-${name}`);
		}
		for (const name of ['fadeOut', 'flyOut', 'zoomOut']) {
			expect(ANIMATION_KEYFRAMES_CSS).toContain(`@keyframes pptx-vue-${name}`);
		}
	});
});
