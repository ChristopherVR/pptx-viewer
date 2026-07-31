import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PresentationTransitionOverlay from './PresentationTransitionOverlay.svelte';

/**
 * What a viewer actually SEES during a slide change.
 *
 * Two regressions shipped here while every structural assertion in the suite
 * still passed, because the animations really were running:
 * `document.getAnimations()` reported dozens of them while a human on a
 * 1920x1080 display saw a flicker and a hard cut.
 */

/** The component's own text; jsdom gives no layout, so the CSS rule is read. */
const overlaySource = readFileSync(
	[
		'src/viewer/presentation/PresentationTransitionOverlay.svelte',
		'packages/svelte/src/viewer/presentation/PresentationTransitionOverlay.svelte',
	]
		.map((candidate) => resolve(process.cwd(), candidate))
		.find((candidate) => existsSync(candidate))!,
	'utf8',
);

const canvasSize = { width: 960, height: 540 };

function makeSlide(id: string, elements: unknown[] = []): PptxSlide {
	return { id, elements, backgroundColor: '#ffffff' } as unknown as PptxSlide;
}

/**
 * One shape per slide, so `buildMorphTransitionPlan` has something to pair and
 * actually returns a plan (it bails out on two empty slides).
 */
function morphable(slideId: string, x: number): PptxSlide {
	return makeSlide(slideId, [
		{
			id: `${slideId}-shape`,
			type: 'shape',
			name: 'Rectangle 1',
			x,
			y: 10,
			width: 100,
			height: 50,
			shapeType: 'rect',
		},
	]);
}

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountOverlay(transition: PptxSlideTransition): HTMLElement {
	const morph = transition.type === 'morph';
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(PresentationTransitionOverlay, {
		target,
		props: {
			outgoingSlide: morph ? morphable('out', 10) : makeSlide('out'),
			incomingSlide: morph ? morphable('in', 400) : makeSlide('in'),
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			transition,
			ondone: vi.fn(),
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('presentationTransitionOverlay', () => {
	it('paints no slide background on the morph departing layer', () => {
		const target = mountOverlay({ type: 'morph', durationMs: 800 } as PptxSlideTransition);
		expect(target.querySelectorAll('[data-pptx-morph-outgoing]')).not.toHaveLength(0);

		const stages = [...target.querySelectorAll<HTMLElement>('.pptx-svelte-stage')];
		expect(stages).toHaveLength(2);
		const [outgoing, incoming] = stages;
		// The departing shapes float over the incoming slide, so this layer has to
		// be see-through. `getSlideBackgroundStyle` always resolves to an OPAQUE
		// paint, so inheriting it hid the whole morph behind a flat slab for the
		// entire transition.
		expect(outgoing.getAttribute('style')).toMatch(/transparent/u);
		expect(outgoing.getAttribute('style')).not.toContain('#ffffff');
		// The incoming layer is a real surface and keeps its background.
		expect(incoming.getAttribute('style')).toContain('#ffffff');
	});

	it('keeps the slide background on a non-morph transition snapshot', () => {
		const target = mountOverlay({ type: 'fade', durationMs: 300 } as PptxSlideTransition);
		const stages = [...target.querySelectorAll<HTMLElement>('.pptx-svelte-stage')];
		expect(stages).toHaveLength(2);
		for (const stage of stages) {
			expect(stage.getAttribute('style')).toContain('#ffffff');
		}
	});

	it('stretches each transition layer to the overlay instead of shrink-wrapping it', () => {
		// jsdom has no layout engine, so this is asserted on the rule itself. The
		// stage inside a layer scales with `transform`, which never changes its
		// laid-out box: an auto-sized `top`/`left` layer therefore measures the
		// deck's NATIVE size, and `overflow: hidden` then crops the transition to
		// that corner of a larger display (1280x720 of a 1920x1080 show).
		const layerRule =
			/\.pptx-svelte-transition-layer\s*\{([^}]*)\}/u.exec(overlaySource)?.[1] ?? '';
		expect(layerRule).toContain('position: absolute');
		expect(layerRule).toContain('overflow: hidden');
		expect(layerRule, 'a clipped layer must fill its overlay, not its content').toMatch(
			/inset:\s*0|width:\s*100%/u,
		);
		expect(layerRule).not.toMatch(/top:\s*0;\s*\n?\s*left:\s*0;/u);
	});
});
