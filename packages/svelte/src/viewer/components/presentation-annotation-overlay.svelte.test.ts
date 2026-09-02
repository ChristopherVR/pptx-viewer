import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';
import PresentationAnnotationOverlay from './PresentationAnnotationOverlay.svelte';

/**
 * The ink overlay is a child of the stage holder, whose click advances the
 * show while presenting. A stroke drawn with a tool armed therefore used to
 * end with the show stepping to the next slide, which took the fresh ink off
 * screen with it (a stroke belongs to the slide it was drawn on): blackboard
 * mode looked like it recorded nothing at all. The overlay has to keep the
 * gesture to itself, and only while a tool is armed, because PowerPoint still
 * advances on a click when the pointer is back to the plain arrow.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

const CANVAS = { width: 1280, height: 720 };

function mountOverlay(annotations: PresentationAnnotations): {
	stage: HTMLDivElement;
	svg: SVGSVGElement;
} {
	// Stands in for the stage holder the overlay is rendered into.
	const stage = document.createElement('div');
	document.body.appendChild(stage);
	const instance = mount(PresentationAnnotationOverlay, {
		target: stage,
		props: { annotations, current: 0, canvasSize: CANVAS, blackout: 'black' as const },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		stage.remove();
	};
	const svg = stage.querySelector('svg')!;
	svg.setPointerCapture = () => {};
	svg.getBoundingClientRect = () =>
		({ left: 0, top: 0, width: CANVAS.width, height: CANVAS.height }) as DOMRect;
	return { stage, svg };
}

function press(svg: SVGSVGElement, type: string): Event {
	const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 40, clientY: 60 });
	svg.dispatchEvent(event);
	flushSync();
	return event;
}

describe('svelte presentation annotation overlay', () => {
	// The stage-holder's advance is a Svelte template handler, so it runs from
	// the delegated dispatch that honours `stopPropagation`; `preventDefault` on
	// the pointerdown additionally suppresses the compatibility click. Asserting
	// on the event itself pins both without rebuilding the stage in a test.
	it('keeps the drawing gesture off the show surface while a tool is armed', () => {
		const annotations = new PresentationAnnotations();
		annotations.tool = 'pen';
		const { svg } = mountOverlay(annotations);

		const down = press(svg, 'pointerdown');

		expect(down.defaultPrevented).toBeTruthy();
		expect(down.cancelBubble).toBeTruthy();
		expect(annotations.current).not.toBeNull();
	});

	it('lets the press through to the show surface when no tool is armed', () => {
		const annotations = new PresentationAnnotations();
		const { svg } = mountOverlay(annotations);

		const down = press(svg, 'pointerdown');
		const click = press(svg, 'click');

		expect(down.defaultPrevented).toBeFalsy();
		expect(down.cancelBubble).toBeFalsy();
		expect(click.defaultPrevented).toBeFalsy();
		expect(click.cancelBubble).toBeFalsy();
	});

	it('marks the overlay interactive exactly when it captures the pointer', () => {
		const annotations = new PresentationAnnotations();
		const { stage } = mountOverlay(annotations);
		const overlay = stage.querySelector('[data-pptx-annotation-overlay]')!;
		expect(overlay.classList.contains('interactive')).toBeFalsy();

		annotations.tool = 'highlighter';
		flushSync();
		expect(overlay.classList.contains('interactive')).toBeTruthy();
	});

	// Shared `cursorForTool`: crosshair for a drawing tool, none while the
	// laser hides the native pointer, default with no tool armed.
	it('shows a tool-specific cursor via the shared cursorForTool helper', () => {
		const annotations = new PresentationAnnotations();
		const { stage } = mountOverlay(annotations);
		const overlay = stage.querySelector<HTMLElement>('[data-pptx-annotation-overlay]')!;
		expect(overlay.style.cursor).toBe('default');

		annotations.tool = 'pen';
		flushSync();
		expect(overlay.style.cursor).toBe('crosshair');

		annotations.tool = 'laser';
		flushSync();
		expect(overlay.style.cursor).toBe('none');
	});
});
