// @vitest-environment happy-dom
/**
 * PowerPoint's "On Mouse Click" advance on the slide-show surface.
 *
 * The dedicated presentation stage shipped without any click handling at all,
 * so a running show could only be driven from the keyboard: every click on the
 * slide did nothing, which reads to a presenter as a slide show that is simply
 * broken. These tests pin that the surface is click-driven and that a click on
 * live slide content (a hyperlink, an action shape) is NOT also an advance.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { isPresentationAdvanceClick } from 'pptx-viewer-shared';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { PresentationStage } = await import('./PresentationStage');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function makeSlide(): PptxSlide {
	return {
		id: 'ppt/slides/slide2.xml',
		elements: [
			{
				id: 'ppt/slides/slide2.xml-shape-0',
				type: 'text',
				x: 10,
				y: 10,
				width: 200,
				height: 60,
				text: 'Hello',
			} as unknown as PptxElement,
		],
	} as PptxSlide;
}

function renderStage(onStageClick: (event: React.MouseEvent) => void): void {
	act(() =>
		root.render(
			<PresentationStage
				activeSlide={makeSlide()}
				templateElements={[]}
				canvasSize={{ width: 960, height: 540 }}
				mediaDataUrls={new Map<string, string>()}
				onStageClick={onStageClick}
			/>,
		),
	);
}

describe('presentationStage click-to-advance', () => {
	it('reports a click on the show surface', () => {
		const onStageClick = vi.fn();
		renderStage(onStageClick);

		const stage = container.querySelector<HTMLElement>('[data-pptx-presentation-stage]');
		expect(stage, 'the stage renders a show surface').not.toBeNull();
		act(() => {
			stage?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(onStageClick).toHaveBeenCalledOnce();
	});

	it('reports a click that lands on inert slide content', () => {
		const onStageClick = vi.fn();
		renderStage(onStageClick);

		// The whole point: a click on the slide itself, not the letterbox, is what
		// a presenter actually does, and it must reach the advance.
		const element = container.querySelector<HTMLElement>(
			'[data-element-id="ppt/slides/slide2.xml-shape-0"]',
		);
		expect(element, 'the slide element renders on the stage').not.toBeNull();
		act(() => {
			element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(onStageClick).toHaveBeenCalledOnce();
		// ... and the shared target rule agrees it is an advance, not an interaction.
		expect(isPresentationAdvanceClick(element)).toBeTruthy();
	});
});
