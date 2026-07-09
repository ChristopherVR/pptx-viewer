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
});
