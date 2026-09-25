// @vitest-environment jsdom
import type { PptxElementAnimation } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import {
	buildAnimationRibbonPreview,
	playAnimationRibbonPreview,
} from './animation-ribbon-preview';
import { motionPathPresetById } from './motion-path-presets';

const LINE_RIGHT = motionPathPresetById('lineRight')?.path ?? '';

function mountTarget(id: string): HTMLElement {
	const el = document.createElement('div');
	el.setAttribute('data-element-id', id);
	document.body.appendChild(el);
	return el;
}

afterEach(() => {
	document.body.replaceChildren();
	for (const style of [...document.querySelectorAll('style[id^="pptx-anim-ribbon-preview-"]')]) {
		style.remove();
	}
});

describe('buildAnimationRibbonPreview', () => {
	it('plays the motion path in preference to the preset buckets', () => {
		const target = mountTarget('el1');
		const animation: PptxElementAnimation = {
			elementId: 'el1',
			entrance: 'fadeIn',
			motionPath: LINE_RIGHT,
			durationMs: 1500,
			delayMs: 250,
			order: 0,
		};
		const descriptor = buildAnimationRibbonPreview(animation, target);
		// A fade would hide the very travel the author is looking at.
		expect(descriptor?.keyframeName).toContain('motion');
		expect(descriptor?.keyframesCss).toContain('translate(');
		expect(descriptor?.cssAnimation).toContain('1500ms');
		expect(descriptor?.cssAnimation).toContain('250ms');
	});

	it('falls back to the preset descriptor without a path', () => {
		const target = mountTarget('el1');
		const descriptor = buildAnimationRibbonPreview(
			{ elementId: 'el1', entrance: 'fadeIn', durationMs: 400, order: 0 },
			target,
		);
		expect(descriptor?.keyframeName).not.toContain('motion');
		expect(descriptor?.cssAnimation).toContain('400ms');
	});

	it('has nothing to play for an entry with neither a path nor a preset', () => {
		const target = mountTarget('el1');
		expect(buildAnimationRibbonPreview({ elementId: 'el1', order: 0 }, target)).toBeUndefined();
	});

	it('falls back to the emphasis preset, then the exit preset, in order', () => {
		const target = mountTarget('el1');
		const emphasis = buildAnimationRibbonPreview(
			{ elementId: 'el1', emphasis: 'pulse', durationMs: 300, order: 0 },
			target,
		);
		expect(emphasis).toBeDefined();
		const exit = buildAnimationRibbonPreview(
			{ elementId: 'el1', exit: 'fadeOut', durationMs: 300, order: 0 },
			target,
		);
		expect(exit).toBeDefined();
	});
});

describe('playAnimationRibbonPreview', () => {
	it('injects the motion keyframes and drives the element on the canvas', () => {
		const target = mountTarget('el1');
		playAnimationRibbonPreview(document, {
			elementId: 'el1',
			motionPath: LINE_RIGHT,
			durationMs: 800,
			order: 0,
		});
		const style = document.querySelector(
			'style[id^="pptx-anim-ribbon-preview-pptx-motion-preview"]',
		);
		expect(style?.textContent).toContain('@keyframes');
		expect(target.style.animation).toContain('800ms');
	});

	it('replaces stale keyframes so a second path does not replay the first', () => {
		mountTarget('el1');
		const base = { elementId: 'el1', durationMs: 800, order: 0 } as const;
		playAnimationRibbonPreview(document, { ...base, motionPath: LINE_RIGHT });
		playAnimationRibbonPreview(document, { ...base, motionPath: 'M 0 0 L 0 -0.5' });
		const styles = [...document.querySelectorAll('style[id^="pptx-anim-ribbon-preview-"]')];
		expect(styles).toHaveLength(1);
		// 0.5 of the 720px fallback slide height, upwards.
		expect(styles[0].textContent).toContain('-360px');
	});

	it('does nothing when the element is not on the canvas', () => {
		expect(() =>
			playAnimationRibbonPreview(document, {
				elementId: 'missing',
				motionPath: LINE_RIGHT,
				order: 0,
			}),
		).not.toThrow();
		expect(document.querySelector('style[id^="pptx-anim-ribbon-preview-"]')).toBeNull();
	});

	it('does nothing when there is no animation to preview', () => {
		expect(() => playAnimationRibbonPreview(document, undefined)).not.toThrow();
	});
});
