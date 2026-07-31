import type { PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import SlideStage from './SlideStage.svelte';

/**
 * SlideStage tests: the interactive stage exposes the shared region/slide
 * accessibility hook, while non-interactive stages (thumbnail rail, presenter
 * previews) withhold the role WITHOUT aria-hiding the subtree. The regression
 * guarded here: a thumbnail stage was `aria-hidden="true"`, which stripped the
 * OLE action bar's Download link / Open button from the accessibility tree,
 * breaking `getByRole('button', { name: /open/i })` in `ole-and-ink.spec.ts`
 * (an aria-hidden subtree must not contain focusable controls either).
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

	it('does not aria-hide a non-interactive (thumbnail) stage, keeping OLE actions accessible', () => {
		const target = mountStage(false);
		const stage = target.querySelector<HTMLElement>('.pptx-svelte-stage');
		expect(stage?.getAttribute('role')).toBeNull();
		// The load-bearing part: no aria-hidden anywhere above the action bar,
		// so the Download link and Open button stay in the accessibility tree.
		expect(stage?.getAttribute('aria-hidden')).toBeNull();

		const download = target.querySelector<HTMLAnchorElement>('a.pptx-svelte-ole-action');
		expect(download?.getAttribute('download')).toBe('report.pdf');
		const open = target.querySelector<HTMLButtonElement>('button.pptx-svelte-ole-action');
		expect(open?.getAttribute('aria-label')).toBe('Open report.pdf');
		expect(download?.closest('[aria-hidden="true"]')).toBeNull();
		expect(open?.closest('[aria-hidden="true"]')).toBeNull();
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
});
