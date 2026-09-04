import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { playAnimationSound, stopAnimationSound } from './animation-sound';
import PresentationTransitionOverlay from './PresentationTransitionOverlay.svelte';

vi.mock(import('./animation-sound'), () => ({
	playAnimationSound: vi.fn(),
	stopAnimationSound: vi.fn(),
}));

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

/** A full-slide picture whose frame never moves and whose source crop does. */
function rescaledPicture(slideId: string, crop: Record<string, number>): PptxSlide {
	return makeSlide(slideId, [
		{
			id: `${slideId}-picture`,
			type: 'picture',
			name: '!!Background',
			x: 0,
			y: 0,
			width: 960,
			height: 540,
			imagePath: 'ppt/media/image9.png',
			...crop,
		},
	]);
}

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/**
 * The shape of the issue #146 morph: an unchanged opaque disc, a backdrop that
 * departs (so the disc's ghost is kept as a shield), and new wording arriving
 * INSIDE the disc.
 */
function discAndWording(): { from: PptxSlide; to: PptxSlide } {
	const disc = {
		type: 'shape',
		name: '!!Content',
		x: 0,
		y: 0,
		width: 300,
		height: 300,
		shapeType: 'ellipse',
		shapeStyle: { fillMode: 'solid', fillColor: '#27282A' },
	};
	return {
		from: makeSlide('out', [
			{ id: 'out-backdrop', type: 'shape', name: 'Backdrop', x: 0, y: 0, width: 960, height: 540 },
			{ ...disc, id: 'out-disc' },
		]),
		to: makeSlide('in', [
			{ ...disc, id: 'in-disc' },
			{
				id: 'in-wording',
				type: 'text',
				name: 'TextBox 9',
				x: 50,
				y: 60,
				width: 200,
				height: 30,
				text: 'Multi-Domain Fusion',
			},
		]),
	};
}

/**
 * The same panel with its wording REPLACED rather than arriving: a matched pair
 * the overlay paints both halves of, which is what has to be blended additively
 * (issue #161). `shapeId` is the identity that pairs two text boxes saying
 * different things - proximity alone deliberately refuses them (issue #131).
 */
function discAndReplacedWording(): { from: PptxSlide; to: PptxSlide } {
	const { from, to } = discAndWording();
	const wording = (id: string, text: string): unknown => ({
		id,
		type: 'text',
		name: 'TextBox 6',
		shapeId: 7,
		x: 50,
		y: 60,
		width: 200,
		height: 30,
		text,
	});
	return {
		from: makeSlide('out', [
			...(from.elements as unknown[]),
			wording('out-wording', 'Open Integration'),
		]),
		to: makeSlide('in', [
			...(to.elements as unknown[]).filter(
				(element) => (element as { id: string }).id !== 'in-wording',
			),
			wording('in-wording', 'Tactical Edge'),
		]),
	};
}

function mountOverlay(
	transition: PptxSlideTransition,
	slides?: { from: PptxSlide; to: PptxSlide },
): HTMLElement {
	const morph = transition.type === 'morph';
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(PresentationTransitionOverlay, {
		target,
		props: {
			outgoingSlide: slides?.from ?? (morph ? morphable('out', 10) : makeSlide('out')),
			incomingSlide: slides?.to ?? (morph ? morphable('in', 400) : makeSlide('in')),
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

	it('zooms a picture whose only change is its source crop', () => {
		// PowerPoint's "Scale Height"/"Scale Width" is an `a:srcRect` crop inside
		// an unchanged frame, so both halves of this pair agree on position, size,
		// blip and style: the engine saw an inert pair and the picture cut between
		// crops in a single frame (issue #148). The crop is painted on the `<img>`,
		// so the rule has to reach that node and not the element container.
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(PresentationTransitionOverlay, {
			target,
			props: {
				outgoingSlide: rescaledPicture('out', { cropLeft: 0.05739, cropRight: 0.05739 }),
				incomingSlide: rescaledPicture('in', { cropLeft: 0.00356, cropRight: 0.00356 }),
				canvasSize,
				mediaDataUrls: new Map<string, string>(),
				transition: { type: 'morph', durationMs: 800 } as PptxSlideTransition,
				ondone: vi.fn(),
			},
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};

		const css = [...target.querySelectorAll('style')].map((node) => node.textContent).join('\n');
		expect(css).toContain('[data-element-id="in-picture"] img { animation: pptx-morph-crop-');
		expect(css).toContain('@keyframes pptx-morph-crop-');
	});

	it('keeps the slide background on a non-morph transition snapshot', () => {
		const target = mountOverlay({ type: 'fade', durationMs: 300 } as PptxSlideTransition);
		const stages = [...target.querySelectorAll<HTMLElement>('.pptx-svelte-stage')];
		expect(stages).toHaveLength(2);
		for (const stage of stages) {
			expect(stage.getAttribute('style')).toContain('#ffffff');
		}
	});

	// Regression (issue #146): the wheel deck's centre disc is identical on both
	// slides, so its opaque ghost sat over the title, body and button dissolving
	// in inside it - they were invisible until the overlay came down. The plan
	// hands those few over separately and the overlay must paint them, above
	// every ghost, from the INCOMING slide.
	it('paints the arriving shapes the plan lifted, above the departing layer', () => {
		const target = mountOverlay(
			{ type: 'morph', durationMs: 800 } as PptxSlideTransition,
			discAndWording(),
		);

		const lifted = target.querySelector<HTMLElement>('[data-pptx-morph-lifted]');
		expect(lifted).not.toBeNull();
		expect(lifted!.getAttribute('style')).toContain('z-index: 3');
		expect(lifted!.textContent).toContain('Multi-Domain Fusion');

		const css = [...target.querySelectorAll('style')].map((node) => node.textContent).join('\n');
		expect(css).toContain('[data-pptx-morph-lifted] [data-element-id="in-wording"]');
		// Its copy on the incoming layer is held invisible, so the two never
		// composite with each other.
		expect(css).toMatch(
			/\[data-pptx-morph-incoming\] \[data-element-id="in-wording"\] \{ animation: pptx-morph-lifted-hidden/u,
		);
	});

	// Regression (issue #161): two fades stacked as ordinary layers composite
	// source-over, leaving the ink the halves SHARE at 0.75 of full strength
	// halfway through - measured 34.6/255 too dark on the wheel deck, which
	// bites chunks out of glyphs where the two line grids cross. PowerPoint's
	// own render keeps the blend coefficients summing to 1.0 for every frame, so
	// the pair is summed inside its own isolation group instead.
	it('paints a pair dissolving in place as one isolated, additive group', () => {
		const target = mountOverlay(
			{ type: 'morph', durationMs: 800 } as PptxSlideTransition,
			discAndReplacedWording(),
		);

		const group = target.querySelector<HTMLElement>('[data-pptx-morph-crossfade="in-wording"]');
		expect(group, 'the pair must be rendered as its own group').not.toBeNull();
		expect(group!.getAttribute('style')).toContain('isolation: isolate');
		// Above the ghost layer (2) and the lifted layer (3).
		expect(group!.getAttribute('style')).toContain('z-index: 4');
		const halves = [...group!.querySelectorAll<HTMLElement>('[data-pptx-transition-layer]')];
		expect(halves).toHaveLength(2);
		for (const half of halves) {
			expect(half.getAttribute('style')).toContain('mix-blend-mode: plus-lighter');
			// The dissolve rides the wrapper: on the element it would take a
			// compositing layer whose raster snaps to whole device pixels and paints
			// the wording off the live stage.
			expect(half.getAttribute('style')).toContain('-fade');
		}
		expect(group!.textContent).toContain('Open Integration');
		expect(group!.textContent).toContain('Tactical Edge');
		// Painted exactly once: not left in the flat layers as well.
		expect(target.textContent!.match(/Open Integration/gu)).toHaveLength(1);
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

describe('presentationTransitionOverlay sound (p:sndAc/p:stSnd, p:endSnd)', () => {
	afterEach(() => {
		vi.mocked(playAnimationSound).mockClear();
		vi.mocked(stopAnimationSound).mockClear();
	});

	function mountWithTransition(
		transition: PptxSlideTransition,
		mediaDataUrls: Map<string, string>,
	) {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(PresentationTransitionOverlay, {
			target,
			props: {
				outgoingSlide: makeSlide('out'),
				incomingSlide: makeSlide('in'),
				canvasSize,
				mediaDataUrls,
				transition,
				ondone: vi.fn(),
			},
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
	}

	it('resolves the transition sound path through mediaDataUrls and plays it', () => {
		mountWithTransition(
			{
				type: 'fade',
				durationMs: 300,
				soundPath: 'ppt/media/media3.wav',
				soundLoop: true,
			} as PptxSlideTransition,
			new Map([['ppt/media/media3.wav', 'blob:sound']]),
		);
		expect(playAnimationSound).toHaveBeenCalledWith('blob:sound', true);
	});

	it('does not play when the raw archive path has no resolved URL yet', () => {
		mountWithTransition(
			{ type: 'fade', durationMs: 300, soundPath: 'ppt/media/media3.wav' } as PptxSlideTransition,
			new Map(),
		);
		expect(playAnimationSound).not.toHaveBeenCalled();
	});

	it('stops the current sound for p:endSndAc (transition.stopSound)', () => {
		mountWithTransition(
			{ type: 'fade', durationMs: 300, stopSound: true } as PptxSlideTransition,
			new Map(),
		);
		expect(stopAnimationSound).toHaveBeenCalledOnce();
		expect(playAnimationSound).not.toHaveBeenCalled();
	});

	it('does NOT stop the sound merely because the overlay unmounts (Loop Until Next Sound)', () => {
		mountWithTransition(
			{ type: 'fade', durationMs: 300, soundPath: 'a.wav', soundLoop: true } as PptxSlideTransition,
			new Map([['a.wav', 'blob:sound']]),
		);
		vi.mocked(stopAnimationSound).mockClear();
		cleanup?.();
		cleanup = undefined;
		expect(stopAnimationSound).not.toHaveBeenCalled();
	});
});
