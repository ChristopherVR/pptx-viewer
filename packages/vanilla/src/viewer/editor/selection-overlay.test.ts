import { attachRotateHandlePlacement } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSelectionOverlay } from './selection-overlay';

vi.mock(import('pptx-viewer-shared'), async (original) => ({
	...(await original()),
	attachRotateHandlePlacement: vi.fn(() => vi.fn()),
}));

afterEach(() => {
	document.body.replaceChildren();
	vi.clearAllMocks();
});

describe('selection overlay placement lifetime', () => {
	it('retains the attachment when a stage render detaches and remounts the same overlay', () => {
		const cleanup = vi.fn();
		vi.mocked(attachRotateHandlePlacement).mockReturnValue(cleanup);
		const host = document.createElement('div');
		const next = document.createElement('div');
		document.body.append(host, next);
		const overlay = createSelectionOverlay(document, (key) => key, {
			onHandlePointerDown: vi.fn(),
			onRotatePointerDown: vi.fn(),
			onAdjustPointerDown: vi.fn(),
		});
		overlay.mount(host);
		expect(attachRotateHandlePlacement).toHaveBeenCalledOnce();
		overlay.setEditing(true);
		expect(overlay.root.querySelector<HTMLElement>('.pptxv-sel-box')?.style.zIndex).toBe('7');
		overlay.setEditing(false);
		expect(overlay.root.querySelector<HTMLElement>('.pptxv-sel-box')?.style.zIndex).toBe('');
		host.replaceChildren();
		overlay.mount(host);
		expect(attachRotateHandlePlacement).toHaveBeenCalledOnce();
		expect(cleanup).not.toHaveBeenCalled();
		overlay.mount(next);
		expect(cleanup).toHaveBeenCalledOnce();
		expect(attachRotateHandlePlacement).toHaveBeenCalledTimes(2);
		overlay.destroy();
		expect(cleanup).toHaveBeenCalledTimes(2);
	});
});
