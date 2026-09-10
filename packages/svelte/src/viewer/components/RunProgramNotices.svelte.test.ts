import type { RunProgramNotice } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RunProgramNotices from './RunProgramNotices.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.unstubAllGlobals();
});

function notice(id: string, target: string): RunProgramNotice {
	return {
		id,
		target,
		messageKey: 'pptx.presentation.runProgramNotice',
		copyLabelKey: 'pptx.presentation.runProgramCopy',
	};
}

function mountNotices(notices: readonly RunProgramNotice[]): {
	target: HTMLElement;
	ondismiss: ReturnType<typeof vi.fn>;
} {
	const ondismiss = vi.fn();
	const target = document.createElement('div');
	const instance = mount(RunProgramNotices, { target, props: { notices, ondismiss } });
	cleanup = () => unmount(instance);
	flushSync();
	return { target, ondismiss };
}

describe('runProgramNotices', () => {
	it('renders nothing for an empty notice list', () => {
		const { target } = mountNotices([]);
		expect(target.querySelector('[data-testid="pptx-run-program-notice"]')).toBeNull();
	});

	it('renders each notice with the exact resolved command on data-target', () => {
		const { target } = mountNotices([
			notice('run-program-1', 'notepad.exe C:\\temp\\notes.txt'),
			notice('run-program-2', 'calc.exe'),
		]);
		const items = target.querySelectorAll('[data-testid="pptx-run-program-notice"]');
		expect(items).toHaveLength(2);
		expect(items[0]?.getAttribute('data-target')).toBe('notepad.exe C:\\temp\\notes.txt');
		expect(items[1]?.getAttribute('data-target')).toBe('calc.exe');
		expect(target.textContent).toContain('notepad.exe C:\\temp\\notes.txt');
	});

	it('dismisses one notice through the callback', () => {
		const { target, ondismiss } = mountNotices([notice('run-program-1', 'calc.exe')]);
		const buttons = target.querySelectorAll('button');
		const dismiss = Array.from(buttons).find(
			(button) => button.getAttribute('data-testid') !== 'pptx-run-program-notice-copy',
		) as HTMLButtonElement;
		dismiss.click();
		expect(ondismiss).toHaveBeenCalledWith('run-program-1');
	});

	describe('with a clipboard available', () => {
		beforeEach(() => {
			vi.stubGlobal('navigator', {
				clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
			});
		});

		it('shows the copy button and writes the exact target to the clipboard', () => {
			const { target } = mountNotices([notice('run-program-1', 'notepad.exe C:\\temp\\notes.txt')]);
			const copyButton = target.querySelector<HTMLButtonElement>(
				'[data-testid="pptx-run-program-notice-copy"]',
			);
			expect(copyButton).not.toBeNull();
			copyButton!.click();
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith('notepad.exe C:\\temp\\notes.txt');
		});
	});

	describe('without a clipboard available', () => {
		beforeEach(() => {
			vi.stubGlobal('navigator', {});
		});

		it('hides the copy button rather than offering a no-op', () => {
			const { target } = mountNotices([notice('run-program-1', 'calc.exe')]);
			expect(target.querySelector('[data-testid="pptx-run-program-notice-copy"]')).toBeNull();
		});
	});
});
