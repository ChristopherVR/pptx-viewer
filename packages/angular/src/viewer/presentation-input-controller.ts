/**
 * presentation-input-controller.ts: turns raw keyboard and pointer events during
 * a slide show into show commands.
 *
 * PowerPoint's slide-show input rules are subtle and are the part of the overlay
 * most likely to be changed: a forward tap is gated by the slide's
 * `advanceOnClick` while a forward key press is not, an interactive shape
 * swallows the click that would otherwise advance, a drawing tool owns the
 * pointer outright, and an audience display must ignore its OWN input entirely
 * (its keyboard would move it off the presenter's slide, and the next snapshot
 * would drag it back, which reads as "the display refuses to advance").
 *
 * Those rules are pure decision logic over injected collaborators, so they live
 * here rather than in {@link PresentationOverlayComponent}, whose job is the
 * view. The component keeps only the `@HostListener` methods, which Angular
 * requires on the component class, and forwards to this controller.
 */
import type { PptxSlide } from 'pptx-viewer-core';

import {
	acceptsPresentationInput,
	createPresentationKeyBuffer,
	handlePresentationStageClick,
	mapPresentationKey,
} from '../internal/shared';
import type { AnimationPlaybackService } from './animation-playback.service';
import type { PresentationAnnotationsService } from './presentation-annotations.service';
import { requestPresentationFullscreen } from './presentation-fullscreen';
import { shouldBlockClickAdvance } from './presentation-overlay-helpers';
import type { PresentationShowNavigator } from './presentation-show-navigator';
import { closestElementId } from './presentation-stage-animator';
import type { PresenterWindowService } from './presenter-window.service';

/** Everything the input rules need from the overlay component. */
export interface PresentationInputDeps {
	slides: () => readonly PptxSlide[];
	currentSlide: () => PptxSlide | undefined;
	/** The overlay root, used to (re)enter real fullscreen on a body click. */
	root: () => HTMLElement | null | undefined;
	navigator: PresentationShowNavigator;
	playback: AnimationPlaybackService;
	annotations: PresentationAnnotationsService;
	presenterWindow: PresenterWindowService;
	/** PowerPoint's Ctrl+M: hide ink markup without discarding the strokes. */
	toggleInkMarkup: () => void;
	/** End the show; the component guards against double-closing. */
	requestClose: () => void;
}

export class PresentationInputController {
	/** Digit buffer backing PowerPoint's "type a slide number, then Enter" jump. */
	private readonly keyBuffer = createPresentationKeyBuffer();

	constructor(private readonly deps: PresentationInputDeps) {}

	/** Document-level key handling, so no focusable element is required. */
	handleKeyDown(event: KeyboardEvent): void {
		if (!acceptsPresentationInput()) {
			return;
		}
		const mapped = mapPresentationKey(event, this.keyBuffer);
		if (mapped.action === 'none') {
			return;
		}
		event.preventDefault();

		const { navigator, annotations } = this.deps;
		switch (mapped.action) {
			case 'next':
				navigator.navigate('next');
				break;
			case 'previous':
				navigator.navigate('prev');
				break;
			case 'first':
				navigator.navigate('first');
				break;
			case 'last':
				navigator.navigate('last');
				break;
			case 'goto': {
				const index = mapped.slideNumber - 1;
				if (index >= 0 && index < this.deps.slides().length) {
					navigator.goToSlide(index);
				}
				break;
			}
			case 'end':
				this.deps.requestClose();
				break;
			case 'pointerTool':
				// PowerPoint's Ctrl+A "arrow" is the plain pointer: no active tool.
				annotations.setTool(mapped.tool === 'arrow' ? 'none' : mapped.tool);
				break;
			case 'eraseAnnotations':
				annotations.clearAnnotations();
				break;
			case 'toggleInkMarkup':
				this.deps.toggleInkMarkup();
				break;
			case 'toggleBlackScreen':
				this.toggleBlank('black');
				break;
			case 'toggleWhiteScreen':
				this.toggleBlank('white');
				break;
			default:
				break;
		}
	}

	/** Left-click on the slide area advances to the next visible slide. */
	handleBodyClick(event: MouseEvent): void {
		if (typeof document !== 'undefined' && !document.fullscreenElement) {
			requestPresentationFullscreen(this.deps.root());
		}
		// button 0 = primary (left); right-click / middle-click are ignored.
		if (event.button !== 0) {
			return;
		}
		// A drawing tool owns pointer gestures; don't hijack them to advance.
		if (this.deps.annotations.tool() !== 'none') {
			return;
		}
		// Interactive (`onShapeClick`) trigger shape: play its sequence instead of
		// advancing the slide (mirrors the Vue `onFrameClick`).
		const id = closestElementId(event.target);
		if (id && this.deps.playback.interactiveTriggerShapeIds().has(id)) {
			if (this.deps.playback.handleInteractiveShapeClick(id)) {
				return;
			}
		}
		// An on-slide Action Setting (`a:hlinkClick`) outranks the advance:
		// PowerPoint follows the shape's link and leaves the show where the link
		// lands, rather than ALSO stepping to the next slide.
		if (this.handleActionClick(event.target) !== 'advance') {
			return;
		}
		this.advanceFromClick();
	}

	/**
	 * Run any on-slide action under the pointer, and report what the click left
	 * for the show: only `'advance'` reaches {@link advanceFromClick}.
	 */
	private handleActionClick(target: EventTarget | null): 'action' | 'advance' | 'inert' {
		return handlePresentationStageClick(
			target,
			this.deps.currentSlide(),
			{ slideCount: this.deps.slides().length },
			{
				goToSlide: (index) => this.deps.navigator.goToSlide(index),
				move: (direction) => this.deps.navigator.navigate(direction > 0 ? 'next' : 'prev'),
				endShow: () => this.deps.requestClose(),
			},
		);
	}

	/**
	 * Click/tap/swipe advance. Like every forward step it first reveals the
	 * current slide's next animation build; only once the builds are exhausted
	 * does it advance the slide, and then only when the slide's transition allows
	 * click-advance (advanceOnClick !== false). Keyboard and the on-screen
	 * next/prev buttons call navigate() directly and are never gated.
	 */
	advanceFromClick(): void {
		// An audience display never drives itself: a tap or swipe of its own would
		// move it off the presenter's slide, and the next snapshot would drag it back.
		if (!acceptsPresentationInput()) {
			return;
		}
		if (shouldBlockClickAdvance(this.deps.playback.isComplete(), this.deps.currentSlide())) {
			return;
		}
		this.deps.navigator.navigate('next');
	}

	/** Toggle PowerPoint's blank black/white screen (B/W, or `.`/`,`). */
	private toggleBlank(value: 'black' | 'white'): void {
		const current = this.deps.presenterWindow.snapshot().blackout;
		this.deps.presenterWindow.updateSnapshot({ blackout: current === value ? 'none' : value });
	}
}
