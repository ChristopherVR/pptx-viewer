import type { PptxSlideTransition } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createTransitionPreview } from './transition-preview';

function transition(overrides: Partial<PptxSlideTransition> = {}): PptxSlideTransition {
	return { type: 'fade', durationMs: 500, ...overrides } as PptxSlideTransition;
}

describe('transition preview', () => {
	it('shows the stage for a real transition', () => {
		const preview = createTransitionPreview(document, createTranslator());
		preview.update(transition());
		expect(preview.el.hidden).toBeFalsy();
		expect(preview.el.querySelector('button')).toBeTruthy();
	});

	it('hides for "none", "cut", or no transition', () => {
		const preview = createTransitionPreview(document, createTranslator());
		preview.update(transition({ type: 'none' }));
		expect(preview.el.hidden).toBeTruthy();
		preview.update(transition({ type: 'cut' }));
		expect(preview.el.hidden).toBeTruthy();
		preview.update(undefined);
		expect(preview.el.hidden).toBeTruthy();
	});

	it('applies an animation to the layers on click', () => {
		const preview = createTransitionPreview(document, createTranslator());
		preview.update(transition());
		const stage = preview.el.querySelector<HTMLButtonElement>('.pptxv-transition-preview-stage');
		if (!stage) {
			throw new Error('stage not found');
		}
		stage.click();
		const incoming = preview.el.querySelector<HTMLElement>('.is-incoming');
		expect(incoming?.style.animation).not.toBe('');
	});

	it('injects the shared slide-transition keyframes once', () => {
		createTransitionPreview(document, createTranslator());
		createTransitionPreview(document, createTranslator());
		const styles = document.querySelectorAll('#pptx-vanilla-presentation-keyframes');
		expect(styles).toHaveLength(1);
	});
});
