import { mount } from '@vue/test-utils';
import type { RunProgramNotice } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RunProgramNotices from './RunProgramNotices.vue';

function notice(overrides: Partial<RunProgramNotice> = {}): RunProgramNotice {
	return {
		id: 'run-program-1',
		target: 'notepad.exe C:\\temp\\notes.txt',
		messageKey: 'pptx.presentation.runProgramNotice',
		copyLabelKey: 'pptx.presentation.runProgramCopy',
		...overrides,
	};
}

const originalClipboard = navigator.clipboard;

afterEach(() => {
	Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
});

describe('runProgramNotices', () => {
	it('renders nothing for an empty notice list', () => {
		const wrapper = mount(RunProgramNotices, { props: { notices: [] } });
		expect(wrapper.find('[data-testid="pptx-run-program-notices"]').exists()).toBeFalsy();
	});

	it('renders one notice per entry, interpolating the resolved target into the message', () => {
		const wrapper = mount(RunProgramNotices, { props: { notices: [notice()] } });
		const el = wrapper.find('[data-testid="pptx-run-program-notice"]');
		expect(el.exists()).toBeTruthy();
		expect(el.text()).toContain('notepad.exe C:\\temp\\notes.txt');
	});

	it('carries the exact resolved command as a data-target attribute, independent of i18n wording', () => {
		const wrapper = mount(RunProgramNotices, { props: { notices: [notice()] } });
		const el = wrapper.find('[data-testid="pptx-run-program-notice"]');
		expect(el.attributes('data-target')).toBe('notepad.exe C:\\temp\\notes.txt');
	});

	it('emits dismiss with the notice id', async () => {
		const wrapper = mount(RunProgramNotices, { props: { notices: [notice()] } });
		await wrapper.find('[data-testid="pptx-run-program-notice-dismiss"]').trigger('click');
		expect(wrapper.emitted('dismiss')).toStrictEqual([['run-program-1']]);
	});

	it('the Copy button writes the exact target string to the clipboard when available', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		const wrapper = mount(RunProgramNotices, { props: { notices: [notice()] } });
		const copyButton = wrapper.find('[data-testid="pptx-run-program-notice-copy"]');
		expect(copyButton.exists()).toBeTruthy();
		await copyButton.trigger('click');
		expect(writeText).toHaveBeenCalledWith('notepad.exe C:\\temp\\notes.txt');
	});

	it('hides the Copy button when the clipboard API is unavailable', () => {
		Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
		const wrapper = mount(RunProgramNotices, { props: { notices: [notice()] } });
		expect(wrapper.find('[data-testid="pptx-run-program-notice-copy"]').exists()).toBeFalsy();
		// Dismiss must still work with no clipboard: it is not blocked by it.
		expect(wrapper.find('[data-testid="pptx-run-program-notice-dismiss"]').exists()).toBeTruthy();
	});
});
