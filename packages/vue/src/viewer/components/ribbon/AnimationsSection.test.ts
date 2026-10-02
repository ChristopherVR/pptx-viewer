import { mount } from '@vue/test-utils';
import {
	DEFAULT_MOTION_PATH_PRESET_ID,
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
	MOTION_PATH_PRESETS,
	registerPptxWebControls,
} from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AnimationsSection from './AnimationsSection.vue';

const { playAnimationRibbonPreview } = vi.hoisted(() => ({ playAnimationRibbonPreview: vi.fn() }));

vi.mock(import('pptx-viewer-shared'), async (original) => ({
	...(await original()),
	playAnimationRibbonPreview,
}));

registerPptxWebControls();

afterEach(() => {
	vi.useRealTimers();
	playAnimationRibbonPreview.mockClear();
});

function mountAnimations(overrides: Record<string, unknown> = {}) {
	return mount(AnimationsSection, {
		attachTo: document.body,
		props: {
			canEdit: true,
			selectedElement: { id: 'e1', type: 'text' },
			isInspectorPaneOpen: false,
			onToggleInspector: () => {},
			...overrides,
		},
	});
}

function control(root: Element, id: string): HTMLButtonElement {
	return root
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}

function preset(root: Element, id: string): HTMLButtonElement {
	return root.querySelector<HTMLButtonElement>(`[data-animation-preset="${id}"]`)!;
}

/**
 * AnimationsSection: the adapter over the shared Animations view. Assertions
 * are by rendered control rather than index or class, because the defect they
 * guard is the tab silently offering fewer controls than the other bindings.
 */
describe('animationsSection', () => {
	it('offers the whole shared catalogue without needing a hover menu', () => {
		const wrapper = mountAnimations();
		const root = wrapper.element;
		for (const value of [
			...ENTRANCE_PRESET_VALUES,
			...EMPHASIS_PRESET_VALUES,
			...EXIT_PRESET_VALUES,
		]) {
			expect(root.querySelectorAll(`[data-animation-preset="${value}"]`)).toHaveLength(1);
		}
		const gallery = root.querySelector('[data-ribbon-control="animations.motionPath.gallery"]')!;
		expect(gallery.querySelectorAll('button')).toHaveLength(MOTION_PATH_PRESETS.length);
		expect(root.textContent).toContain('Entrance');
		expect(root.textContent).toContain('Emphasis');
		wrapper.unmount();
	});

	it('applies the clicked preset, path and shortcut with their own effect group', () => {
		const onAddAnimation = vi.fn();
		const wrapper = mountAnimations({ onAddAnimation });
		const root = wrapper.element;
		preset(root, 'flyIn').click();
		preset(root, 'fadeOut').click();
		preset(root, MOTION_PATH_PRESETS[0].id).click();
		control(root, 'animations.advancedAnimation.addAnimation').click();
		// "Path Animation" applies the default motion path, not an entrance.
		root.querySelectorAll('pptx-ui-ribbon-command')[2].shadowRoot!.querySelector('button')!.click();
		expect(onAddAnimation.mock.calls).toStrictEqual([
			['flyIn', 'entrance'],
			['fadeOut', 'exit'],
			[MOTION_PATH_PRESETS[0].id, 'motionPath'],
			['fadeOut', 'exit'],
			[DEFAULT_MOTION_PATH_PRESET_ID, 'motionPath'],
		]);
		wrapper.unmount();
	});

	it('opens the animation panel, preferring the dedicated callback, and removes', () => {
		const onToggleInspector = vi.fn();
		const onOpenAnimationPanel = vi.fn();
		const onRemoveAnimation = vi.fn();
		const wrapper = mountAnimations({
			onToggleInspector,
			onOpenAnimationPanel,
			onRemoveAnimation,
			isInspectorPaneOpen: true,
		});
		const root = wrapper.element;
		control(root, 'animations.advancedAnimation.remove').click();
		control(root, 'animations.animation.effectOptions').click();
		control(root, 'animations.advancedAnimation.trigger').click();
		const pane = control(root, 'animations.advancedAnimation.animationPane');
		expect(pane.getAttribute('aria-pressed')).toBe('true');
		pane.click();
		expect(onRemoveAnimation).toHaveBeenCalledOnce();
		expect(onOpenAnimationPanel).toHaveBeenCalledTimes(3);
		expect(onToggleInspector).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('names the timing fields so they are reachable by name, inert like the other bindings', () => {
		const wrapper = mountAnimations();
		const root = wrapper.element;
		const start = root.querySelector<HTMLSelectElement>('pptx-ui-select')!;
		expect(root.querySelector(`label[for="${start.id}"]`)!.textContent).toBe('Start');
		expect(start.disabled).toBeTruthy();
		expect(root.querySelector('input[aria-label="Duration"]')).toBeTruthy();
		expect(control(root, 'animations.advancedAnimation.animationPainter').disabled).toBeTruthy();
		wrapper.unmount();
	});

	it('disables the authoring commands when nothing is selected or read-only', async () => {
		const onAddAnimation = vi.fn();
		const wrapper = mountAnimations({ selectedElement: null, onAddAnimation });
		const root = wrapper.element;
		expect(preset(root, 'appear').disabled).toBeTruthy();
		for (const button of root
			.querySelector('[data-ribbon-control="animations.motionPath.gallery"]')!
			.querySelectorAll('button')) {
			expect(button.disabled).toBeTruthy();
		}
		preset(root, 'appear').click();
		expect(onAddAnimation).not.toHaveBeenCalled();
		await wrapper.setProps({ selectedElement: { id: 'e1', type: 'text' }, canEdit: false });
		expect(preset(root, 'appear').disabled).toBeTruthy();
		expect(control(root, 'animations.advancedAnimation.animationPane').disabled).toBeFalsy();
		wrapper.unmount();
	});

	/**
	 * Preview must also play the selected element's own authored effect in
	 * place, via the same shared player the other four bindings use.
	 */
	describe('preview button', () => {
		it('plays the selected element own animation and highlights briefly', async () => {
			vi.useFakeTimers();
			const wrapper = mountAnimations({
				activeSlide: {
					animations: [{ elementId: 'e1', entrance: 'fadeIn', durationMs: 500, order: 0 }],
				},
			});
			const root = wrapper.element;
			control(root, 'animations.preview.preview').click();
			expect(playAnimationRibbonPreview).toHaveBeenCalledExactlyOnceWith(
				document,
				expect.objectContaining({ elementId: 'e1' }),
			);
			await wrapper.vm.$nextTick();
			const host = root.querySelector('[data-ribbon-control="animations.preview.preview"]')!;
			expect(host.hasAttribute('active')).toBeTruthy();
			vi.advanceTimersByTime(1300);
			await wrapper.vm.$nextTick();
			expect(host.hasAttribute('active')).toBeFalsy();
			wrapper.unmount();
		});

		it('does not play a preview when disabled (no selection)', () => {
			const wrapper = mountAnimations({ selectedElement: null });
			control(wrapper.element, 'animations.preview.preview').click();
			expect(playAnimationRibbonPreview).not.toHaveBeenCalled();
			wrapper.unmount();
		});
	});
});
