import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { mount } from '@vue/test-utils';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanvasSize } from '../types';
import PresentationTransitionOverlay from './PresentationTransitionOverlay.vue';

/**
 * The SFC's own text. `import.meta.url` is not a file URL under the happy-dom
 * environment, so the path is resolved from the working directory instead
 * (vitest runs from the package root; the second candidate covers a repo-root
 * invocation).
 */
const overlaySource = readFileSync(
	[
		'src/viewer/components/PresentationTransitionOverlay.vue',
		'packages/vue/src/viewer/components/PresentationTransitionOverlay.vue',
	]
		.map((candidate) => resolve(process.cwd(), candidate))
		.find((candidate) => existsSync(candidate))!,
	'utf8',
);

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlide(id: string, elements: unknown[] = []): PptxSlide {
	return {
		id,
		elements,
		backgroundColor: '#ffffff',
	} as unknown as PptxSlide;
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

function mountOverlay(transition: PptxSlideTransition | undefined, scale = 1) {
	const morph = transition?.type === 'morph';
	return mount(PresentationTransitionOverlay, {
		props: {
			outgoingSlide: morph ? morphable('out', 10) : makeSlide('out'),
			incomingSlide: morph ? morphable('in', 400) : makeSlide('in'),
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			scale,
			transition,
		},
	});
}

describe('presentationTransitionOverlay', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders two slide-stage layers (outgoing + incoming)', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		expect(wrapper.findAll('.pptx-vue-stage')).toHaveLength(2);
		wrapper.unmount();
	});

	it('injects the transition keyframes once', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		const styles = wrapper.findAll('style');
		expect(styles).toHaveLength(1);
		expect(styles[0].text()).toContain('@keyframes pptx-tr-fade-in');
		wrapper.unmount();
	});

	it('applies the resolved animation shorthands to the layers', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		const layers = wrapper.findAll('.pptx-vue-transition-layer');
		expect(layers).toHaveLength(2);
		const [outgoing, incoming] = layers;
		expect(outgoing.attributes('style')).toContain('pptx-tr-fade-out');
		expect(incoming.attributes('style')).toContain('pptx-tr-fade-in');
		wrapper.unmount();
	});

	it('orders z-index so the incoming layer sits above for push', () => {
		const wrapper = mountOverlay({ type: 'push', durationMs: 300, direction: 'l' });
		const [outgoing, incoming] = wrapper.findAll('.pptx-vue-transition-layer');
		// push → outgoingOnTop: false, so incoming z-index (2) > outgoing (1).
		expect(outgoing.attributes('style')).toContain('z-index: 1');
		expect(incoming.attributes('style')).toContain('z-index: 2');
		wrapper.unmount();
	});

	it('emits done after the configured duration (+ buffer)', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		expect(wrapper.emitted('done')).toBeUndefined();
		vi.advanceTimersByTime(300 + 49);
		expect(wrapper.emitted('done')).toBeUndefined();
		vi.advanceTimersByTime(1);
		expect(wrapper.emitted('done')).toHaveLength(1);
		wrapper.unmount();
	});

	it('emits done quickly for an instant (cut) transition', () => {
		const wrapper = mountOverlay({ type: 'cut' });
		vi.advanceTimersByTime(50);
		expect(wrapper.emitted('done')).toHaveLength(1);
		wrapper.unmount();
	});

	it('uses the default duration when none is configured', () => {
		const wrapper = mountOverlay({ type: 'fade' });
		vi.advanceTimersByTime(1000 + 49);
		expect(wrapper.emitted('done')).toBeUndefined();
		vi.advanceTimersByTime(1);
		expect(wrapper.emitted('done')).toHaveLength(1);
		wrapper.unmount();
	});

	it('does not emit done after unmount', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		wrapper.unmount();
		vi.advanceTimersByTime(1000);
		expect(wrapper.emitted('done')).toBeUndefined();
	});

	// -------------------------------------------------------------------------
	// What a viewer actually SEES. Both regressions below shipped while every
	// structural assertion above still passed.
	// -------------------------------------------------------------------------

	it('paints no slide background on the morph departing layer', () => {
		const wrapper = mountOverlay({ type: 'morph', durationMs: 800 });
		const [outgoing, incoming] = wrapper.findAll('.pptx-vue-stage');
		// The departing shapes float over the incoming slide, so the layer has to
		// be see-through. `getSlideBackgroundStyle` always resolves to an OPAQUE
		// paint (it falls back to #ffffff), so inheriting it hid the whole morph
		// behind a flat slab for the entire transition.
		expect(wrapper.findAll('[data-pptx-morph-outgoing]')).not.toHaveLength(0);
		expect(outgoing.attributes('style')).toMatch(/background:\s*none transparent|transparent/u);
		expect(outgoing.attributes('style')).not.toContain('#ffffff');
		// The incoming layer is a real surface and keeps its background.
		expect(incoming.attributes('style')).toContain('background-color: #ffffff');
		wrapper.unmount();
	});

	it('keeps the slide background on a non-morph transition snapshot', () => {
		const wrapper = mountOverlay({ type: 'fade', durationMs: 300 });
		for (const stage of wrapper.findAll('.pptx-vue-stage')) {
			expect(stage.attributes('style')).toContain('background-color: #ffffff');
		}
		wrapper.unmount();
	});

	it('zooms a picture whose only change is its source crop', () => {
		// PowerPoint's "Scale Height"/"Scale Width" is an `a:srcRect` crop inside
		// an unchanged frame, so the two halves of this pair agree on position,
		// size, blip and every style: the morph engine saw an inert pair and the
		// picture cut between crops in a single frame (issue #148). The crop is
		// painted on the `<img>`, so the rule has to reach that node.
		const wrapper = mount(PresentationTransitionOverlay, {
			props: {
				outgoingSlide: rescaledPicture('out', { cropLeft: 0.05739, cropRight: 0.05739 }),
				incomingSlide: rescaledPicture('in', { cropLeft: 0.00356, cropRight: 0.00356 }),
				canvasSize,
				mediaDataUrls: new Map<string, string>(),
				scale: 1,
				transition: { type: 'morph', durationMs: 800 } as PptxSlideTransition,
			},
		});

		const css = wrapper
			.findAll('style')
			.map((node) => node.text())
			.join('\n');
		expect(css).toContain('[data-element-id="in-picture"] img { animation: pptx-morph-crop-');
		expect(css).toContain('@keyframes pptx-morph-crop-');
		wrapper.unmount();
	});

	it('stretches each transition layer to the overlay instead of shrink-wrapping it', () => {
		// jsdom has no layout engine, so this is asserted on the rule itself. The
		// stage inside a layer scales with `transform`, which never changes its
		// laid-out box: an auto-sized `top/left` layer therefore measures the
		// deck's NATIVE size and `overflow: hidden` crops the transition to that
		// corner of a larger display (1280x720 of a 1920x1080 show).
		const layerRule = /\.pptx-vue-transition-layer\s*\{([^}]*)\}/u.exec(overlaySource)?.[1] ?? '';
		expect(layerRule).toContain('position: absolute');
		expect(layerRule).toContain('overflow: hidden');
		expect(layerRule, 'a clipped layer must fill its overlay, not its content').toMatch(
			/inset:\s*0|width:\s*100%/u,
		);
		expect(layerRule).not.toMatch(/top:\s*0;\s*\n?\s*left:\s*0;/u);
	});

	// Regression (issue #146): the wheel deck's centre disc is identical on both
	// slides, so its opaque ghost sat over the title, body and button dissolving
	// in inside it - they were invisible until the overlay came down. The plan
	// hands those few over separately and the overlay must paint them, above
	// every ghost, from the INCOMING slide.
	it('paints the arriving shapes the plan lifted, above the departing layer', () => {
		const { from, to } = discAndWording();
		const wrapper = mount(PresentationTransitionOverlay, {
			props: {
				outgoingSlide: from,
				incomingSlide: to,
				canvasSize,
				mediaDataUrls: new Map<string, string>(),
				scale: 1,
				transition: { type: 'morph', durationMs: 800 } as PptxSlideTransition,
			},
		});

		const lifted = wrapper.find('[data-pptx-morph-lifted]');
		expect(lifted.exists()).toBeTruthy();
		expect(lifted.attributes('style')).toContain('z-index: 3');
		expect(lifted.html()).toContain('Multi-Domain Fusion');
		// Its copy on the incoming layer is held invisible, so the two never
		// composite with each other.
		const css = wrapper
			.findAll('style')
			.map((node) => node.element.textContent ?? '')
			.join('\n');
		expect(css).toContain('[data-pptx-morph-lifted] [data-element-id="in-wording"]');
		expect(css).toMatch(
			/\[data-pptx-morph-incoming\] \[data-element-id="in-wording"\] \{ animation: pptx-morph-lifted-hidden/u,
		);
		wrapper.unmount();
	});

	// Regression (issue #161): two fades stacked as ordinary layers composite
	// source-over, leaving the ink the halves SHARE at 0.75 of full strength
	// halfway through - measured 34.6/255 too dark on the wheel deck, which
	// bites chunks out of glyphs where the two line grids cross. PowerPoint's
	// own render keeps the blend coefficients summing to 1.0 for every frame, so
	// the pair is summed inside its own isolation group instead.
	it('paints a pair dissolving in place as one isolated, additive group', () => {
		const { from, to } = discAndReplacedWording();
		const wrapper = mount(PresentationTransitionOverlay, {
			props: {
				outgoingSlide: from,
				incomingSlide: to,
				canvasSize,
				mediaDataUrls: new Map<string, string>(),
				scale: 1,
				transition: { type: 'morph', durationMs: 800 } as PptxSlideTransition,
			},
		});

		const group = wrapper.find('[data-pptx-morph-crossfade="in-wording"]');
		expect(group.exists(), 'the pair must be rendered as its own group').toBeTruthy();
		expect(group.attributes('style')).toContain('isolation: isolate');
		// Above the ghost layer (2) and the lifted layer (3).
		expect(group.attributes('style')).toContain('z-index: 4');
		const halves = group.findAll('[data-pptx-transition-layer]');
		expect(halves).toHaveLength(2);
		for (const half of halves) {
			expect(half.attributes('style')).toContain('mix-blend-mode: plus-lighter');
		}
		expect(group.html()).toContain('Open Integration');
		expect(group.html()).toContain('Tactical Edge');
		// Painted exactly once: not left in the flat layers as well.
		expect(wrapper.html().match(/Open Integration/gu)).toHaveLength(1);
		wrapper.unmount();
	});
});
