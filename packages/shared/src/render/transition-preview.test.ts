// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
	findSlideStage,
	playSlideTransitionPreview,
	TRANSITION_PREVIEW_ATTR,
} from './transition-preview';

/** A stage shaped like the editing canvas: one slide region with two elements. */
function mountStage(): HTMLElement {
	document.body.innerHTML = `
		<div data-pptx-viewport>
			<div role="region" aria-roledescription="slide" style="position:relative">
				<div data-element-id="a" data-pptx-element="true">A</div>
				<div data-element-id="b" data-pptx-element="true">B</div>
			</div>
			<div aria-roledescription="slide" data-thumbnail="true"></div>
		</div>
	`;
	const stage = document.querySelector<HTMLElement>('[aria-roledescription="slide"]');
	if (!stage) {
		throw new Error('stage did not mount');
	}
	return stage;
}

describe('findSlideStage', () => {
	it('answers the main canvas rather than a thumbnail', () => {
		const stage = mountStage();
		expect(findSlideStage(document)).toBe(stage);
		expect(findSlideStage(document)?.getAttribute('data-thumbnail')).toBeNull();
	});
});

describe('playSlideTransitionPreview', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('marks the stage and layers the replay over it', () => {
		const stage = mountStage();

		expect(playSlideTransitionPreview({ type: 'push', durationMs: 800 }, document)).toBeTruthy();

		expect(stage.getAttribute(TRANSITION_PREVIEW_ATTR)).toBe('push');
		const layers = stage.querySelectorAll('.pptx-transition-preview-layer');
		expect(layers).toHaveLength(2);
		// The animated layer carries the same CSS the presentation overlay plays.
		expect((layers[1] as HTMLElement).style.animation).not.toBe('');
	});

	it('does not double the slide element count while it plays', () => {
		mountStage();
		playSlideTransitionPreview({ type: 'fade', durationMs: 600 }, document);

		expect(document.querySelectorAll('[data-element-id]')).toHaveLength(2);
		expect(document.querySelectorAll('[data-pptx-element]')).toHaveLength(2);
	});

	it('leaves nothing behind once the animation ends', () => {
		const stage = mountStage();
		playSlideTransitionPreview({ type: 'wipe', durationMs: 500 }, document);

		const incoming = stage.querySelectorAll('.pptx-transition-preview-layer')[1];
		incoming.dispatchEvent(new Event('animationend'));

		expect(stage.hasAttribute(TRANSITION_PREVIEW_ATTR)).toBeFalsy();
		expect(stage.querySelectorAll('.pptx-transition-preview-layer')).toHaveLength(0);
	});

	it('reports false for a slide with nothing to replay', () => {
		mountStage();
		expect(playSlideTransitionPreview(undefined, document)).toBeFalsy();
		expect(playSlideTransitionPreview({ type: 'none' }, document)).toBeFalsy();
		// `cut` is instant: there is no animation to watch.
		expect(playSlideTransitionPreview({ type: 'cut', durationMs: 700 }, document)).toBeFalsy();
	});

	it('reports false when no stage is mounted', () => {
		document.body.innerHTML = '<div></div>';
		expect(playSlideTransitionPreview({ type: 'fade', durationMs: 700 }, document)).toBeFalsy();
	});

	it('replaces a preview that is already running', () => {
		const stage = mountStage();
		playSlideTransitionPreview({ type: 'fade', durationMs: 700 }, document);
		playSlideTransitionPreview({ type: 'wipe', durationMs: 700 }, document);

		expect(stage.getAttribute(TRANSITION_PREVIEW_ATTR)).toBe('wipe');
		expect(stage.querySelectorAll('.pptx-transition-preview-layer')).toHaveLength(2);
	});
});
