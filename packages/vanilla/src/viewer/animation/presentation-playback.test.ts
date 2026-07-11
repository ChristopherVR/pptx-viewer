import type { PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPresentationPlayback } from './presentation-playback';

/** Build a stage node carrying `data-element-id` boxes for the given ids. */
function buildStage(doc: Document, ids: string[]): HTMLElement {
	const stage = doc.createElement('div');
	stage.className = 'pptxv-stage';
	for (const id of ids) {
		const box = doc.createElement('div');
		box.dataset.elementId = id;
		stage.appendChild(box);
	}
	return stage;
}

function slideWith(
	animations: PptxElementAnimation[],
	transition?: PptxSlide['transition'],
): PptxSlide {
	return { id: 's', elements: [], animations, transition } as unknown as PptxSlide;
}

function entrance(
	elementId: string,
	trigger: PptxElementAnimation['trigger'],
): PptxElementAnimation {
	return { elementId, entrance: 'fadeIn', trigger, durationMs: 400 };
}

describe('createPresentationPlayback', () => {
	let doc: Document;
	let stageWrap: HTMLElement;

	beforeEach(() => {
		doc = document;
		stageWrap = doc.createElement('div');
		doc.body.appendChild(stageWrap);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		stageWrap.remove();
		doc.getElementById('pptx-vanilla-presentation-keyframes')?.remove();
	});

	it('is inert when not presenting (no styles applied)', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			doc,
			stageWrap,
			stage,
			slide: slideWith([entrance('a', 'onClick')]),
			slideIndex: 0,
			presenting: false,
		});
		const el = stage.querySelector<HTMLElement>('[data-element-id="a"]');
		expect(el?.style.opacity).toBe('');
		expect(playback.advance()).toBeFalsy();
	});

	it('hides pending entrances at step 0 and reveals them on advance', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a', 'b']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			doc,
			stageWrap,
			stage,
			// Two separate click groups (both onClick).
			slide: slideWith([entrance('a', 'onClick'), entrance('b', 'onClick')]),
			slideIndex: 0,
			presenting: true,
		});
		const a = stage.querySelector<HTMLElement>('[data-element-id="a"]');
		const b = stage.querySelector<HTMLElement>('[data-element-id="b"]');
		// Both entrances pending -> hidden.
		expect(a?.style.opacity).toBe('0');
		expect(b?.style.opacity).toBe('0');

		// First advance reveals group 1 (element a): running animation, no longer hidden.
		expect(playback.advance()).toBeTruthy();
		expect(a?.style.animationName).toBeTruthy();
		expect(a?.style.opacity).toBe('');
		expect(b?.style.opacity).toBe('0');

		// Second advance reveals group 2 (element b).
		expect(playback.advance()).toBeTruthy();
		expect(b?.style.animationName).toBeTruthy();

		// Timeline exhausted -> advance reports false (caller should change slide).
		expect(playback.advance()).toBeFalsy();
	});

	it('folds withPrevious/afterPrevious into the preceding click group', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a', 'b']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			doc,
			stageWrap,
			stage,
			slide: slideWith([entrance('a', 'onClick'), entrance('b', 'withPrevious')]),
			slideIndex: 0,
			presenting: true,
		});
		// One click group only.
		expect(playback.advance()).toBeTruthy();
		const a = stage.querySelector<HTMLElement>('[data-element-id="a"]');
		const b = stage.querySelector<HTMLElement>('[data-element-id="b"]');
		expect(a?.style.animationName).toBeTruthy();
		expect(b?.style.animationName).toBeTruthy();
		expect(playback.advance()).toBeFalsy();
	});

	it('resets the step when the slide changes', () => {
		const playback = createPresentationPlayback();
		const stage0 = buildStage(doc, ['a']);
		stageWrap.appendChild(stage0);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage0,
			slide: slideWith([entrance('a', 'onClick')]),
			slideIndex: 0,
			presenting: true,
		});
		expect(playback.advance()).toBeTruthy();
		expect(playback.isComplete()).toBeTruthy();

		// New slide render -> step resets, its entrance hidden again.
		stageWrap.replaceChildren();
		const stage1 = buildStage(doc, ['c']);
		stageWrap.appendChild(stage1);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage1,
			slide: slideWith([entrance('c', 'onClick')]),
			slideIndex: 1,
			presenting: true,
		});
		const c = stage1.querySelector<HTMLElement>('[data-element-id="c"]');
		expect(c?.style.opacity).toBe('0');
		expect(playback.isComplete()).toBeFalsy();
	});

	it('plays a transition overlay on a mid-show slide change and clears it after the duration', () => {
		const playback = createPresentationPlayback();
		const stage0 = buildStage(doc, ['a']);
		stageWrap.appendChild(stage0);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage0,
			slide: slideWith([]),
			slideIndex: 0,
			presenting: true,
		});
		// No overlay on the initial enter.
		expect(stageWrap.querySelector('.pptxv-transition-overlay')).toBeNull();

		// Advance to a slide carrying a transition.
		stageWrap.replaceChildren();
		const stage1 = buildStage(doc, ['b']);
		stageWrap.appendChild(stage1);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage1,
			slide: slideWith([], { type: 'fade', durationMs: 300 }),
			slideIndex: 1,
			presenting: true,
		});
		const overlay = stageWrap.querySelector('.pptxv-transition-overlay');
		expect(overlay).not.toBeNull();
		// Two stacked layers (outgoing snapshot + incoming clone).
		expect(overlay?.querySelectorAll('.pptxv-transition-layer').length).toBe(2);

		// Overlay tears down after the duration (+ settle buffer).
		vi.advanceTimersByTime(400);
		expect(stageWrap.querySelector('.pptxv-transition-overlay')).toBeNull();
	});

	it('does not play a transition for a none/absent transition', () => {
		const playback = createPresentationPlayback();
		const stage0 = buildStage(doc, ['a']);
		stageWrap.appendChild(stage0);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage0,
			slide: slideWith([]),
			slideIndex: 0,
			presenting: true,
		});
		stageWrap.replaceChildren();
		const stage1 = buildStage(doc, ['b']);
		stageWrap.appendChild(stage1);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage1,
			slide: slideWith([]),
			slideIndex: 1,
			presenting: true,
		});
		expect(stageWrap.querySelector('.pptxv-transition-overlay')).toBeNull();
	});
});
