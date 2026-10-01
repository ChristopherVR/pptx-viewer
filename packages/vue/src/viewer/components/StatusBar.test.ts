import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import StatusBar from './StatusBar.vue';

/**
 * The Vue StatusBar is an adapter over the shared `pptx-ui-status-bar`: these
 * tests cover state mapping and intent routing, the view itself is covered in
 * `pptx-viewer-shared`.
 */
describe('statusBar adapter', () => {
	const base = { slideCount: 7, activeSlideIndex: 0, isDirty: false, scale: 1 };
	const open = (props: Record<string, unknown> = {}, slots?: Record<string, () => unknown>) => {
		const wrapper = mount(StatusBar, { props: { ...base, ...props }, slots: slots as never });
		const root = wrapper.get('pptx-ui-status-bar').element.shadowRoot!;
		const button = (name: string) =>
			root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
		return { wrapper, root, button, text: () => root.textContent ?? '' };
	};

	it('renders the slide counter and an empty deck', () => {
		expect(open().root.querySelector('.counter')!.textContent).toBe('Slide 1 of 7');
		expect(open({ slideCount: 0 }).root.querySelector('.counter')!.textContent).toBe('No slides');
	});

	it('reflects autosave + dirty state', () => {
		expect(open().text()).toContain('All saved');
		expect(open({ isDirty: true }).text()).toContain('Unsaved changes');
		expect(open({ autosaveStatus: 'saving' }).text()).toContain('Saving');
		expect(open({ autosaveStatus: 'error' }).root.querySelector('.save')!.className).toContain(
			'error',
		);
		expect(open({ autosaveStatus: 'saved', lastSavedAt: Date.now() }).text()).toContain('just now');
	});

	it('renders the zoom percentage and emits zoom events', () => {
		const { wrapper, button, text } = open({ scale: 1.25 });
		expect(text()).toContain('125%');
		button('Zoom in').click();
		button('Zoom out').click();
		button('Zoom to fit').click();
		expect(wrapper.emitted('zoom-in')).toHaveLength(1);
		expect(wrapper.emitted('zoom-out')).toHaveLength(1);
		expect(wrapper.emitted('zoom-to-fit')).toHaveLength(1);
	});

	it('emits set-mode, notes and sorter intents', () => {
		const { wrapper, button } = open({ showNotes: true });
		button('Slide show').click();
		button('Normal view').click();
		button('Toggle notes').click();
		button('Slide sorter').click();
		expect(wrapper.emitted('set-mode')).toStrictEqual([['present'], ['edit']]);
		expect(wrapper.emitted('toggle-notes')).toHaveLength(1);
		expect(wrapper.emitted('toggle-slide-sorter')).toHaveLength(1);
	});

	it('reflects pressed state from mode and notes', () => {
		const { button } = open({ showNotes: true, isNotesExpanded: true, mode: 'present' });
		expect(button('Toggle notes').getAttribute('aria-pressed')).toBe('true');
		expect(button('Normal view').getAttribute('aria-pressed')).toBe('false');
		expect(button('Slide show').getAttribute('aria-pressed')).toBe('true');
	});

	it('only shows the Notes toggle when enabled and not hidden', () => {
		expect(open().button('Toggle notes').hidden).toBeTruthy();
		expect(open({ showNotes: true }).button('Toggle notes').hidden).toBeFalsy();
		expect(
			open({ showNotes: true, hiddenActions: ['notes'] }).button('Toggle notes').hidden,
		).toBeTruthy();
	});

	it('hides the zoom cluster and the Slide Show button through hiddenActions', () => {
		const zoomHidden = open({ hiddenActions: ['zoom'] });
		expect(zoomHidden.button('Zoom in').closest('.group')).toHaveProperty('hidden', true);
		const showHidden = open({ hiddenActions: ['fullscreen'] });
		expect(showHidden.button('Slide show').hidden).toBeTruthy();
		expect(showHidden.button('Normal view').hidden).toBeFalsy();
	});

	it('projects the collaboration slot', () => {
		const { wrapper } = open({}, { collaboration: () => h('span', { id: 'collab' }, 'live') });
		expect(wrapper.find('[slot="collaboration"] #collab').exists()).toBeTruthy();
	});
});
