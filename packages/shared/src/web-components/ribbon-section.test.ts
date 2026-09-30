// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { buildReviewRibbon } from '../render';
import { registerPptxWebControls } from './index';

registerPptxWebControls();
describe('shared keyed command sections', () => {
	it('preserves focus and controlled state across remounts and independent instances', () => {
		const first = document.createElement('pptx-ui-ribbon-section');
		const second = document.createElement('pptx-ui-ribbon-section');
		const initial = buildReviewRibbon((key) => key, { editable: true, spellCheck: false });
		first.groups = initial;
		second.groups = initial;
		document.body.append(first, second);
		const command = first.querySelector('[data-ribbon-control="review.proofing.spelling"]')!;
		const button = command.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
		button.focus();
		first.groups = buildReviewRibbon((key) => key, { editable: false, spellCheck: true });
		expect(document.activeElement).toBe(command);
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(
			second
				.querySelector('[data-ribbon-control="review.proofing.spelling"]')
				?.hasAttribute('active'),
		).toBeFalsy();
		first.remove();
		document.body.append(first);
		expect(first.querySelector('[data-ribbon-control="review.proofing.spelling"]')).toBe(command);
		first.groups = [];
		expect(first.childElementCount).toBe(0);
		first.remove();
		second.remove();
	});
});
