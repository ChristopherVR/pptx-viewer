import type { RunProgramNotice } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRunProgramNoticeStack } from './run-program-notices';

function notice(overrides: Partial<RunProgramNotice> = {}): RunProgramNotice {
	return {
		id: 'run-program-1',
		target: 'notepad.exe C:\\temp\\notes.txt',
		messageKey: 'pptx.presentation.runProgramNotice',
		copyLabelKey: 'pptx.presentation.runProgramCopy',
		...overrides,
	};
}

function mount() {
	const onDismiss = vi.fn();
	const stack = createRunProgramNoticeStack(document, (key) => key, onDismiss);
	return { stack, onDismiss };
}

describe('run-program notice stack', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('starts hidden with an empty stack', () => {
		const { stack } = mount();

		expect(stack.el.hidden).toBeTruthy();
		expect(stack.el.dataset.testid).toBe('pptx-run-program-notices');
	});

	it('renders one notice per click with its resolved command as data-target', () => {
		const { stack } = mount();

		stack.update([notice({ id: 'A', target: 'a.exe' }), notice({ id: 'B', target: 'b.exe' })]);

		expect(stack.el.hidden).toBeFalsy();
		const items = stack.el.querySelectorAll('[data-testid="pptx-run-program-notice"]');
		expect(items).toHaveLength(2);
		expect((items[0] as HTMLElement).dataset.target).toBe('a.exe');
		expect((items[1] as HTMLElement).dataset.target).toBe('b.exe');
	});

	it('fires onDismiss with the notice id from its own dismiss button', () => {
		const { stack, onDismiss } = mount();
		stack.update([notice({ id: 'A' })]);

		stack.el
			.querySelector<HTMLButtonElement>('[data-testid="pptx-run-program-notice-dismiss"]')!
			.click();

		expect(onDismiss).toHaveBeenCalledWith('A');
	});

	it('shows a Copy button that writes the target to the clipboard when it is available', () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		const { stack } = mount();
		stack.update([notice({ target: 'launcher.exe --arg' })]);

		const copy = stack.el.querySelector<HTMLButtonElement>(
			'[data-testid="pptx-run-program-notice-copy"]',
		);
		expect(copy).not.toBeNull();
		copy!.click();
		expect(writeText).toHaveBeenCalledWith('launcher.exe --arg');
	});

	it('omits the Copy button when the clipboard API is unavailable', () => {
		vi.stubGlobal('navigator', {});

		const { stack } = mount();
		stack.update([notice()]);

		expect(stack.el.querySelector('[data-testid="pptx-run-program-notice-copy"]')).toBeNull();
	});
});
