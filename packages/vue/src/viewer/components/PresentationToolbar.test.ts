import { mount } from '@vue/test-utils';
import { PRESENT_TOOLBAR_ORDER } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import type { PresentationTool } from '../composables/usePresentationAnnotations';
import PresentationToolbar from './PresentationToolbar.vue';

function mountToolbar(props: Partial<Record<string, unknown>> = {}) {
	return mount(PresentationToolbar, {
		props: {
			presentationTool: 'none' as PresentationTool,
			penColor: '#ff0000',
			highlighterColor: '#ffff00',
			hasAnnotations: false,
			currentSlideIndex: 1,
			totalSlides: 5,
			presentationStartTime: null,
			...props,
		},
	});
}

type Wrapper = ReturnType<typeof mountToolbar>;

/** The toolbar renders inside the shared element's open shadow root. */
const shadow = (wrapper: Wrapper): ShadowRoot => (wrapper.element as HTMLElement).shadowRoot!;
const control = (wrapper: Wrapper, id: string): HTMLButtonElement | null =>
	shadow(wrapper).querySelector<HTMLButtonElement>(`[data-pptx-present-control="${id}"]`);
const byName = (wrapper: Wrapper, name: string): HTMLButtonElement | null =>
	shadow(wrapper).querySelector<HTMLButtonElement>(`[aria-label="${name}"]`);

describe('presentationToolbar', () => {
	it('renders the slide counter (one-based)', () => {
		expect(control(mountToolbar(), 'counter')?.textContent).toBe('2 / 5');
	});

	// The bar drifted from React once already (its own i18n namespace for half
	// the labels, an 18px colour caret, no ticking timer). Pinning the shared
	// inventory here is what makes a repeat show up as a unit-test failure.
	it('renders the shared control inventory in order', () => {
		const wrapper = mountToolbar({ showPresenterToggle: true });
		const ids = [...shadow(wrapper).querySelectorAll('[data-pptx-present-control]')].map(
			(node) => (node as HTMLElement).dataset.pptxPresentControl,
		);
		expect(ids).toStrictEqual([...PRESENT_TOOLBAR_ORDER]);
	});

	it('is the toolbar landmark and names its controls exactly as React does', () => {
		const wrapper = mountToolbar({ showPresenterToggle: true });
		expect(wrapper.element.getAttribute('role')).toBe('toolbar');
		expect(wrapper.element.hasAttribute('data-pptx-present-toolbar')).toBeTruthy();
		const nameOf = (id: string): string | null | undefined =>
			control(wrapper, id)?.getAttribute('aria-label');
		expect(nameOf('previous')).toBe('Previous Slide');
		expect(nameOf('next')).toBe('Next Slide');
		expect(nameOf('clear')).toBe('Clear Annotations');
		expect(nameOf('presenter-view')).toBe('Presenter View');
		expect(nameOf('end')).toBe('End Presentation');
	});

	// The bar mounts before its host records the start time, so a mount-only
	// interval left the readout showing a negative elapsed ("-1:-1") forever.
	it('never shows a negative elapsed time when the show starts after mount', async () => {
		const wrapper = mountToolbar({ presentationStartTime: null });
		expect(control(wrapper, 'timer')?.textContent).toBe('00:00');
		await wrapper.setProps({ presentationStartTime: Date.now() + 500 });
		expect(control(wrapper, 'timer')?.textContent).toBe('00:00');
	});

	it('emits move on nav buttons and end-presentation', () => {
		const wrapper = mountToolbar();
		// "prev" is enabled when not on slide 0.
		control(wrapper, 'previous')?.click();
		expect(wrapper.emitted('move')?.[0]).toStrictEqual([-1]);

		control(wrapper, 'end')?.click();
		expect(wrapper.emitted('end-presentation')).toHaveLength(1);
	});

	it('emits set-tool when an annotation tool is clicked', () => {
		const wrapper = mountToolbar();
		byName(wrapper, 'Laser Pointer')?.click();
		expect(wrapper.emitted('set-tool')?.[0]).toStrictEqual(['laser']);
	});

	it('marks the active tool', () => {
		const wrapper = mountToolbar({ presentationTool: 'pen' });
		expect(byName(wrapper, 'Pen')?.getAttribute('aria-pressed')).toBe('true');
	});

	it('opens the pen colour palette and emits set-pen-color, arming the pen', () => {
		const wrapper = mountToolbar();
		byName(wrapper, 'Pen colour')?.click();
		const swatches = shadow(wrapper).querySelectorAll<HTMLButtonElement>('button.swatch');
		expect(swatches).toHaveLength(16);
		shadow(wrapper)
			.querySelector<HTMLButtonElement>('button[aria-label="Pen colour #0000ff"]')
			?.click();
		expect(wrapper.emitted('set-pen-color')?.[0]).toStrictEqual(['#0000ff']);
		expect(wrapper.emitted('set-tool')?.[0]).toStrictEqual(['pen']);
	});

	it('disables clear-all when there are no annotations', () => {
		const wrapper = mountToolbar({ hasAnnotations: false });
		const clear = byName(wrapper, 'Clear Annotations');
		expect(clear?.disabled).toBeTruthy();
		clear?.click();
		expect(wrapper.emitted('clear-annotations')).toBeUndefined();
	});

	it('emits clear-annotations when enabled', () => {
		const wrapper = mountToolbar({ hasAnnotations: true });
		byName(wrapper, 'Clear Annotations')?.click();
		expect(wrapper.emitted('clear-annotations')).toHaveLength(1);
	});

	it('shows the presenter-view toggle only when enabled', () => {
		expect(byName(mountToolbar({ showPresenterToggle: false }), 'Presenter View')).toBeNull();

		const wrapper = mountToolbar({ showPresenterToggle: true });
		byName(wrapper, 'Presenter View')?.click();
		expect(wrapper.emitted('toggle-presenter-view')).toHaveLength(1);
	});

	// One click on the Blackboard control must arm the black screen and the pen
	// together; the toolbar itself only reports the click, the host resolves it
	// through the shared `toggleBlackboard` transition.
	it('renders the blackboard toggle and emits toggle-blackboard on click', () => {
		const wrapper = mountToolbar();
		const blackboard = control(wrapper, 'blackboard');
		expect(blackboard).not.toBeNull();
		expect(blackboard?.getAttribute('aria-label')).toBe('Blackboard');
		blackboard?.click();
		expect(wrapper.emitted('toggle-blackboard')).toHaveLength(1);
	});

	it('marks blackboard active only when blackout AND pen are armed together', () => {
		const pressed = (props: Partial<Record<string, unknown>>): string | null | undefined =>
			control(mountToolbar(props), 'blackboard')?.getAttribute('aria-pressed');
		expect(pressed({ blackout: 'black', presentationTool: 'pen' })).toBe('true');
		expect(pressed({ blackout: 'none', presentationTool: 'pen' })).toBe('false');
		expect(pressed({ blackout: 'black', presentationTool: 'eraser' })).toBe('false');
	});

	it('disables prev on the first slide and next on the last', () => {
		expect(
			control(mountToolbar({ currentSlideIndex: 0, totalSlides: 3 }), 'previous')?.disabled,
		).toBeTruthy();
		expect(
			control(mountToolbar({ currentSlideIndex: 2, totalSlides: 3 }), 'next')?.disabled,
		).toBeTruthy();
	});
});
