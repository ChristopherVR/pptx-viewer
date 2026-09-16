import { attachRotateHandlePlacement } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { selectionControlArtwork } from './selection-control-artwork';
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

describe('selection overlay optional artwork', () => {
	function createOverlay() {
		return createSelectionOverlay(document, (key) => key, {
			onHandlePointerDown: vi.fn(),
			onRotatePointerDown: vi.fn(),
			onAdjustPointerDown: vi.fn(),
		});
	}

	it.each([0.5, 1, 2])('keeps screen artwork independent of slide scale %s', (scale) => {
		const overlay = createOverlay();
		overlay.setBox({ x: 50, y: 30, width: 300, height: 80, rotation: 0 }, scale);
		const button = overlay.root.querySelector<HTMLButtonElement>('[data-handle="nw"]')!;
		const artwork = button.querySelector<HTMLElement>('.pptxv-control-artwork')!;
		// happy-dom does not parse max() widths; the browser spec measures the frame.
		expect(selectionControlArtwork('nw').frame.width).toContain(
			'max(var(--pptxv-resize-size, 10px), var(--pptx-selection-corner-size',
		);
		expect(selectionControlArtwork('nw').frame.marginLeft).toContain('/ -2');
		expect(artwork.getAttribute('aria-hidden')).toBe('true');
		expect(artwork.style.pointerEvents).toBe('none');
		expect(artwork.style.width).toBe(
			'var(--pptx-selection-corner-size, var(--pptxv-resize-size, 10px))',
		);
		expect(button.querySelector<HTMLElement>('[data-pptx-handle-hit]')?.style.pointerEvents).toBe(
			'auto',
		);
		expect(overlay.root.querySelectorAll('.pptxv-control-artwork')).toHaveLength(9);
		overlay.destroy();
	});

	it('maps edge dimensions and keeps the binding appearance as the fallback', () => {
		const overlay = createOverlay();
		const horizontal = overlay.root.querySelector<HTMLElement>(
			'[data-handle="n"] .pptxv-control-artwork',
		)!;
		const vertical = overlay.root.querySelector<HTMLElement>(
			'[data-handle="w"] .pptxv-control-artwork',
		)!;
		expect(horizontal.style.width).toContain('--pptx-selection-edge-length');
		expect(horizontal.style.height).toContain('--pptx-selection-edge-thickness');
		expect(vertical.style.width).toContain('--pptx-selection-edge-thickness');
		expect(vertical.style.height).toContain('--pptx-selection-edge-length');
		expect(horizontal.style.borderRadius).toBe('var(--pptx-selection-edge-radius, 2px)');
		expect(horizontal.style.background).toBe('var(--pptx-selection-handle-fill, #fff)');
		expect(horizontal.style.borderColor).toBe(
			'var(--pptx-selection-handle-border-color, var(--pptx-ring))',
		);
		expect(overlay.root.querySelector<HTMLElement>('.pptxv-sel-box')?.style.borderColor).toBe(
			'var(--pptx-selection-outline-color, var(--pptx-ring))',
		);
		expect(overlay.root.querySelector<HTMLElement>('.pptxv-rotate-stem')?.style.background).toBe(
			'var(--pptx-selection-outline-color, var(--pptx-ring))',
		);
		overlay.destroy();
	});
});
