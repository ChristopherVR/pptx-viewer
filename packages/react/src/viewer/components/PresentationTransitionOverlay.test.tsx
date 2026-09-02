import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { buildMorphTransitionPlan } from 'pptx-viewer-shared';
import React from 'react';
/**
 * Wiring coverage for PresentationTransitionOverlay: it must inject the slide
 * transition `@keyframes` and apply the resolved CSS `animation` to the
 * outgoing-slide layer, so a real transition actually plays in Present mode
 * (the component was previously dead code, imported nowhere). Rendered with
 * `renderToStaticMarkup` (the package's node-env test convention); effect-driven
 * behaviour like the completion timer is covered by `slide-transition.test.ts`.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

import { PresentationTransitionOverlay } from './PresentationTransitionOverlay';

function makeSlide(): PptxSlide {
	return {
		id: 'outgoing-slide',
		elements: [
			{
				id: 'el-1',
				type: 'text',
				x: 20,
				y: 20,
				width: 400,
				height: 80,
				text: 'Outgoing Slide',
			} as unknown as PptxElement,
		],
	} as PptxSlide;
}

const fade: PptxSlideTransition = { type: 'fade', durationMs: 600 };

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * A full-slide backdrop picture: the frame is identical on both slides and only
 * the source crop differs, which is all PowerPoint's "Scale Height"/"Scale
 * Width" writes (issue #148). The blip differs too, so the pair crossfades and
 * the overlay actually paints a ghost to assert on.
 */
function backdropSlide(
	slideId: string,
	imagePath: string,
	crop: Record<string, number>,
): PptxSlide {
	return {
		id: slideId,
		elements: [
			{
				id: `${slideId}-picture`,
				type: 'picture',
				name: '!!Background',
				x: 0,
				y: 0,
				width: 960,
				height: 540,
				imagePath,
				imageData: PIXEL,
				...crop,
			} as unknown as PptxElement,
		],
	} as PptxSlide;
}

describe('presentationTransitionOverlay', () => {
	it('injects the transition keyframes so the animation resolves', () => {
		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={makeSlide()}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={fade}
				durationMs={600}
				onComplete={vi.fn()}
			/>,
		);
		expect(html).toContain('@keyframes pptx-tr-fade-out');
	});

	it('applies the resolved CSS animation to the outgoing layer', () => {
		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={makeSlide()}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={fade}
				durationMs={600}
				onComplete={vi.fn()}
			/>,
		);
		// The outgoing layer carries a real `animation` shorthand, not a bare swap.
		expect(html).toMatch(/animation:\s*pptx-tr-fade-out 600ms/u);
	});

	it('renders the outgoing slide content in the overlay', () => {
		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={makeSlide()}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={fade}
				durationMs={600}
				onComplete={vi.fn()}
			/>,
		);
		expect(html).toContain('Outgoing Slide');
	});

	// Regression: for classic transitions the overlay used to render ONLY the
	// outgoing layer, so a wipe (whose outgoing half is 'none') sat opaque for
	// the whole duration and the arriving slide - only ever the live stage
	// beneath - popped in the instant the overlay tore down. The arriving slide
	// has to be IN the overlay, carrying the incoming animation.
	it('renders the arriving slide carrying the incoming wipe animation', () => {
		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={makeSlide()}
				incomingSlide={{ ...makeSlide(), id: 'incoming-slide' }}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={{ type: 'wipe', durationMs: 600, direction: 'r' }}
				durationMs={600}
				onComplete={vi.fn()}
			/>,
		);
		expect(html).toMatch(/animation:\s*pptx-tr-wipe-from-left 600ms/u);
		expect(html).toContain('data-pptx-transition-layer="incoming"');
		// The arriving wording is painted by the overlay copy too (it is not
		// relying on the stage beneath, which the outgoing layer covers).
		expect(html).toContain('Outgoing Slide');
	});

	it('renders no static incoming layer for types that reveal the stage', () => {
		// Uncover animates the OUTGOING slide away; its incoming half is 'none'
		// precisely so the live stage is revealed. A static incoming layer here
		// would cover the animation.
		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={makeSlide()}
				incomingSlide={{ ...makeSlide(), id: 'incoming-slide' }}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={{ type: 'uncover', durationMs: 600, direction: 'l' }}
				durationMs={600}
				onComplete={vi.fn()}
			/>,
		);
		expect(html).not.toContain('data-pptx-transition-layer="incoming"');
	});

	// Regression (issue #106): the overlay used to measure itself in a mount
	// effect, so the FIRST painted frame scaled the outgoing slide by 1 while
	// the incoming slide was already at stage scale. On a 1080p display that is
	// a full-screen slide with a small unscaled one flashing over it for one
	// frame. `renderToStaticMarkup` runs no effects, so it reproduces exactly
	// that first frame.
	it('scales the outgoing slide on the first painted frame using the stage scale', () => {
		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={makeSlide()}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={fade}
				durationMs={600}
				scale={1.75}
				onComplete={vi.fn()}
			/>,
		);
		// The sized slide box, not some nested element transform.
		expect(html).toContain('width:960px;height:540px;flex-shrink:0;transform:scale(1.75)');
	});

	// Regression (issue #161): the slide box is centred with flexbox, so it is a
	// flex ITEM and shrinks to a container narrower than the deck's own canvas -
	// BEFORE the stage scale is applied. On a show surface narrower than the
	// canvas (a windowed show, or a display scaled past 125%) that painted the
	// whole outgoing slide up to 77px to the side of the incoming one for the
	// length of every transition, because the stage below positions its own
	// slide box absolutely and never shrinks.
	it.each([
		['a plain transition', undefined],
		['a morph', 'morph'],
	])('holds the outgoing slide box at the canvas width during %s', (_name, kind) => {
		const plan =
			kind === 'morph'
				? buildMorphTransitionPlan(makeSlide(), { ...makeSlide(), id: 'incoming-slide' }, 800)
				: undefined;
		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={makeSlide()}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={fade}
				durationMs={600}
				scale={0.5}
				morphPlan={plan}
				incomingSlide={{ ...makeSlide(), id: 'incoming-slide' }}
				onComplete={vi.fn()}
			/>,
		);
		expect(html).toContain('width:960px;height:540px;flex-shrink:0');
	});

	it('animates a ghost picture source crop on its <img>, not on the frame', () => {
		// The frame is the same box on both slides, so the crop has to ride the
		// `<img>` inside it. The other four bindings reach that node with a
		// descendant CSS rule; overlay copies here expose no `data-element-id`, so
		// the animation is passed down as a prop instead (issue #148).
		const plan = buildMorphTransitionPlan(
			backdropSlide('out', 'ppt/media/image9.png', { cropLeft: 0.05739, cropRight: 0.05739 }),
			backdropSlide('in', 'ppt/media/image20.png', { cropLeft: 0.00356, cropRight: 0.00356 }),
			800,
		)!;

		expect(plan.outgoingImageAnimations.get('out-picture')).toContain('pptx-morph-crop-ghost-');

		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={backdropSlide('out', 'ppt/media/image9.png', {
					cropLeft: 0.05739,
					cropRight: 0.05739,
				})}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={{ type: 'morph', durationMs: 800 }}
				durationMs={800}
				morphPlan={plan}
				onComplete={vi.fn()}
			/>,
		);

		expect(html).toContain('@keyframes pptx-morph-crop-ghost-');
		const img = /<img[^>]*style="([^"]*)"/u.exec(html)?.[1] ?? '';
		expect(img).toContain('animation:pptx-morph-crop-ghost-');
	});

	// Regression (issue #146): a shape arriving inside a shape that persists
	// dissolves in UNDER the overlay's ghost of that shape, so nobody ever sees
	// it. The plan hands those few over separately and the overlay has to paint
	// them, above every ghost, with the incoming slide as their context.
	it('paints the arriving shapes the plan lifted above the ghosts', () => {
		const disc = {
			type: 'shape',
			name: '!!Content',
			x: 0,
			y: 0,
			width: 300,
			height: 300,
			shapeStyle: { fillMode: 'solid', fillColor: '#27282A' },
		};
		// A departing backdrop is what keeps the unchanged disc's ghost painted,
		// exactly as the reporter's deck has it.
		const outgoing = {
			id: 'out',
			elements: [
				{
					id: 'out-backdrop',
					type: 'shape',
					name: 'Backdrop',
					x: 0,
					y: 0,
					width: 960,
					height: 540,
				} as unknown as PptxElement,
				{ ...disc, id: 'out-disc' } as unknown as PptxElement,
			],
		} as PptxSlide;
		const incoming = {
			id: 'in',
			elements: [
				{ ...disc, id: 'in-disc' } as unknown as PptxElement,
				{
					id: 'in-wording',
					type: 'text',
					name: 'TextBox 9',
					x: 50,
					y: 60,
					width: 200,
					height: 30,
					text: 'Arriving Wording',
				} as unknown as PptxElement,
			],
		} as PptxSlide;
		const plan = buildMorphTransitionPlan(outgoing, incoming, 500)!;
		expect(plan.overlayIncomingElements.map((element) => element.id)).toStrictEqual(['in-wording']);

		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={outgoing}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={{ type: 'morph', durationMs: 500 }}
				durationMs={500}
				morphPlan={plan}
				incomingSlide={incoming}
				onComplete={vi.fn()}
			/>,
		);

		expect(html).toContain('data-pptx-morph-lifted="in-wording"');
		expect(html).toContain('Arriving Wording');
		expect(html).toMatch(/animation:\s*pptx-morph-fadein-/u);
	});

	// Regression (issue #161): the two halves of a dissolve stacked as ordinary
	// layers composite source-over, which leaves the ink they SHARE at 0.75 of
	// full strength halfway through - measured 34.6/255 too dark on the wheel
	// deck, biting chunks out of glyphs the two line grids cross. PowerPoint's
	// own render holds the blend coefficients summing to 1.0 for every frame, so
	// the pair has to be summed inside its own isolation group.
	it('paints a pair dissolving in place as one isolated, additive group', () => {
		const disc = {
			type: 'shape',
			name: '!!Content',
			x: 0,
			y: 0,
			width: 300,
			height: 300,
			shapeStyle: { fillMode: 'solid', fillColor: '#27282A' },
		};
		const wording = (id: string, text: string): PptxElement =>
			({
				id,
				type: 'text',
				name: 'TextBox 6',
				// The identity that pairs two text boxes saying different things;
				// proximity alone deliberately refuses them (issue #131).
				shapeId: 7,
				x: 50,
				y: 60,
				width: 200,
				height: 30,
				text,
			}) as unknown as PptxElement;
		const outgoing = {
			id: 'out',
			elements: [
				{
					id: 'out-backdrop',
					type: 'shape',
					name: 'Backdrop',
					x: 0,
					y: 0,
					width: 960,
					height: 540,
				} as unknown as PptxElement,
				{ ...disc, id: 'out-disc' } as unknown as PptxElement,
				wording('out-wording', 'Open Integration'),
			],
		} as PptxSlide;
		const incoming = {
			id: 'in',
			elements: [
				{ ...disc, id: 'in-disc' } as unknown as PptxElement,
				wording('in-wording', 'Tactical Edge'),
			],
		} as PptxSlide;
		const plan = buildMorphTransitionPlan(outgoing, incoming, 500)!;
		expect(plan.crossfadeGroups.map((group) => group.incoming.id)).toStrictEqual(['in-wording']);

		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={outgoing}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={{ type: 'morph', durationMs: 500 }}
				durationMs={500}
				morphPlan={plan}
				incomingSlide={incoming}
				onComplete={vi.fn()}
			/>,
		);

		const group =
			/<div data-pptx-morph-crossfade="in-wording" style="([^"]*)">(.*?)Tactical Edge/su.exec(html);
		expect(group, 'the pair must be rendered as its own group').not.toBeNull();
		expect(group![1]).toContain('isolation:isolate');
		// Both halves inside it, blending only with each other, each carrying its
		// own dissolve on the WRAPPER: on the element it would take a compositing
		// layer whose raster snaps to whole device pixels and paints the wording
		// off the live stage.
		expect(group![2]).toContain('mix-blend-mode:plus-lighter');
		expect(group![2]).toMatch(/mix-blend-mode:plus-lighter;animation:[^"]*-fade/u);
		expect(group![2]).toContain('Open Integration');
		// And painted exactly once: not left in the flat layers as well.
		expect(html.match(/Open Integration/gu)).toHaveLength(1);
		expect(html.match(/Tactical Edge/gu)).toHaveLength(1);
	});

	it('ignores a non-positive stage scale and falls back to measuring', () => {
		const html = renderToStaticMarkup(
			<PresentationTransitionOverlay
				outgoingSlide={makeSlide()}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				transition={fade}
				durationMs={600}
				scale={0}
				onComplete={vi.fn()}
			/>,
		);
		expect(html).toContain('width:960px;height:540px;flex-shrink:0;transform:scale(1)');
	});
});
