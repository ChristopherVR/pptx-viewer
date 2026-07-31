import type { PptxElementAnimation } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	buildAngularPreviewDescriptor,
	previewAngularAnimation,
	stopAngularAnimationPreview,
} from './animation-preview-player';

afterEach(() => {
	stopAngularAnimationPreview();
	document.body.replaceChildren();
	vi.useRealTimers();
});

describe('angular animation preview player', () => {
	it('previews the selected canvas element and restores its styles', () => {
		vi.useFakeTimers();
		const target = document.createElement('div');
		target.dataset['elementId'] = 'shape-1';
		target.style.animation = 'original 1s';
		document.body.appendChild(target);
		const animation = {
			elementId: 'shape-1',
			entrance: 'fadeIn',
			durationMs: 250,
		} as PptxElementAnimation;

		expect(previewAngularAnimation(animation)).toBeTruthy();
		expect(target.style.animation).toContain('250ms');
		vi.advanceTimersByTime(350);
		expect(target.style.animation).toBe('original 1s');
	});

	it('does not start without an effect or matching canvas element', () => {
		expect(previewAngularAnimation({ elementId: 'missing' } as PptxElementAnimation)).toBeFalsy();
		expect(
			previewAngularAnimation({ elementId: 'missing', entrance: 'fadeIn' } as PptxElementAnimation),
		).toBeFalsy();
	});
});

describe('motion path preview', () => {
	it('plays the path instead of the preset when one is applied', () => {
		const target = document.createElement('div');
		const descriptor = buildAngularPreviewDescriptor(
			{
				elementId: 'shape-1',
				entrance: 'fadeIn',
				motionPath: 'M 0 0 L 0.25 0',
				durationMs: 1200,
			} as PptxElementAnimation,
			target,
		);
		// The path travels a quarter of the fallback slide width (1280 * 0.25).
		expect(descriptor?.keyframesCss).toContain('translate(320px, 0px)');
		expect(descriptor?.cssAnimation).toContain('1200ms');
		expect(descriptor?.keyframeName).toContain('motion');
	});

	it('measures the travel against the stage, not the element box', () => {
		const stage = document.createElement('div');
		Object.defineProperty(stage, 'offsetWidth', { value: 640 });
		Object.defineProperty(stage, 'offsetHeight', { value: 360 });
		const target = document.createElement('div');
		Object.defineProperty(target, 'offsetParent', { value: stage });

		const descriptor = buildAngularPreviewDescriptor(
			{ elementId: 'shape-1', motionPath: 'M 0 0 L 0.25 0' } as PptxElementAnimation,
			target,
		);
		expect(descriptor?.keyframesCss).toContain('translate(160px, 0px)');
	});

	it('plays on the main canvas, not the slides-panel thumbnail of the same element', () => {
		vi.useFakeTimers();
		const thumbnail = document.createElement('div');
		thumbnail.dataset['elementId'] = 'shape-1';
		const viewport = document.createElement('div');
		viewport.setAttribute('data-pptx-viewport', '');
		const canvasEl = document.createElement('div');
		canvasEl.dataset['elementId'] = 'shape-1';
		viewport.append(canvasEl);
		// Thumbnail first, exactly as the slides panel renders it.
		document.body.append(thumbnail, viewport);

		expect(
			previewAngularAnimation({
				elementId: 'shape-1',
				motionPath: 'M 0 0 L 0.25 0',
			} as PptxElementAnimation),
		).toBeTruthy();
		expect(canvasEl.style.animation).toContain('pptx-motion-preview');
		expect(thumbnail.style.animation).toBe('');
	});

	it('falls back to the preset buckets when no path is applied', () => {
		const descriptor = buildAngularPreviewDescriptor(
			{ elementId: 'shape-1', entrance: 'fadeIn', durationMs: 250 } as PptxElementAnimation,
			document.createElement('div'),
		);
		expect(descriptor?.cssAnimation).toContain('250ms');
		expect(descriptor?.keyframeName).not.toContain('motion');
	});
});
