import type { PptxSlide } from 'pptx-viewer-core';
import type { BuildRafHandle, ElementAnimationState, PlaybackContext } from 'pptx-viewer-shared';
import {
	advanceMainSequence,
	applySlideTransitionSound,
	clearPlaybackTimers,
	createActiveAnimationGroup,
	playGroup,
	PresentationAnimationController,
	resolveMediaTimeNodeElementIds,
	scheduleAutoAdvanceChain,
} from 'pptx-viewer-shared';

import {
	applyElementAnimationStyles,
	ensurePresentationKeyframes,
	injectSlideKeyframes,
} from './animation-dom';
import { playAnimationSound, stopAnimationSound } from './animation-sound';
import { attachTriggerListeners } from './presentation-triggers';
import { playTransitionOverlay } from './transition-overlay';

/** Everything the controller needs after a stage (re)render. */
export interface SyncStageParams {
	doc: Document;
	/** The stage host (position: relative), for layering a transition overlay. */
	stageWrap: HTMLElement;
	/** The freshly rendered, fully-visible main stage node. */
	stage: HTMLElement;
	/** The slide the stage renders, or `undefined` when empty. */
	slide: PptxSlide | undefined;
	/** Zero-based index of the rendered slide. */
	slideIndex: number;
	/** True only when the live (fullscreen) presentation stage is active. */
	presenting: boolean;
	/** Presentation-level switch parsed from `p:showPr`. */
	showWithAnimation?: boolean;
	/** Archive-path to data-URL map, used to resolve action-sound sources. */
	mediaDataUrls?: ReadonlyMap<string, string>;
	/**
	 * Re-render the given tracked elements in place against the current element
	 * states, so staged chart / SmartArt builds and `p:animClr` fill / stroke
	 * relinquish surface structurally. Supplied by the render controller.
	 */
	reRenderElements?: (ids: readonly string[]) => void;
	/**
	 * Seed the incoming slide as fully built rather than replaying it. Set when
	 * stepping BACKWARD onto a slide, which PowerPoint shows with its builds
	 * already complete.
	 */
	seedCompleted?: boolean;
}

/**
 * The presentation-mode playback state machine for the vanilla binding, driven
 * by the shared native-timing {@link PresentationAnimationController} (mirrors
 * the React / Vue `useAnimationPlayback`, but drives the DOM imperatively).
 *
 * The controller builds a timeline engine from the slide's `nativeAnimations`
 * (expanding staged text builds) and can represent native staged chart /
 * SmartArt builds (`p:bldChart` / `p:bldDgm`) and colour animations
 * (`p:animClr`) that the older preset click-group model could not.
 */
export interface PresentationPlayback {
	/**
	 * Reveal the next click-group. Returns `true` if a group was revealed (stay on
	 * the slide); `false` when the timeline is exhausted or animations are disabled
	 * (the caller should advance to the next slide).
	 */
	advance(): boolean;
	/** True when every click-group on the current slide has been revealed. */
	isComplete(): boolean;
	/**
	 * True while the active slide shows its builds as already complete because
	 * the presenter stepped BACKWARD onto it. The next back press replays it.
	 */
	isSeededCompleted(): boolean;
	/** Replay the active slide's builds from the start. */
	replayCurrentSlide(doc: Document): void;
	/** Sync playback + transitions after a stage (re)render. */
	syncStage(params: SyncStageParams): void;
	/** Cancel any running transition/timers and forget all per-slide state. */
	reset(): void;
	/**
	 * The stable per-element native-animation state map, mutated in place as the
	 * timeline plays. Threaded into the render context so element renderers can
	 * reveal staged builds and relinquish animated fill / stroke.
	 */
	readonly elementStates: ReadonlyMap<string, ElementAnimationState>;
}

export function createPresentationPlayback(): PresentationPlayback {
	// Stable map instance, mutated in place so the render context's captured
	// reference always reads current state during a targeted element re-render.
	const elementStates = new Map<string, ElementAnimationState>();
	const timers: number[] = [];
	const buildHandle: BuildRafHandle = { current: null };

	let controller: PresentationAnimationController | null = null;
	let currentStage: HTMLElement | null = null;
	// The last presented stage node, kept as the outgoing snapshot for the next
	// slide's transition (detached by `replaceChildren`, re-attached on demand).
	let previousStage: HTMLElement | null = null;
	let lastIndex = -1;
	let wasPresenting = false;
	let cancelTransition: (() => void) | null = null;
	let mediaDataUrls: ReadonlyMap<string, string> = new Map();
	let reRenderElements: ((ids: readonly string[]) => void) | null = null;
	/** Whether the active slide was seeded as fully built (backward entry). */
	let seededCompleted = false;
	/** The slide the stage currently renders, kept so a back press can replay it. */
	let lastSlide: PptxSlide | undefined;

	const interactiveIds = (): ReadonlySet<string> =>
		controller?.interactiveTriggerShapeIds ?? new Set();
	const hoverIds = (): ReadonlySet<string> => controller?.hoverTriggerShapeIds ?? new Set();

	/** Overwrite the stable state map in place from a freshly computed snapshot. */
	const commitStates = (next: Map<string, ElementAnimationState>): void => {
		elementStates.clear();
		for (const [id, state] of next) {
			elementStates.set(id, state);
		}
		refreshDom();
	};

	/** Ids whose current state needs a structural re-render (build / animClr). */
	const structuralIds = (): string[] => {
		const ids = new Set<string>();
		for (const [id, state] of elementStates) {
			if (state.build || state.animatesFill || state.animatesStroke) {
				ids.add(id);
			}
			// A staged text build renders one span per paragraph / word / letter,
			// and those spans only exist once the element is rendered WITH its
			// sub-states. The stage is built before the timeline is seeded, so the
			// owning element has to be re-rendered or the build has no pieces to
			// animate at all (a slide entered backward showed none).
			const separator = id.indexOf('::');
			if (separator > 0) {
				ids.add(id.slice(0, separator));
			}
		}
		return Array.from(ids);
	};

	/** Re-render structural elements, then patch cheap per-node CSS styles. */
	const refreshDom = (): void => {
		if (!currentStage) {
			return;
		}
		const ids = structuralIds();
		if (ids.length > 0) {
			reRenderElements?.(ids);
		}
		applyElementAnimationStyles(currentStage, elementStates, interactiveIds(), hoverIds());
	};

	const ctx: PlaybackContext = {
		setStates: (updater) => {
			commitStates(updater(new Map(elementStates)));
		},
		timers,
		buildHandle,
		playSound: (soundPath) => {
			playAnimationSound(mediaDataUrls.get(soundPath) ?? soundPath);
		},
		stopSound: stopAnimationSound,
		frameRoot: () => currentStage,
	};

	const stopTransition = (): void => {
		if (cancelTransition) {
			cancelTransition();
			cancelTransition = null;
		}
	};

	/**
	 * The click-group the last presenter click started, so a second click while
	 * it is still mid-flight fast-forwards it (`p:seq/@nextAc="seek"`) instead
	 * of skipping to the next group. Owned here, mutated by the shared helpers.
	 */
	const activeGroup = createActiveAnimationGroup();

	const clearTimers = (): void => {
		clearPlaybackTimers(ctx, activeGroup);
	};

	const teardown = (): void => {
		stopTransition();
		clearTimers();
		controller = null;
		ctx.mediaTimeNodeElementIds = new Map();
		elementStates.clear();
		currentStage = null;
		previousStage = null;
	};

	const enterSlide = (slide: PptxSlide, doc: Document, completed = false): void => {
		controller = PresentationAnimationController.fromSlide(slide);
		// Lets a `p:cond/@evt="onStopAudio"`-gated step gate on the REAL media
		// element's `ended` event instead of only its estimated `delayMs`.
		ctx.mediaTimeNodeElementIds = resolveMediaTimeNodeElementIds(slide.nativeAnimations ?? []);
		injectSlideKeyframes(doc, controller.keyframesCss);
		commitStates(controller.computeStates());
		seededCompleted = false;

		// Stepping backward onto a slide shows it with every build already
		// complete, the way PowerPoint does: nothing plays, nothing is scheduled,
		// and a further back press replays the slide from the start.
		if (completed) {
			seededCompleted = controller.hasMoreSteps();
			controller.completeAll();
			commitStates(controller.computeStates());
			return;
		}

		// Auto-play the first group when the slide opens with a withPrevious /
		// afterPrevious / afterDelay build (mirrors React / Vue entrance auto-play).
		if (controller.hasMoreSteps()) {
			const first = controller.peekNext();
			if (first?.autoAdvance) {
				const active = controller;
				const timer = window.setTimeout(() => {
					const group = active.advance();
					if (group) {
						playGroup(active, group, ctx);
						scheduleAutoAdvanceChain(active, ctx);
					}
				}, first.autoAdvanceDelayMs ?? 0);
				timers.push(timer);
			}
		}
	};

	return {
		elementStates,

		advance() {
			// Seek-or-advance (`p:seq/@nextAc="seek"`) plus the auto-advance chain
			// live in shared, so the branch is identical in all five bindings.
			return advanceMainSequence(controller, ctx, activeGroup);
		},

		isComplete() {
			return !controller || !controller.hasMoreSteps();
		},

		isSeededCompleted() {
			return seededCompleted;
		},

		replayCurrentSlide(doc) {
			if (lastSlide) {
				clearTimers();
				enterSlide(lastSlide, doc);
			}
		},

		syncStage(params) {
			// The old stage DOM is gone (rebuilt), so any in-flight transition
			// overlay is orphaned.
			stopTransition();

			const animationsEnabled = params.showWithAnimation !== false;
			if (!params.presenting || !params.slide || !animationsEnabled) {
				clearTimers();
				controller = null;
				elementStates.clear();
				injectSlideKeyframes(params.doc, '');
				currentStage = params.presenting ? params.stage : null;
				previousStage = params.presenting ? params.stage : null;
				lastIndex = params.slideIndex;
				// Leaving the show (never merely a re-render while presenting): a
				// transition sound flagged "Loop Until Next Sound" must not keep
				// looping on the shared singleton behind the editor.
				if (wasPresenting && !params.presenting) {
					stopAnimationSound();
				}
				wasPresenting = params.presenting;
				return;
			}

			ensurePresentationKeyframes(params.doc);
			mediaDataUrls = params.mediaDataUrls ?? new Map();
			reRenderElements = params.reRenderElements ?? null;
			currentStage = params.stage;

			const entering = !wasPresenting;
			const slideChanged = params.slideIndex !== lastIndex;

			// Captured before `lastSlide` advances: a morph needs BOTH slides to
			// match shapes between them.
			const outgoingSlide = lastSlide;
			lastSlide = params.slide;

			if (entering || slideChanged || !controller) {
				// A new slide owns a fresh timeline: drop the old slide's pending
				// auto-advance / build timers before seeding it.
				clearTimers();
				enterSlide(params.slide, params.doc, params.seedCompleted === true);
			} else {
				// Same slide re-rendered (e.g. resize, chrome hiding). Its timeline is
				// unchanged, so the pending timers MUST survive: clearing them here
				// cancelled the slide's own auto-play before its delay elapsed, and a
				// deck that opens with a "With Previous" build never animated at all.
				refreshDom();
			}

			// Play the incoming slide's transition when the slide changed mid-show
			// (never on the initial enter; only with an outgoing snapshot to animate).
			// A backward step replays the LEAVING slide's transition in reverse
			// (PowerPoint: a morph glides its shapes back to where they came from).
			const goingBack = params.slideIndex < lastIndex;
			const transition = goingBack ? outgoingSlide?.transition : params.slide.transition;

			// The sound action (`p:sndAc/p:stSnd`/`p:endSnd`) fires the instant the
			// transition starts, independent of whether it also paints an overlay
			// (an instant "None" transition can still carry a "Stop Previous Sound"),
			// so this is not gated by `transition.type !== 'none'` below.
			if (!entering && slideChanged && previousStage) {
				applySlideTransitionSound(transition, (soundPath) => mediaDataUrls.get(soundPath), {
					play: playAnimationSound,
					stop: stopAnimationSound,
				});
			}

			if (
				!entering &&
				slideChanged &&
				previousStage &&
				transition &&
				transition.type &&
				transition.type !== 'none'
			) {
				const incoming = params.stage.cloneNode(true) as HTMLElement;
				cancelTransition = playTransitionOverlay({
					doc: params.doc,
					stageWrap: params.stageWrap,
					outgoing: previousStage,
					incoming,
					transition,
					outgoingSlide,
					incomingSlide: params.slide,
					onDone: () => {
						cancelTransition = null;
					},
				});
			}

			attachTriggerListeners(params.stage, {
				getController: () => controller,
				play: (activeController, group) => {
					playGroup(activeController, group, ctx);
				},
				getSlide: () => params.slide,
			});

			previousStage = params.stage;
			lastIndex = params.slideIndex;
			wasPresenting = true;
		},

		reset() {
			teardown();
			lastIndex = -1;
			wasPresenting = false;
		},
	};
}
