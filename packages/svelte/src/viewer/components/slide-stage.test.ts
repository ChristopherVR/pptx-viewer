import type { PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import SlideStage from './SlideStage.svelte';

/**
 * SlideStage tests: the interactive stage exposes the shared region/slide
 * accessibility hook, while non-interactive stages (thumbnail rail, presenter
 * previews) withhold the role WITHOUT aria-hiding the subtree (a still needs
 * its text/images to stay in the accessibility tree even though it is not a
 * "slide region"). Guards a real regression: a thumbnail stage was once
 * `aria-hidden="true"`, which would strip ANY focusable content from the
 * accessibility tree wholesale.
 *
 * The OLE action bar itself is a SEPARATE rule, not this file's concern
 * (see `OleView.svelte`'s `showActions`): a slide thumbnail renders its
 * whole element tree INSIDE the slides panel's own
 * `<button aria-label="Go to slide N">`, so the action bar's Download
 * link / Open button must not render there at all, interactive or not -
 * nested interactive controls are invalid markup regardless of
 * accessibility-tree visibility. `ole-and-ink.spec.ts` exercises those
 * controls only on the interactive editable canvas.
 */

const PDF_DATA_URL = 'data:application/pdf;base64,AAAA';

function oleSlide(): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [
			{
				type: 'ole',
				id: 'ole-1',
				x: 30,
				y: 50,
				width: 400,
				height: 300,
				oleObjectType: 'pdf',
				oleEmbeddedData: PDF_DATA_URL,
				oleEmbeddedMimeType: 'application/pdf',
				oleEmbeddedFileName: 'report.pdf',
			},
		],
	} as PptxSlide;
}

let cleanup: (() => void) | undefined;

function mountStage(interactive: boolean): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SlideStage, {
		target,
		props: {
			slide: oleSlide(),
			canvasSize: { width: 960, height: 540 },
			mediaDataUrls: new Map<string, string>(),
			scale: interactive ? 1 : 0.15,
			interactive,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('slideStage', () => {
	it('marks the interactive stage as a slide region', () => {
		const stage = mountStage(true).querySelector<HTMLElement>('.pptx-svelte-stage');
		expect(stage?.getAttribute('role')).toBe('region');
		expect(stage?.getAttribute('aria-roledescription')).toBe('slide');
		expect(stage?.getAttribute('aria-hidden')).toBeNull();
	});

	it('does not aria-hide a non-interactive (thumbnail) stage', () => {
		const target = mountStage(false);
		const stage = target.querySelector<HTMLElement>('.pptx-svelte-stage');
		expect(stage?.getAttribute('role')).toBeNull();
		expect(stage?.getAttribute('aria-hidden')).toBeNull();
	});

	it('renders no OLE action bar on a non-interactive (thumbnail) stage: nested-button prevention', () => {
		// A slide thumbnail renders this whole tree INSIDE the slides panel's
		// own `<button aria-label="Go to slide N">`, so the OLE action bar's
		// Download link / Open button must not render here at all: nested
		// interactive controls are invalid markup, not merely something to
		// keep out of the accessibility tree. See `OleView.svelte`'s
		// `showActions` (shared `oleActionsVisible`). The interactive editable
		// canvas (`mountStage(true)`) is where `ole-and-ink.spec.ts` exercises
		// these controls.
		const target = mountStage(false);
		expect(target.querySelector('a.pptx-svelte-ole-action')).toBeNull();
		expect(target.querySelector('button.pptx-svelte-ole-action')).toBeNull();
	});

	/**
	 * Motion-path keyframes translate by `calc(var(--pptx-slide-w) * fraction)`,
	 * so a stage that does not publish its own size makes every path travel the
	 * 1280x720 fallback distance instead of the real one. This one component IS
	 * both the editing stage and the slide-show stage in this binding, so both
	 * are covered by asserting it here.
	 */
	it('publishes its slide size for motion-path keyframes, at any scale', () => {
		for (const interactive of [true, false]) {
			const stage = mountStage(interactive).querySelector<HTMLElement>('.pptx-svelte-stage');
			expect(stage?.style.getPropertyValue('--pptx-slide-w')).toBe('960px');
			expect(stage?.style.getPropertyValue('--pptx-slide-h')).toBe('540px');
			cleanup?.();
			cleanup = undefined;
		}
	});

	it('anchors a shadeToTitle gradient on the title placeholder', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const gradient = 'linear-gradient(90.00deg, #000000 0%, #ffffff 100%)';
		const slide: PptxSlide = {
			id: 'slide-1',
			rId: 'rId1',
			slideNumber: 1,
			backgroundGradient: gradient,
			backgroundShadeToTitle: true,
			elements: [
				{
					id: 'title-1',
					type: 'text',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					placeholderType: 'title',
				},
			],
		} as unknown as PptxSlide;
		const instance = mount(SlideStage, {
			target,
			props: {
				slide,
				canvasSize: { width: 960, height: 540 },
				mediaDataUrls: new Map<string, string>(),
			},
		});
		flushSync();
		const stage = target.querySelector<HTMLElement>('.pptx-svelte-stage');
		expect(stage?.style.backgroundImage).not.toContain(gradient);
		expect(stage?.style.backgroundImage).toContain('data:image/svg+xml');
		unmount(instance);
		target.remove();
	});
});
