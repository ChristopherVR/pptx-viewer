import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import TitleBar from './TitleBar.vue';

function mountTitleBar(props: Partial<Record<string, unknown>> = {}) {
	return mount(TitleBar, {
		props: {
			mode: 'edit',
			canEdit: true,
			isDirty: false,
			autosaveEnabled: true,
			onToggleAutosave: () => {},
			canUndo: false,
			canRedo: false,
			onUndo: () => {},
			onRedo: () => {},
			findReplaceOpen: false,
			onToggleFindReplace: () => {},
			...props,
		},
	});
}

describe('titleBar', () => {
	it('renders the AutoSave switch checked and the On label when enabled', () => {
		const wrapper = mountTitleBar({ autosaveEnabled: true });
		const toggle = wrapper.get('button[role="switch"]');
		expect(toggle.attributes('aria-checked')).toBe('true');
		expect(wrapper.text()).toContain('On');
	});

	it('renders the switch unchecked and the Off label when disabled', () => {
		const wrapper = mountTitleBar({ autosaveEnabled: false });
		expect(wrapper.get('button[role="switch"]').attributes('aria-checked')).toBe('false');
		expect(wrapper.text()).toContain('Off');
	});

	it('invokes the toggle handler when the switch is clicked', async () => {
		const onToggleAutosave = vi.fn();
		const wrapper = mountTitleBar({ onToggleAutosave });
		await wrapper.get('button[role="switch"]').trigger('click');
		expect(onToggleAutosave).toHaveBeenCalledOnce();
	});

	it('falls back to the default file name when none is supplied', () => {
		const wrapper = mountTitleBar({ fileName: undefined });
		expect(wrapper.text()).toContain('Presentation');
	});

	it('shows the host-supplied file name', () => {
		const wrapper = mountTitleBar({ fileName: 'Quarterly.pptx' });
		expect(wrapper.text()).toContain('Quarterly.pptx');
	});

	it('disables undo and redo when they cannot run', () => {
		const wrapper = mountTitleBar({ canUndo: false, canRedo: false });
		expect(wrapper.get('button[aria-label="Undo"]').attributes('disabled')).toBeDefined();
		expect(wrapper.get('button[aria-label="Redo"]').attributes('disabled')).toBeDefined();
	});

	it('toggles find & replace from the centred search box', async () => {
		const onToggleFindReplace = vi.fn();
		const wrapper = mountTitleBar({ onToggleFindReplace });
		const input = wrapper.get('input[aria-label="Search"]');
		await input.setValue('test');
		await input.trigger('keydown', { key: 'Enter' });
		expect(onToggleFindReplace).toHaveBeenCalledOnce();
	});

	it('hides the editing controls in preview mode', () => {
		const wrapper = mountTitleBar({ mode: 'preview', canEdit: false });
		expect(wrapper.find('button[role="switch"]').exists()).toBeFalsy();
		expect(wrapper.find('button[aria-label="Undo"]').exists()).toBeFalsy();
	});

	it('renders Undo and Redo by default (hiddenActions omitted)', () => {
		const wrapper = mountTitleBar();
		expect(wrapper.find('button[aria-label="Undo"]').exists()).toBeTruthy();
		expect(wrapper.find('button[aria-label="Redo"]').exists()).toBeTruthy();
	});

	it('hides Undo and Redo independently via hiddenActions', () => {
		const undoHidden = mountTitleBar({ hiddenActions: ['undo'] });
		expect(undoHidden.find('button[aria-label="Undo"]').exists()).toBeFalsy();
		expect(undoHidden.find('button[aria-label="Redo"]').exists()).toBeTruthy();

		const redoHidden = mountTitleBar({ hiddenActions: ['redo'] });
		expect(redoHidden.find('button[aria-label="Undo"]').exists()).toBeTruthy();
		expect(redoHidden.find('button[aria-label="Redo"]').exists()).toBeFalsy();
	});
});
