import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
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
		expect(html).toContain('width:960px;height:540px;transform:scale(1.75)');
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
		expect(html).toContain('width:960px;height:540px;transform:scale(1)');
	});
});
