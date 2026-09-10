// @vitest-environment happy-dom
import type { RunProgramNotice } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RunProgramNotices } from './RunProgramNotices';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

const notices: RunProgramNotice[] = [
	{
		id: 'run-program-1',
		target: 'notepad.exe C:\\temp\\notes.txt',
		messageKey: 'pptx.presentation.runProgramNotice',
		copyLabelKey: 'pptx.presentation.runProgramCopy',
	},
];

describe('runProgramNotices', () => {
	it('renders nothing when there are no notices', () => {
		act(() => root.render(<RunProgramNotices notices={[]} onDismiss={() => {}} />));
		expect(container.querySelector('[data-testid="pptx-run-program-notices"]')).toBeNull();
	});

	it('renders one notice with its exact target as data-target', () => {
		act(() => root.render(<RunProgramNotices notices={notices} onDismiss={() => {}} />));
		const stack = container.querySelector('[data-testid="pptx-run-program-notices"]');
		expect(stack).not.toBeNull();
		const notice = container.querySelector('[data-testid="pptx-run-program-notice"]');
		expect(notice?.getAttribute('data-target')).toBe('notepad.exe C:\\temp\\notes.txt');
	});

	it('calls onDismiss with the notice id', () => {
		const onDismiss = vi.fn();
		act(() => root.render(<RunProgramNotices notices={notices} onDismiss={onDismiss} />));
		const button = container.querySelector(
			'[data-testid="pptx-run-program-notice-dismiss"]',
		) as HTMLButtonElement;
		act(() => button.click());
		expect(onDismiss).toHaveBeenCalledWith('run-program-1');
	});

	it('shows a Copy button that writes the exact target to the clipboard when available', () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});
		act(() => root.render(<RunProgramNotices notices={notices} onDismiss={() => {}} />));
		const button = container.querySelector(
			'[data-testid="pptx-run-program-notice-copy"]',
		) as HTMLButtonElement;
		expect(button).not.toBeNull();
		act(() => button.click());
		expect(writeText).toHaveBeenCalledWith('notepad.exe C:\\temp\\notes.txt');
	});

	it('hides the Copy button when the clipboard API is unavailable', () => {
		Object.defineProperty(navigator, 'clipboard', {
			value: undefined,
			configurable: true,
		});
		act(() => root.render(<RunProgramNotices notices={notices} onDismiss={() => {}} />));
		expect(container.querySelector('[data-testid="pptx-run-program-notice-copy"]')).toBeNull();
		// Dismiss is still there, so the notice is not otherwise broken.
		expect(
			container.querySelector('[data-testid="pptx-run-program-notice-dismiss"]'),
		).not.toBeNull();
	});
});
