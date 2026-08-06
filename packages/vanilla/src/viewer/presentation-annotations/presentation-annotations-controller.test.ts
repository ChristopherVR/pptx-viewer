import type { PptxSlide } from 'pptx-viewer-core';
import { PRESENT_ANNOTATION_OVER_BLACKOUT_Z, PRESENT_ANNOTATION_Z } from 'pptx-viewer-shared';
import type { PresentationInkStroke } from 'pptx-viewer-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createPresentationAnnotationsController } from './presentation-annotations-controller';

const stroke: PresentationInkStroke = {
	id: 'stroke-1',
	slideIndex: 0,
	tool: 'pen',
	color: '#ff0000',
	width: 2.5,
	points: [
		{ x: 0.1, y: 0.2 },
		{ x: 0.5, y: 0.6 },
	],
};

function slide(id: string): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements: [] };
}

describe('createPresentationAnnotationsController', () => {
	beforeEach(() => document.body.replaceChildren());

	it('persists accepted temporary strokes through the shared ink converter', async () => {
		let slides = [slide('slide-1')];
		const commitSlides = vi.fn((next: PptxSlide[]) => (slides = next));
		const controller = createPresentationAnnotationsController({
			doc: document,
			t: createTranslator(),
			getSlides: () => slides,
			commitSlides,
		});
		const stageWrap = document.createElement('div');
		controller.syncStage({
			stageWrap,
			active: false,
			slideIndex: 0,
			canvasSize: { width: 1000, height: 500 },
			blackout: 'none',
		});
		controller.setStrokes([stroke]);

		const result = controller.finishPresentation();
		document.querySelector<HTMLButtonElement>('.pptxv-keep-annotations .is-primary')?.click();

		await expect(result).resolves.toBe('kept');
		expect(slides[0].elements).toHaveLength(1);
		expect(slides[0].elements[0]).toMatchObject({
			type: 'ink',
			inkTool: 'pen',
			inkColors: ['#ff0000'],
		});
		expect(commitSlides).toHaveBeenCalledOnce();
		expect(controller.hasAnnotations()).toBeFalsy();
	});

	it('discards temporary strokes without changing slides', async () => {
		const slides = [slide('slide-1')];
		const commitSlides = vi.fn();
		const controller = createPresentationAnnotationsController({
			doc: document,
			t: createTranslator(),
			getSlides: () => slides,
			commitSlides,
		});
		controller.setStrokes([stroke]);

		const result = controller.finishPresentation();
		const buttons = document.querySelectorAll<HTMLButtonElement>('.pptxv-keep-annotations button');
		buttons[0].click();

		await expect(result).resolves.toBe('discarded');
		expect(slides[0].elements).toHaveLength(0);
		expect(commitSlides).not.toHaveBeenCalled();
	});

	it('remounts the active tool overlay after a stage rebuild', () => {
		const controller = createPresentationAnnotationsController({
			doc: document,
			t: createTranslator(),
			getSlides: () => [slide('slide-1')],
			commitSlides: vi.fn(),
		});
		const first = document.createElement('div');
		controller.syncStage({
			stageWrap: first,
			active: true,
			slideIndex: 0,
			canvasSize: { width: 960, height: 540 },
			blackout: 'none',
			pointer: { tool: 'pen', x: 0.5, y: 0.5, color: '#ef4444' },
		});
		expect(first.querySelector('.pptxv-presentation-annotations')).not.toBeNull();

		const rebuilt = document.createElement('div');
		controller.syncStage({
			stageWrap: rebuilt,
			active: true,
			slideIndex: 0,
			canvasSize: { width: 960, height: 540 },
			blackout: 'none',
			pointer: { tool: 'eraser', x: 0.5, y: 0.5, color: '#ef4444' },
		});
		expect(first.querySelector('.pptxv-presentation-annotations')).toBeNull();
		expect(rebuilt.querySelector('.pptxv-presentation-annotations')).not.toBeNull();
	});

	it('keeps the overlay element across a pointer-position-only sync', () => {
		const controller = createPresentationAnnotationsController({
			doc: document,
			t: createTranslator(),
			getSlides: () => [slide('slide-1')],
			commitSlides: vi.fn(),
		});
		const stageWrap = document.createElement('div');
		const sync = (x: number): void =>
			controller.syncStage({
				stageWrap,
				active: true,
				slideIndex: 0,
				canvasSize: { width: 960, height: 540 },
				blackout: 'none',
				pointer: { tool: 'pen', x, y: 0.5, color: '#ef4444' },
			});
		sync(0.1);
		const overlay = stageWrap.querySelector('.pptxv-presentation-annotations');

		// A drag publishes its pointer position on every move, which syncs the
		// stage. Replacing the SVG here cancelled the pointer capture, so no
		// stroke ever completed and Clear stayed disabled through the whole show.
		sync(0.2);
		sync(0.3);
		expect(stageWrap.querySelector('.pptxv-presentation-annotations')).toBe(overlay);

		// A real change (tool, slide, colour, stage) still rebuilds it.
		controller.syncStage({
			stageWrap,
			active: true,
			slideIndex: 0,
			canvasSize: { width: 960, height: 540 },
			blackout: 'none',
			pointer: { tool: 'highlighter', x: 0.3, y: 0.5, color: '#ef4444' },
		});
		expect(stageWrap.querySelector('.pptxv-presentation-annotations')).not.toBe(overlay);
	});

	it('raises the overlay above the blackout sheet without remounting it', () => {
		const controller = createPresentationAnnotationsController({
			doc: document,
			t: createTranslator(),
			getSlides: () => [slide('slide-1')],
			commitSlides: vi.fn(),
		});
		const stageWrap = document.createElement('div');
		const sync = (blackout: 'none' | 'black' | 'white'): void =>
			controller.syncStage({
				stageWrap,
				active: true,
				slideIndex: 0,
				canvasSize: { width: 960, height: 540 },
				blackout,
				pointer: { tool: 'pen', x: 0.5, y: 0.5, color: '#ef4444' },
			});
		sync('none');
		const overlay = stageWrap.querySelector<SVGSVGElement>('.pptxv-presentation-annotations');
		expect(overlay?.hasAttribute('data-pptx-annotation-overlay')).toBeTruthy();
		expect(overlay?.style.zIndex).toBe(String(PRESENT_ANNOTATION_Z));

		// Blanking the screen lifts the ink above the blackout sheet (z 75) so the
		// "blackboard" strokes stay visible, without cutting off a live gesture.
		sync('black');
		expect(stageWrap.querySelector('.pptxv-presentation-annotations')).toBe(overlay);
		expect(overlay?.style.zIndex).toBe(String(PRESENT_ANNOTATION_OVER_BLACKOUT_Z));

		sync('none');
		expect(overlay?.style.zIndex).toBe(String(PRESENT_ANNOTATION_Z));
	});
});
