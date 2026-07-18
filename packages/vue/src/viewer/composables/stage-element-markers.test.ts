import { describe, expect, it } from 'vitest';

import { stripElementIdMarkers } from './stage-element-markers';

function buildStage(): HTMLElement {
	const stage = document.createElement('div');
	stage.innerHTML = [
		'<div data-element-id="a"><span>A</span></div>',
		'<div data-element-id="b" data-pptx-element="true">B</div>',
		'<div class="plain">C</div>',
	].join('');
	return stage;
}

describe('stripElementIdMarkers', () => {
	it('removes every data-element-id under the stage and reports the count', () => {
		const stage = buildStage();
		const removed = stripElementIdMarkers(stage);
		expect(removed).toBe(2);
		expect(stage.querySelectorAll('[data-element-id]')).toHaveLength(0);
		// Content and unrelated attributes are untouched.
		expect(stage.textContent).toBe('ABC');
		expect(stage.querySelector('[data-pptx-element]')).not.toBeNull();
	});

	it('is a no-op on a stage without markers', () => {
		const stage = document.createElement('div');
		stage.innerHTML = '<div class="plain">X</div>';
		expect(stripElementIdMarkers(stage)).toBe(0);
		expect(stage.textContent).toBe('X');
	});
});
