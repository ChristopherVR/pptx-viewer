import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createPresentationTouchControls } from './presentation-touch-controls';

describe('createPresentationTouchControls', () => {
	it('updates navigation boundaries and the live counter', () => {
		const controls = createPresentationTouchControls(document, createTranslator('en'), {
			previous: vi.fn(),
			next: vi.fn(),
			exit: vi.fn(),
		});
		controls.update(0, 2);

		expect(
			controls.el.querySelector<HTMLButtonElement>('.pptxv-presentation-touch-prev')?.disabled,
		).toBeTruthy();
		expect(
			controls.el.querySelector<HTMLButtonElement>('.pptxv-presentation-touch-next')?.disabled,
		).toBeFalsy();
		expect(controls.el.querySelector('.pptxv-presentation-touch-counter')?.textContent).toBe(
			'1 / 2',
		);
	});

	it('routes every touch action and stops click bubbling', () => {
		const handlers = { previous: vi.fn(), next: vi.fn(), exit: vi.fn() };
		const controls = createPresentationTouchControls(document, createTranslator('en'), handlers);
		const bubbled = vi.fn();
		controls.el.addEventListener('click', bubbled);
		controls.update(1, 3);

		controls.el.querySelector<HTMLButtonElement>('.pptxv-presentation-touch-prev')?.click();
		controls.el.querySelector<HTMLButtonElement>('.pptxv-presentation-touch-next')?.click();
		controls.el.querySelector<HTMLButtonElement>('.pptxv-presentation-touch-exit')?.click();

		expect(handlers.previous).toHaveBeenCalledOnce();
		expect(handlers.next).toHaveBeenCalledOnce();
		expect(handlers.exit).toHaveBeenCalledOnce();
		expect(bubbled).not.toHaveBeenCalled();
	});

	describe('hiddenActions', () => {
		it('omitting hiddenActions renders the prev/next pair (backward compatible default)', () => {
			const controls = createPresentationTouchControls(document, createTranslator('en'), {
				previous: vi.fn(),
				next: vi.fn(),
				exit: vi.fn(),
			});
			expect(controls.el.querySelector('.pptxv-presentation-touch-prev')).not.toBeNull();
			expect(controls.el.querySelector('.pptxv-presentation-touch-next')).not.toBeNull();
		});

		it("hides the prev/next pair as a unit on 'navigation', keeping exit always available", () => {
			const controls = createPresentationTouchControls(
				document,
				createTranslator('en'),
				{ previous: vi.fn(), next: vi.fn(), exit: vi.fn() },
				['navigation'],
			);
			expect(controls.el.querySelector('.pptxv-presentation-touch-prev')).toBeNull();
			expect(controls.el.querySelector('.pptxv-presentation-touch-next')).toBeNull();
			expect(controls.el.querySelector('.pptxv-presentation-touch-exit')).not.toBeNull();
		});
	});
});
