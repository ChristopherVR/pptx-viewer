import type { PptxElement, PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { playAnimationSound, stopAnimationSound } from './animation-sound';
import { createPresentationPlayback } from './presentation-playback';

vi.mock(import('./animation-sound'), () => ({
	playAnimationSound: vi.fn(),
	stopAnimationSound: vi.fn(),
}));

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

function shapeElement(id: string): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 100, height: 100 } as unknown as PptxElement;
}

function slideWith(
	elements: PptxElement[],
	nativeAnimations?: PptxNativeAnimation[],
	transition?: PptxSlide['transition'],
): PptxSlide {
	return { id: 's', elements, nativeAnimations, transition } as unknown as PptxSlide;
}

function entrance(targetId: string, trigger: PptxNativeAnimation['trigger']): PptxNativeAnimation {
	return {
		targetId,
		presetClass: 'entr',
		trigger,
		durationMs: 400,
	} as unknown as PptxNativeAnimation;
}

describe('createPresentationPlayback (native-timing controller)', () => {
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
		doc.getElementById('pptx-vanilla-slide-keyframes')?.remove();
	});

	it('is inert when not presenting (no styles applied)', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			doc,
			stageWrap,
			stage,
			slide: slideWith([shapeElement('a')], [entrance('a', 'onClick')]),
			slideIndex: 0,
			presenting: false,
		});
		const el = stage.querySelector<HTMLElement>('[data-element-id="a"]');
		expect(el?.style.visibility).toBe('');
		expect(playback.advance()).toBeFalsy();
	});

	it('does not hide or step builds when presentation animations are disabled', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			doc,
			stageWrap,
			stage,
			slide: slideWith([shapeElement('a')], [entrance('a', 'onClick')]),
			slideIndex: 0,
			presenting: true,
			showWithAnimation: false,
		});

		expect(stage.querySelector<HTMLElement>('[data-element-id="a"]')?.style.visibility).toBe('');
		expect(playback.advance()).toBeFalsy();
	});

	it('hides pending entrances at seed and reveals them on advance', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a', 'b']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			doc,
			stageWrap,
			stage,
			// Two separate click groups (both onClick).
			slide: slideWith(
				[shapeElement('a'), shapeElement('b')],
				[entrance('a', 'onClick'), entrance('b', 'onClick')],
			),
			slideIndex: 0,
			presenting: true,
		});
		const a = stage.querySelector<HTMLElement>('[data-element-id="a"]');
		const b = stage.querySelector<HTMLElement>('[data-element-id="b"]');
		// Both entrances pending -> hidden.
		expect(a?.style.visibility).toBe('hidden');
		expect(b?.style.visibility).toBe('hidden');

		// First advance reveals group 1 (element a): running animation, now visible.
		expect(playback.advance()).toBeTruthy();
		expect(a?.style.animation).toBeTruthy();
		expect(a?.style.visibility).toBe('');
		expect(b?.style.visibility).toBe('hidden');

		// Second advance reveals group 2 (element b).
		expect(playback.advance()).toBeTruthy();
		expect(b?.style.animation).toBeTruthy();

		// Timeline exhausted -> advance reports false (caller should change slide).
		expect(playback.advance()).toBeFalsy();
	});

	it('a second advance inside a nextAc="seek" group fast-forwards it instead of skipping ahead', () => {
		const seekAnim = (targetId: string): PptxNativeAnimation =>
			({
				targetId,
				presetClass: 'entr',
				trigger: 'onClick',
				durationMs: 5000,
				seqNextAction: 'seek',
			}) as unknown as PptxNativeAnimation;
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a', 'b']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			doc,
			stageWrap,
			stage,
			slide: slideWith([shapeElement('a'), shapeElement('b')], [seekAnim('a'), seekAnim('b')]),
			slideIndex: 0,
			presenting: true,
		});
		const a = stage.querySelector<HTMLElement>('[data-element-id="a"]');
		const b = stage.querySelector<HTMLElement>('[data-element-id="b"]');

		expect(playback.advance()).toBeTruthy();
		expect(a?.style.animation).toBeTruthy();

		// Mid-flight: the click is consumed by finishing `a`, and `b` stays hidden.
		expect(playback.advance()).toBeTruthy();
		expect(a?.style.visibility).toBe('');
		expect(a?.style.animation).toBeFalsy();
		expect(b?.style.visibility).toBe('hidden');
		expect(playback.isComplete()).toBeFalsy();

		// Settled: the next click starts group two.
		expect(playback.advance()).toBeTruthy();
		expect(b?.style.animation).toBeTruthy();
		expect(playback.isComplete()).toBeTruthy();
	});

	it('folds withPrevious into the preceding click group', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a', 'b']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			doc,
			stageWrap,
			stage,
			slide: slideWith(
				[shapeElement('a'), shapeElement('b')],
				[entrance('a', 'onClick'), entrance('b', 'withPrevious')],
			),
			slideIndex: 0,
			presenting: true,
		});
		// One click group only.
		expect(playback.advance()).toBeTruthy();
		const a = stage.querySelector<HTMLElement>('[data-element-id="a"]');
		const b = stage.querySelector<HTMLElement>('[data-element-id="b"]');
		expect(a?.style.animation).toBeTruthy();
		expect(b?.style.animation).toBeTruthy();
		expect(playback.advance()).toBeFalsy();
	});

	it('resets the timeline when the slide changes', () => {
		const playback = createPresentationPlayback();
		const stage0 = buildStage(doc, ['a']);
		stageWrap.appendChild(stage0);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage0,
			slide: slideWith([shapeElement('a')], [entrance('a', 'onClick')]),
			slideIndex: 0,
			presenting: true,
		});
		expect(playback.advance()).toBeTruthy();
		expect(playback.isComplete()).toBeTruthy();

		// New slide render -> timeline resets, its entrance hidden again.
		stageWrap.replaceChildren();
		const stage1 = buildStage(doc, ['c']);
		stageWrap.appendChild(stage1);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage1,
			slide: slideWith([shapeElement('c')], [entrance('c', 'onClick')]),
			slideIndex: 1,
			presenting: true,
		});
		const c = stage1.querySelector<HTMLElement>('[data-element-id="c"]');
		expect(c?.style.visibility).toBe('hidden');
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
			slide: slideWith([], undefined, { type: 'fade', durationMs: 300 }),
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

	it('keeps a pending auto-play alive when the same slide re-renders', () => {
		// A deck whose first click step auto-starts (PowerPoint "With Previous")
		// schedules its reveal on a timer. Re-rendering the stage mid-delay (resize,
		// chrome hiding) must NOT cancel that timer, or the build never runs.
		const playback = createPresentationPlayback();
		const auto = {
			...entrance('a', 'withPrevious'),
			groupAutoStart: true,
			delayMs: 1000,
		} as unknown as PptxNativeAnimation;
		const slide = slideWith([shapeElement('a')], [auto]);

		const stage0 = buildStage(doc, ['a']);
		stageWrap.appendChild(stage0);
		playback.syncStage({ doc, stageWrap, stage: stage0, slide, slideIndex: 0, presenting: true });
		expect(stage0.querySelector<HTMLElement>('[data-element-id="a"]')?.style.visibility).toBe(
			'hidden',
		);

		// Same slide, rebuilt stage, still inside the 1s auto-start delay.
		stageWrap.replaceChildren();
		const stage1 = buildStage(doc, ['a']);
		stageWrap.appendChild(stage1);
		playback.syncStage({ doc, stageWrap, stage: stage1, slide, slideIndex: 0, presenting: true });

		vi.advanceTimersByTime(50);
		expect(stage1.querySelector<HTMLElement>('[data-element-id="a"]')?.style.visibility).toBe('');
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

	it('replays the leaving slide transition on a backward step', () => {
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

		// Forward to slide 1, which carries a fade transition.
		stageWrap.replaceChildren();
		const stage1 = buildStage(doc, ['b']);
		stageWrap.appendChild(stage1);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage1,
			slide: slideWith([], undefined, { type: 'fade', durationMs: 300 }),
			slideIndex: 1,
			presenting: true,
		});

		// Step back onto slide 0 (no transition of its own): the LEAVING slide's
		// fade replays in reverse, so an overlay is still mounted.
		stageWrap.replaceChildren();
		const stage0b = buildStage(doc, ['a']);
		stageWrap.appendChild(stage0b);
		playback.syncStage({
			doc,
			stageWrap,
			stage: stage0b,
			slide: slideWith([]),
			slideIndex: 0,
			presenting: true,
		});
		expect(stageWrap.querySelector('.pptxv-transition-overlay')).not.toBeNull();
	});
});

describe('createPresentationPlayback transition sound (p:sndAc/p:stSnd, p:endSnd)', () => {
	let doc: Document;
	let stageWrap: HTMLElement;

	beforeEach(() => {
		doc = document;
		stageWrap = doc.createElement('div');
		doc.body.appendChild(stageWrap);
		vi.useFakeTimers();
		vi.mocked(playAnimationSound).mockClear();
		vi.mocked(stopAnimationSound).mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
		stageWrap.remove();
		doc.getElementById('pptx-vanilla-presentation-keyframes')?.remove();
		doc.getElementById('pptx-vanilla-slide-keyframes')?.remove();
	});

	it('resolves the transition sound path through mediaDataUrls and plays it', () => {
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
			slide: slideWith([], undefined, {
				type: 'fade',
				durationMs: 300,
				soundPath: 'ppt/media/media3.wav',
				soundLoop: true,
			}),
			slideIndex: 1,
			presenting: true,
			mediaDataUrls: new Map([['ppt/media/media3.wav', 'blob:sound']]),
		});
		expect(playAnimationSound).toHaveBeenCalledWith('blob:sound', true);
	});

	it('stops the current sound for p:endSndAc (transition.stopSound), with no visible overlay', () => {
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
			// `type: 'none'` mounts no overlay, but the stop action must still fire.
			slide: slideWith([], undefined, { type: 'none', stopSound: true }),
			slideIndex: 1,
			presenting: true,
		});
		expect(stageWrap.querySelector('.pptxv-transition-overlay')).toBeNull();
		expect(stopAnimationSound).toHaveBeenCalledWith();
		expect(playAnimationSound).not.toHaveBeenCalled();
	});

	it('stops a looping sound when the show ends (leaving presenting mode)', () => {
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
		vi.mocked(stopAnimationSound).mockClear();

		playback.syncStage({
			doc,
			stageWrap,
			stage: stage0,
			slide: slideWith([]),
			slideIndex: 0,
			presenting: false,
		});
		expect(stopAnimationSound).toHaveBeenCalledWith();
	});

	// G13: an `onStopAudio`-gated effect should start from the REAL `<audio>`
	// element's `ended` event, not only the estimated `delayMs` baked into its
	// cssAnimation at build time.
	it('gates an onStopAudio-dependent effect on the real media ended event', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['el1']);
		// `findMediaElementByElementId` matches either the wrapper itself or a
		// nested `<video>`/`<audio>`, mirroring how a real media element renders.
		const audioWrapper = doc.createElement('div');
		audioWrapper.dataset.elementId = 'audio1';
		const audio = doc.createElement('audio');
		audioWrapper.appendChild(audio);
		stage.appendChild(audioWrapper);
		stageWrap.appendChild(stage);

		const mediaAnim: PptxNativeAnimation = {
			targetId: 'audio1',
			nodeId: 5,
			kind: 'media',
			presetClass: 'entr',
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation;
		const dependentAnim: PptxNativeAnimation = {
			targetId: 'el1',
			presetClass: 'entr',
			trigger: 'afterPrevious',
			startConditions: [{ event: 'onStopAudio', delay: 0, targetTimeNodeId: 5 }],
		} as unknown as PptxNativeAnimation;

		playback.syncStage({
			doc,
			stageWrap,
			stage,
			slide: slideWith([shapeElement('audio1'), shapeElement('el1')], [mediaAnim, dependentAnim]),
			slideIndex: 0,
			presenting: true,
		});
		expect(playback.advance()).toBeTruthy();

		const el1 = stage.querySelector<HTMLElement>('[data-element-id="el1"]');
		const before = el1?.style.animation;
		expect(before).toBeTruthy();

		audio.dispatchEvent(new Event('ended'));
		expect(el1?.style.animation).toContain(' 0ms ');
	});
});

describe('createPresentationPlayback geometry/theme render context wiring', () => {
	let doc: Document;
	let stageWrap: HTMLElement;

	beforeEach(() => {
		doc = document;
		stageWrap = doc.createElement('div');
		doc.body.appendChild(stageWrap);
	});

	afterEach(() => {
		stageWrap.remove();
		doc.getElementById('pptx-vanilla-presentation-keyframes')?.remove();
		doc.getElementById('pptx-vanilla-slide-keyframes')?.remove();
	});

	// Grow And Turn's own ground-truth markup: `from="(-#ppt_w/2)" to="(#ppt_x)"`
	// on a `ppt_x` attribute animation (see animation-ppt-formula-ground-truth.md).
	function growAndTurnAnim(targetId: string): PptxNativeAnimation {
		return {
			attributeAnimations: [
				{ attrName: 'ppt_x', from: '(-#ppt_w/2)', keyframes: [], to: '(#ppt_x)' },
			],
			durationMs: 600,
			presetClass: 'entr',
			targetId,
			trigger: 'onClick',
		} as unknown as PptxNativeAnimation;
	}

	function boxedShapeElement(id: string): PptxElement {
		return { height: 100, id, type: 'shape', width: 200, x: 200, y: 150 } as unknown as PptxElement;
	}

	function slideKeyframesCss(): string {
		return doc.getElementById('pptx-vanilla-slide-keyframes')?.textContent ?? '';
	}

	it('resolves the cross-axis fly-in formula when canvasSize is passed through syncStage', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			canvasSize: { height: 720, width: 960 },
			doc,
			presenting: true,
			slide: slideWith([boxedShapeElement('a')], [growAndTurnAnim('a')]),
			slideIndex: 0,
			stage,
			stageWrap,
		});
		// centre x = (200 + 200/2) / 960 = 0.3125; from = -100/960 = -0.104167;
		// delta = -0.104167 - 0.3125 = -0.416667 -> formatted to 4dp.
		expect(slideKeyframesCss()).toContain('-0.4167');
	});

	it('falls back to canned timing when canvasSize is not passed', () => {
		const playback = createPresentationPlayback();
		const stage = buildStage(doc, ['a']);
		stageWrap.appendChild(stage);
		playback.syncStage({
			doc,
			presenting: true,
			slide: slideWith([boxedShapeElement('a')], [growAndTurnAnim('a')]),
			slideIndex: 0,
			stage,
			stageWrap,
		});
		expect(slideKeyframesCss()).not.toContain('-0.4167');
	});
});
