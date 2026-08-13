import { mount } from '@vue/test-utils';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { TRANSITION_PREVIEW_ATTR } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import TransitionsSection from './TransitionsSection.vue';

/**
 * The defect these cover is not "a control is missing" (`ribbon-control-
 * inventory.spec.ts` already proves presence): it is that every control was a
 * local `ref` and nothing reached the deck, so Vue could not author a slide
 * transition from anywhere in the product. They assert EFFECT.
 */
function slideWith(transition?: PptxSlideTransition): PptxSlide {
	return { id: 's1', elements: [], transition } as unknown as PptxSlide;
}

function mountTab(activeSlide?: PptxSlide) {
	const onTransitionChange = vi.fn<(updates: Partial<PptxSlideTransition>) => void>();
	const onApplyTransitionToAll = vi.fn<() => void>();
	const wrapper = mount(TransitionsSection, {
		props: {
			isInspectorPaneOpen: false,
			onToggleInspector: () => {},
			activeSlide,
			onTransitionChange,
			onApplyTransitionToAll,
		},
		global: { mocks: { $t: (key: string) => key } },
	});
	return { wrapper, onTransitionChange, onApplyTransitionToAll };
}

function presetButton(wrapper: ReturnType<typeof mountTab>['wrapper'], label: string) {
	return wrapper.findAll('button').find((button) => button.text() === label);
}

describe('transitionsSection commits to the deck', () => {
	it('writes the picked preset onto the slide', async () => {
		const { wrapper, onTransitionChange } = mountTab(slideWith());
		await presetButton(wrapper, 'Push')?.trigger('click');
		expect(onTransitionChange).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'push', durationMs: 700, advanceOnClick: true }),
		);
	});

	it('writes an edited duration', async () => {
		const { wrapper, onTransitionChange } = mountTab(slideWith({ type: 'fade' }));
		const duration = wrapper.find('input[type="number"]');
		await duration.setValue('1.5');
		expect(onTransitionChange).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'fade', durationMs: 1500 }),
		);
	});

	it('writes the On Mouse Click gate', async () => {
		const { wrapper, onTransitionChange } = mountTab(slideWith({ type: 'fade' }));
		const [onClick] = wrapper.findAll('input[type="checkbox"]');
		await onClick.setValue(false);
		expect(onTransitionChange).toHaveBeenCalledWith(
			expect.objectContaining({ advanceOnClick: false }),
		);
	});

	it('writes a timed advance from the After field', async () => {
		const { wrapper, onTransitionChange } = mountTab(
			slideWith({ type: 'fade', advanceAfterMs: 1000 }),
		);
		const after = wrapper.find('input[type="text"]');
		await after.setValue('00:03.00');
		expect(onTransitionChange).toHaveBeenCalledWith(
			expect.objectContaining({ advanceAfterMs: 3000 }),
		);
	});

	it('replays the transition on the stage from Preview, without editing the deck', async () => {
		const { wrapper, onTransitionChange } = mountTab(slideWith({ type: 'push', durationMs: 800 }));
		const stage = document.createElement('div');
		stage.setAttribute('aria-roledescription', 'slide');
		document.body.appendChild(stage);

		await wrapper
			.findAll('button')
			.find((button) => button.text().includes('Preview'))
			?.trigger('click');

		expect(stage.getAttribute(TRANSITION_PREVIEW_ATTR)).toBe('push');
		// Preview used to re-commit the slide's own transition: an edit nobody
		// could see, and one no assertion could tell apart from a dead button.
		expect(onTransitionChange).not.toHaveBeenCalled();
		stage.remove();
	});

	it('has a working Apply to All', async () => {
		const { wrapper, onApplyTransitionToAll } = mountTab(slideWith({ type: 'fade' }));
		const applyToAll = wrapper.findAll('button').find((b) => b.text().includes('Apply to All'));
		await applyToAll?.trigger('click');
		expect(onApplyTransitionToAll).toHaveBeenCalledOnce();
	});
});

describe('transitionsSection reads the deck', () => {
	it('shows the slide duration rather than a hard-coded default', () => {
		const { wrapper } = mountTab(slideWith({ type: 'fade', durationMs: 1500 }));
		expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('1.5');
	});

	it('shows a stored timed advance', () => {
		const { wrapper } = mountTab(slideWith({ type: 'fade', advanceAfterMs: 3000 }));
		expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('00:03.00');
	});

	it('disables the Sound select, which nothing can author', () => {
		const { wrapper } = mountTab(slideWith());
		expect(wrapper.find('select').attributes('disabled')).toBeDefined();
	});
});
