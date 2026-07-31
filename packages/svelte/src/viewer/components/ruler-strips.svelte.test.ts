import type { PptxSlide } from 'pptx-viewer-core';
import { PX_PER_INCH, RULER_THICKNESS } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditorController } from '../editor/editor-controller.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import RulerStrips from './RulerStrips.svelte';
import type { ViewerStageProps } from './viewer-body-props';
import ViewerStage from './ViewerStage.svelte';

/**
 * RulerStrips tests: the View > Rulers strips must place their inch ticks at
 * the same slide positions React does and must re-place them when the stage
 * zoom changes, because the strips live OUTSIDE the CSS-scaled stage and so get
 * no scaling for free. Also covers the toggle (the strips only exist while the
 * preference is on) and the drag-off-the-ruler guide gesture.
 */

const CANVAS = { width: 960, height: 540 };

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountRuler(props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(RulerStrips, {
		target,
		props: { canvasSize: CANVAS, scale: 1, ...props },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

/** Labelled tick positions on a strip, read back off the rendered SVG text. */
function labelPositions(strip: Element, axis: 'x' | 'y'): { label: string; at: number }[] {
	return [...strip.querySelectorAll('text')].map((node) => ({
		label: node.textContent ?? '',
		at: Number(node.getAttribute(axis)),
	}));
}

describe('rulerStrips', () => {
	it('renders both strips sized to the scaled slide', () => {
		const target = mountRuler({ scale: 1 });
		const horizontal = target.querySelector('[data-pptx-ruler="h"]');
		const vertical = target.querySelector('[data-pptx-ruler="v"]');
		expect(horizontal?.getAttribute('width')).toBe(String(CANVAS.width));
		expect(horizontal?.getAttribute('height')).toBe(String(RULER_THICKNESS));
		expect(vertical?.getAttribute('width')).toBe(String(RULER_THICKNESS));
		expect(vertical?.getAttribute('height')).toBe(String(CANVAS.height));
	});

	it('places a numbered tick every inch at 1x zoom', () => {
		const target = mountRuler({ scale: 1 });
		const labels = labelPositions(target.querySelector('[data-pptx-ruler="h"]')!, 'x');
		expect(labels.map((entry) => entry.label)).toStrictEqual([
			'0',
			'1',
			'2',
			'3',
			'4',
			'5',
			'6',
			'7',
			'8',
			'9',
			'10',
		]);
		// Labels sit 2px right of their tick, as React's ruler draws them.
		expect(labels[3]?.at).toBe(3 * PX_PER_INCH + 2);
	});

	it('halves the tick spacing at 0.5x zoom', () => {
		const target = mountRuler({ scale: 0.5 });
		const labels = labelPositions(target.querySelector('[data-pptx-ruler="h"]')!, 'x');
		expect(labels[3]?.at).toBe(3 * PX_PER_INCH * 0.5 + 2);
		const vertical = labelPositions(target.querySelector('[data-pptx-ruler="v"]')!, 'y');
		// The vertical strip labels sit below their tick by the font size + 2.
		expect(vertical[2]?.at).toBe(2 * PX_PER_INCH * 0.5 + 12);
	});

	it('drops a guide when a drag leaves the strip, and not when it stays on it', () => {
		const oncreateguide = vi.fn();
		const target = mountRuler({ scale: 1, oncreateguide });
		const horizontal = target.querySelector('[data-pptx-ruler="h"]')!;

		horizontal.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		horizontal.dispatchEvent(
			new PointerEvent('pointerup', { bubbles: true, clientY: RULER_THICKNESS + 120 }),
		);
		expect(oncreateguide).toHaveBeenCalledWith('h', 120);

		oncreateguide.mockClear();
		horizontal.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		horizontal.dispatchEvent(
			new PointerEvent('pointerup', { bubbles: true, clientY: RULER_THICKNESS - 2 }),
		);
		expect(oncreateguide).not.toHaveBeenCalled();
	});

	it('un-scales the drop position by the stage zoom', () => {
		const oncreateguide = vi.fn();
		const target = mountRuler({ scale: 0.5, oncreateguide });
		const vertical = target.querySelector('[data-pptx-ruler="v"]')!;
		vertical.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		vertical.dispatchEvent(
			new PointerEvent('pointerup', { bubbles: true, clientX: RULER_THICKNESS + 100 }),
		);
		expect(oncreateguide).toHaveBeenCalledWith('v', 200);
	});
});

/* ------------------------------------------------------------------ */
/*  Toggle                                                            */
/* ------------------------------------------------------------------ */

function stageSlide(): PptxSlide {
	return { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] } as unknown as PptxSlide;
}

function mountStage(showRulers: boolean): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props: Partial<ViewerStageProps> = {
		t: (key: string) => key,
		editor: { editTemplateMode: false, selectedElement: undefined } as unknown as EditorState,
		controller: {} as unknown as EditorController,
		canvasSize: CANVAS,
		mediaDataUrls: new Map<string, string>(),
		current: 0,
		loading: false,
		isEncrypted: false,
		error: null,
		activeSlide: stageSlide(),
		scale: 1,
		presenting: false,
		editingActive: false,
		contextMenu: null,
		showRulers,
	};
	const instance = mount(ViewerStage, { target, props: props as ViewerStageProps });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('viewerStage rulers toggle', () => {
	it('paints no ruler while the preference is off', () => {
		const target = mountStage(false);
		expect(target.querySelectorAll('[data-pptx-ruler]')).toHaveLength(0);
	});

	it('paints both strips while the preference is on', () => {
		const target = mountStage(true);
		expect(target.querySelectorAll('[data-pptx-ruler]')).toHaveLength(2);
		// The gutter that keeps the strips clear of the slide is reserved too.
		const wrap = target.querySelector('.pptx-svelte-stage-wrap');
		expect(wrap?.getAttribute('style')).toContain(`${RULER_THICKNESS}px`);
	});
});
