import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { playTransitionOverlay } from './transition-overlay';

/**
 * What a viewer actually SEES during a slide change.
 *
 * Two regressions shipped here while every structural assertion still passed,
 * because the animations really were running: the layers existed, the keyframes
 * existed, and a human on a 1920x1080 display still saw a flicker and a cut.
 */

function buildStage(doc: Document, ids: string[]): HTMLElement {
	const stage = doc.createElement('div');
	stage.className = 'pptxv-stage';
	// What `renderSlideStage` paints: the resolved (always opaque) slide fill.
	stage.style.backgroundColor = 'rgb(255, 255, 255)';
	for (const id of ids) {
		const box = doc.createElement('div');
		box.dataset.elementId = id;
		stage.appendChild(box);
	}
	return stage;
}

/** One pairable shape per slide, so `buildMorphTransitionPlan` returns a plan. */
function morphSlide(id: string, x: number): PptxSlide {
	return {
		id,
		elements: [
			{
				id: `${id}-shape`,
				type: 'shape',
				name: 'Rectangle 1',
				x,
				y: 10,
				width: 100,
				height: 50,
				shapeType: 'rect',
			},
		],
	} as unknown as PptxSlide;
}

/** A full-slide picture whose frame never moves and whose source crop does. */
function rescaledPictureSlide(id: string, crop: Record<string, number>): PptxSlide {
	return {
		id,
		elements: [
			{
				id: `${id}-picture`,
				type: 'picture',
				name: '!!Background',
				x: 0,
				y: 0,
				width: 960,
				height: 540,
				imagePath: 'ppt/media/image9.png',
				...crop,
			},
		],
	} as unknown as PptxSlide;
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
		from: {
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
				},
				{ ...disc, id: 'out-disc' },
			],
		} as unknown as PptxSlide,
		to: {
			id: 'in',
			elements: [
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
			],
		} as unknown as PptxSlide,
	};
}

describe('playTransitionOverlay', () => {
	let doc: Document;
	let stageWrap: HTMLElement;

	beforeEach(() => {
		vi.useFakeTimers();
		doc = document;
		stageWrap = doc.createElement('div');
		doc.body.appendChild(stageWrap);
	});

	afterEach(() => {
		vi.useRealTimers();
		stageWrap.remove();
	});

	function play(
		transition: PptxSlideTransition,
		morph = false,
	): { outgoing: HTMLElement; incoming: HTMLElement; cancel: () => void } {
		const outgoing = buildStage(doc, ['out-shape']);
		const incoming = buildStage(doc, ['in-shape']);
		const cancel = playTransitionOverlay({
			doc,
			stageWrap,
			outgoing,
			incoming,
			transition,
			outgoingSlide: morph ? morphSlide('out', 10) : undefined,
			incomingSlide: morph ? morphSlide('in', 400) : undefined,
			onDone: vi.fn(),
		});
		return { outgoing, incoming, cancel };
	}

	it('stretches each layer to the overlay instead of shrink-wrapping its content', () => {
		// The stage inside a layer scales with a CSS `transform`, which never
		// changes its laid-out box: an auto-sized `top`/`left` layer therefore
		// measures the deck's NATIVE size, and `overflow: hidden` then crops the
		// transition to that corner of a larger display (1280x720 of a 1920x1080
		// show). jsdom has no layout engine, so the declaration is asserted.
		const { cancel } = play({ type: 'fade', durationMs: 300 } as PptxSlideTransition);
		const layers = [...stageWrap.querySelectorAll<HTMLElement>('.pptxv-transition-layer')];
		expect(layers).toHaveLength(2);
		for (const layer of layers) {
			expect(layer.style.position).toBe('absolute');
			expect(layer.style.overflow).toBe('hidden');
			// jsdom keeps the authored `0`; a browser normalises it to `0px`. A
			// regression to `top`/`left` alone leaves `inset` empty and fails here.
			expect(['0', '0px'], 'a clipped layer must fill its overlay, not its content').toContain(
				layer.style.inset,
			);
		}
		cancel();
	});

	it('paints no slide background on the morph departing layer', () => {
		const { outgoing, incoming, cancel } = play(
			{ type: 'morph', durationMs: 800 } as PptxSlideTransition,
			true,
		);
		expect(stageWrap.querySelector('[data-pptx-morph-outgoing]')).not.toBeNull();
		// The departing snapshot only carries the morphing shapes and sits ABOVE
		// the incoming slide, so it has to be see-through. Its own (always opaque)
		// slide background otherwise covered the whole morph with a flat slab.
		expect(outgoing.style.backgroundColor).toBe('transparent');
		// The incoming layer is a real surface and keeps its background.
		expect(incoming.style.backgroundColor).toBe('rgb(255, 255, 255)');
		cancel();
	});

	it('zooms a picture whose only change is its source crop', () => {
		// PowerPoint's "Scale Height"/"Scale Width" is an `a:srcRect` crop inside
		// an unchanged frame, so both halves of this pair agree on position, size,
		// blip and style: the engine saw an inert pair and the picture cut between
		// crops in a single frame (issue #148). The crop is painted on the `<img>`,
		// so the rule has to reach that node and not the element container.
		const cancel = playTransitionOverlay({
			doc,
			stageWrap,
			outgoing: buildStage(doc, ['out-picture']),
			incoming: buildStage(doc, ['in-picture']),
			transition: { type: 'morph', durationMs: 800 } as PptxSlideTransition,
			outgoingSlide: rescaledPictureSlide('out', { cropLeft: 0.05739, cropRight: 0.05739 }),
			incomingSlide: rescaledPictureSlide('in', { cropLeft: 0.00356, cropRight: 0.00356 }),
			onDone: vi.fn(),
		});

		const css = [...stageWrap.querySelectorAll('style')].map((node) => node.textContent).join('\n');
		expect(css).toContain('[data-element-id="in-picture"] img { animation: pptx-morph-crop-');
		expect(css).toContain('@keyframes pptx-morph-crop-');
		cancel();
	});

	// Regression (issue #146): the wheel deck's centre disc is identical on both
	// slides, so its opaque ghost sat over the wording dissolving in inside it -
	// invisible until the overlay came down. The plan hands those few over
	// separately and the overlay must paint them above every ghost.
	it('paints the arriving shapes the plan lifted, above the departing layer', () => {
		const outgoing = buildStage(doc, ['out-backdrop', 'out-disc']);
		const incoming = buildStage(doc, ['in-disc', 'in-wording']);
		const cancel = playTransitionOverlay({
			doc,
			stageWrap,
			outgoing,
			incoming,
			transition: { type: 'morph', durationMs: 800 } as PptxSlideTransition,
			outgoingSlide: discAndWording().from,
			incomingSlide: discAndWording().to,
			onDone: vi.fn(),
		});

		const lifted = stageWrap.querySelector<HTMLElement>('[data-pptx-morph-lifted]');
		expect(lifted).not.toBeNull();
		expect(lifted!.style.zIndex).toBe('3');
		// The clone is stripped to exactly what the plan lifted.
		expect(lifted!.querySelector('[data-element-id="in-wording"]')).not.toBeNull();
		expect(lifted!.querySelector('[data-element-id="in-disc"]')).toBeNull();

		const css = [...stageWrap.querySelectorAll('style')].map((node) => node.textContent).join('\n');
		expect(css).toContain('[data-pptx-morph-lifted] [data-element-id="in-wording"]');
		expect(css).toMatch(
			/\[data-pptx-morph-incoming\] \[data-element-id="in-wording"\] \{ animation: pptx-morph-lifted-hidden/u,
		);
		cancel();
	});

	// Regression: the plan names elements at whatever level the morph matched
	// them, so a ghost can be a whole GROUP (the wheel deck's centre panel
	// dissolves as one object). Sparing only the named node and its ancestors
	// stripped that group's children and the departing layer painted an empty
	// box, so the old panel simply never appeared.
	it('keeps the contents of a ghost that is itself a group', () => {
		// A group whose cast changed dissolves as ONE object, so the plan names the
		// group and the snapshot has to keep everything inside it.
		const panel = (id: string, children: unknown[]): unknown => ({
			id,
			type: 'group',
			name: '!!Circle',
			x: 505,
			y: 225,
			width: 270,
			height: 270,
			children,
		});
		const disc = (id: string): unknown => ({
			id,
			type: 'shape',
			name: '!!Content',
			x: 0,
			y: 0,
			width: 270,
			height: 270,
			shapeStyle: { fillMode: 'solid', fillColor: '#27282A' },
		});
		const outgoingSlide = {
			id: 'out',
			elements: [
				panel('out-group', [
					disc('out-disc'),
					{
						id: 'out-line',
						type: 'text',
						x: 28,
						y: 121,
						width: 214,
						height: 28,
						text: 'Select Challenge',
					},
				]),
			],
		} as unknown as PptxSlide;
		const incomingSlide = {
			id: 'in',
			elements: [
				panel('in-group', [
					disc('in-disc'),
					{
						id: 'in-a',
						type: 'text',
						x: 28,
						y: 61,
						width: 214,
						height: 29,
						text: 'Multi-Domain Fusion',
					},
					{
						id: 'in-b',
						type: 'text',
						x: 41,
						y: 95,
						width: 193,
						height: 36,
						text: 'Combining data',
					},
				]),
			],
		} as unknown as PptxSlide;

		const outgoing = doc.createElement('div');
		outgoing.className = 'pptxv-stage';
		const groupNode = doc.createElement('div');
		groupNode.dataset.elementId = 'out-group';
		const childNode = doc.createElement('div');
		childNode.dataset.elementId = 'out-disc';
		groupNode.appendChild(childNode);
		const strayNode = doc.createElement('div');
		strayNode.dataset.elementId = 'out-stray';
		outgoing.append(groupNode, strayNode);

		const cancel = playTransitionOverlay({
			doc,
			stageWrap,
			outgoing,
			incoming: buildStage(doc, ['in-group']),
			transition: { type: 'morph', durationMs: 800 } as PptxSlideTransition,
			outgoingSlide,
			incomingSlide,
			onDone: vi.fn(),
		});

		expect(outgoing.querySelector('[data-element-id="out-group"]')).not.toBeNull();
		expect(outgoing.querySelector('[data-element-id="out-disc"]')).not.toBeNull();
		// Anything the plan did not name still goes.
		expect(outgoing.querySelector('[data-element-id="out-stray"]')).toBeNull();
		cancel();
	});

	it('keeps the slide background on a non-morph transition snapshot', () => {
		const { outgoing, incoming, cancel } = play({
			type: 'fade',
			durationMs: 300,
		} as PptxSlideTransition);
		expect(outgoing.style.backgroundColor).toBe('rgb(255, 255, 255)');
		expect(incoming.style.backgroundColor).toBe('rgb(255, 255, 255)');
		cancel();
	});
});
