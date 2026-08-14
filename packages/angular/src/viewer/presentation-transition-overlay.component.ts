import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	computed,
	effect,
	inject,
	input,
	output,
} from '@angular/core';
import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';

import type { CanvasSize, MorphTransitionPlan } from '../internal/shared';
import {
	buildMorphScopedCss,
	buildMorphTransitionPlan,
	DEFAULT_MORPH_DURATION_MS,
	MORPH_CROSSFADE_GROUP_STYLE,
	MORPH_CROSSFADE_HALF_BLEND_MODE,
	morphOptionToMode,
} from '../internal/shared';
import type { StyleMap } from './element-style';
import { SlideCanvasComponent } from './slide-canvas.component';
import {
	getSlideTransitionAnimations,
	resolveTransitionDuration,
	transitionSlideBoxSize,
} from './transition-helpers';
import type { SlideTransitionAnimations } from './transition-helpers';
import { ensureTransitionKeyframes } from './transition-keyframes';

/** Safety margin (ms) added to the animation duration before firing complete. */
const COMPLETE_MARGIN_MS = 50;

/**
 * The slide the overlay paints ABOVE its ghosts, or `undefined` when a morph
 * has nothing to lift.
 *
 * A shape arriving inside a shape that persists is drawn on the live stage,
 * UNDER this overlay, so the persisting shape's opaque ghost hides it for the
 * whole transition (issue #146). `buildMorphTransitionPlan` names those few and
 * holds their stage copy invisible; this wraps them as a slide the component's
 * own `pptx-slide-canvas` can render.
 *
 * Exported and pure so it can be unit-tested: this package renders no component
 * under test (see `action-settings-panel.component.test.ts`).
 */
export function morphLiftedSlide(
	plan: MorphTransitionPlan | undefined,
	incomingSlide: PptxSlide | undefined,
): PptxSlide | undefined {
	if (!plan || !incomingSlide || plan.overlayIncomingElements.length === 0) {
		return undefined;
	}
	return { ...incomingSlide, elements: [...plan.overlayIncomingElements] };
}

/** One cross-dissolving pair, as the two single-element slides that paint it. */
export interface MorphCrossfadeGroupSlides {
	key: string;
	style: StyleMap;
	outgoing: PptxSlide;
	incoming: PptxSlide;
}

/**
 * The pairs the overlay paints BOTH halves of, as one isolated group each.
 *
 * Stacking the halves composites them source-over, which leaves the ink they
 * share at 0.75 of full strength halfway through instead of summing it, biting
 * chunks out of glyphs that cross during a text dissolve. PowerPoint's own
 * render holds the two blend coefficients at a sum of 1.0 for every frame
 * (issue #161), which `isolation: isolate` plus `mix-blend-mode: plus-lighter`
 * on the two halves reproduces.
 *
 * Exported and pure so it can be unit-tested: this package renders no component
 * under test (see `action-settings-panel.component.test.ts`).
 */
export function morphCrossfadeGroupSlides(
	plan: MorphTransitionPlan | undefined,
	outgoingSlide: PptxSlide | undefined,
	incomingSlide: PptxSlide | undefined,
): MorphCrossfadeGroupSlides[] {
	if (!plan || !outgoingSlide || !incomingSlide) {
		return [];
	}
	return plan.crossfadeGroups.map((group, index) => ({
		key: group.incoming.id,
		style: {
			...MORPH_CROSSFADE_GROUP_STYLE,
			// `isolation` makes the group a stacking context, so it carries a
			// z-index of its own to stay above the ghost layer (40) and the lifted
			// layer (41) its halves came from.
			'z-index': String(42 + index),
		},
		outgoing: { ...outgoingSlide, elements: [group.outgoing] },
		incoming: { ...incomingSlide, elements: [group.incoming] },
	}));
}

/**
 * PresentationTransitionOverlayComponent: plays a PowerPoint slide transition
 * over the presentation stage.
 *
 * Renders the *outgoing* (previous) slide as an absolutely-positioned layer
 * with the resolved CSS exit animation; the *incoming* slide is rendered by the
 * underlying stage (the existing `pptx-presentation-overlay`). The `outgoingOnTop`
 * descriptor controls whether the outgoing layer sits above or below the stage,
 * letting cover/uncover/push read correctly. Fires `complete` once the animation
 * finishes so the orchestrator can tear the overlay down.
 *
 * Selector: `pptx-presentation-transition-overlay`
 *
 * Inputs:
 *   - `outgoingSlide`    (required): the leaving slide to animate
 *   - `canvasSize`       (required): logical slide dimensions (px)
 *   - `transition`       (required): the transition definition (from the slide)
 *   - `templateElements`: master/layout elements behind the outgoing slide
 *   - `mediaDataUrls`   : data-URL map for media assets
 *   - `durationMs`      : explicit override; otherwise derived from `transition`
 *   - `zoom`            : the stage's live zoom, so the outgoing slide animates
 *                         at the same size as the incoming one
 *
 * Outputs:
 *   - `complete`: emits void when the transition animation completes
 *
 * Designed to compose with `PresentationOverlayComponent` WITHOUT editing it:
 * the orchestrator stacks this overlay on top of the stage while a transition
 * is in flight and removes it on `complete`.
 */
@Component({
	selector: 'pptx-presentation-transition-overlay',
	host: { 'data-pptx-transition-overlay': '' },
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideCanvasComponent],
	styles: `
		:host {
			display: block;
			position: absolute;
			inset: 0;
			overflow: hidden;
			pointer-events: none;
		}

		.pptx-ng-transition-layer {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	`,
	template: `
		<div
			class="pptx-ng-transition-layer"
			data-pptx-transition-layer="outgoing"
			[attr.data-pptx-morph-outgoing]="morphPlan() ? 'true' : null"
			[ngStyle]="layerStyle()"
		>
			<div [ngStyle]="slideBoxStyle()">
				<pptx-slide-canvas
					[slide]="layerSlide()"
					[canvasSize]="canvasSize()"
					[mediaDataUrls]="mediaDataUrls()"
					[zoom]="zoom()"
					[autoFit]="false"
					[interactive]="false"
					[transparentBackground]="isMorph()"
				/>
			</div>
		</div>

		<!-- The arriving shapes that dissolve in ABOVE a departing one. They are on
		     the live stage below this overlay, where the departing layer hides them
		     for the whole morph, so they are painted again here. -->
		@if (liftedSlide(); as lifted) {
			<div
				class="pptx-ng-transition-layer"
				data-pptx-transition-layer="lifted"
				data-pptx-morph-lifted="true"
				[ngStyle]="{ 'z-index': '41' }"
			>
				<div [ngStyle]="slideBoxStyle()">
					<pptx-slide-canvas
						[slide]="lifted"
						[canvasSize]="canvasSize()"
						[mediaDataUrls]="mediaDataUrls()"
						[zoom]="zoom()"
						[autoFit]="false"
						[interactive]="false"
						[transparentBackground]="true"
					/>
				</div>
			</div>
		}

		<!-- A pair dissolving in place, painted as ONE isolated group whose two
		     halves sum instead of stacking (issue #161). -->
		@for (group of crossfadeGroups(); track group.key) {
			<div [attr.data-pptx-morph-crossfade]="group.key" [ngStyle]="group.style">
				<div
					class="pptx-ng-transition-layer"
					data-pptx-transition-layer="outgoing"
					data-pptx-morph-outgoing="true"
					[ngStyle]="crossfadeHalfStyle"
				>
					<div [ngStyle]="slideBoxStyle()">
						<pptx-slide-canvas
							[slide]="group.outgoing"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaDataUrls()"
							[zoom]="zoom()"
							[autoFit]="false"
							[interactive]="false"
							[transparentBackground]="true"
						/>
					</div>
				</div>
				<div
					class="pptx-ng-transition-layer"
					data-pptx-transition-layer="lifted"
					data-pptx-morph-lifted="true"
					[ngStyle]="crossfadeHalfStyle"
				>
					<div [ngStyle]="slideBoxStyle()">
						<pptx-slide-canvas
							[slide]="group.incoming"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaDataUrls()"
							[zoom]="zoom()"
							[autoFit]="false"
							[interactive]="false"
							[transparentBackground]="true"
						/>
					</div>
				</div>
			</div>
		}
	`,
})
export class PresentationTransitionOverlayComponent {
	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	readonly outgoingSlide = input.required<PptxSlide>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly transition = input.required<PptxSlideTransition>();
	readonly templateElements = input<readonly PptxElement[]>([]);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	/** Explicit duration override (ms). When omitted, derived from `transition`. */
	readonly durationMs = input<number | undefined>(undefined);
	/**
	 * The stage's live zoom (the same value the underlying `pptx-slide-canvas`
	 * renders at). The outgoing layer MUST use it: left at 1 the leaving slide
	 * animates out at its intrinsic size over a full-screen incoming slide,
	 * which reads as the slide snapping small the instant a transition starts.
	 */
	readonly zoom = input<number>(1);
	/**
	 * The arriving slide. Required only for Morph, which has to match shapes
	 * across both slides; every other transition ignores it.
	 */
	readonly incomingSlide = input<PptxSlide | undefined>(undefined);

	// ------------------------------------------------------------------
	// Outputs
	// ------------------------------------------------------------------

	readonly complete = output<void>();

	// ------------------------------------------------------------------
	// Internal
	// ------------------------------------------------------------------

	private readonly destroyRef = inject(DestroyRef);
	/** Active completion timer handle, so re-running re-arms cleanly. */
	private completeTimer: ReturnType<typeof setTimeout> | null = null;
	/** Active transition-sound element, paused on teardown. */
	private audio: HTMLAudioElement | null = null;
	/** Whether `complete` has already fired for the current run. */
	private fired = false;

	constructor() {
		ensureTransitionKeyframes();

		// Re-arm the completion timer + sound whenever the transition or its
		// resolved duration changes.
		effect(() => {
			const ms = this.resolvedDurationMs();
			const soundPath = this.transition().soundPath;
			this.playSound(soundPath);
			this.armCompletion(ms);
		});

		// Morph keyframes + per-element rules. They must reach the LIVE stage,
		// which is a sibling component, so they are injected at document level.
		// Element ids embed their slide path, so unscoped rules cannot leak onto
		// another slide's elements.
		effect(() => {
			const plan = this.morphPlan();
			this.applyMorphStyle(
				plan
					? [
							buildMorphScopedCss(plan, '', 'incoming'),
							buildMorphScopedCss(plan, 'data-pptx-morph-outgoing', 'outgoing'),
							// Scoped, so it outranks the unscoped `incoming` rule that holds
							// the stage's copy of the same element invisible.
							buildMorphScopedCss(plan, 'data-pptx-morph-lifted', 'lifted'),
						].join('\n')
					: null,
			);
		});

		this.destroyRef.onDestroy(() => {
			this.clearTimer();
			this.stopSound();
			this.applyMorphStyle(null);
		});
	}

	/** Owned `<style>` element carrying the active morph rules, if any. */
	private morphStyle: HTMLStyleElement | null = null;

	private applyMorphStyle(css: string | null): void {
		if (typeof document === 'undefined') {
			return;
		}
		if (css === null) {
			this.morphStyle?.remove();
			this.morphStyle = null;
			return;
		}
		if (!this.morphStyle) {
			this.morphStyle = document.createElement('style');
			document.head.appendChild(this.morphStyle);
		}
		this.morphStyle.textContent = css;
	}

	// ------------------------------------------------------------------
	// Derived state
	// ------------------------------------------------------------------

	/** Effective transition duration (ms), floored/defaulted. */
	protected readonly resolvedDurationMs = computed<number>(() => {
		const override = this.durationMs();
		if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
			return override;
		}
		const tr = this.transition();
		// PowerPoint's Morph defaults to 2.00s (`p14:dur` overrides arrive in
		// `durationMs`); the generic 1s default made it visibly abrupt.
		if (tr.type === 'morph' && !(typeof tr.durationMs === 'number' && tr.durationMs > 0)) {
			return DEFAULT_MORPH_DURATION_MS;
		}
		return resolveTransitionDuration(tr.durationMs);
	});

	/** Resolved CSS animation descriptors for the outgoing/incoming layers. */
	protected readonly animations = computed<SlideTransitionAnimations>(() => {
		const tr = this.transition();
		return getSlideTransitionAnimations(
			tr.type,
			this.resolvedDurationMs(),
			tr.direction,
			tr.orient,
			tr.spokes,
		);
	});

	/**
	 * Active Morph plan, or `undefined` for every other transition.
	 *
	 * Morph travels individual shapes between the two slides rather than wiping
	 * the surface, so it changes what this overlay paints: a per-shape copy of
	 * the outgoing slide, each one gliding onto its counterpart (dissolving into
	 * it when its appearance changed) or fading out in place when it has none.
	 * The incoming halves are animated on the live stage by document-level rules
	 * (see `morphStyleEffect`).
	 */
	protected readonly morphPlan = computed(() =>
		this.transition().type === 'morph'
			? buildMorphTransitionPlan(
					this.outgoingSlide(),
					this.incomingSlide(),
					this.resolvedDurationMs(),
					morphOptionToMode(this.transition().morphOption),
				)
			: undefined,
	);

	/**
	 * Whether this overlay is playing a morph.
	 *
	 * A morph layer paints only the departing slide's paired shapes over the live
	 * incoming stage, so its stage background must be dropped
	 * (`transparentBackground`). Every other transition animates a whole slide
	 * surface out and keeps its own background.
	 */
	protected readonly isMorph = computed<boolean>(() => this.morphPlan() !== undefined);

	/** The slide rendered in the animated layer (outgoing + its template). */
	protected readonly layerSlide = computed<PptxSlide>(() => {
		const slide = this.outgoingSlide();
		const plan = this.morphPlan();
		if (plan) {
			return { ...slide, elements: [...plan.outgoingElements] };
		}
		const template = this.templateElements();
		if (template.length === 0) {
			return slide;
		}
		return { ...slide, elements: [...template, ...slide.elements] };
	});

	/**
	 * The arriving shapes the morph has to paint over its own ghosts, or
	 * `undefined` when there are none (issue #146). They sit on the live stage
	 * below this overlay, where the departing layer would hide them for the whole
	 * transition; the plan holds that copy invisible and hands them here instead.
	 */
	protected readonly liftedSlide = computed<PptxSlide | undefined>(() =>
		morphLiftedSlide(this.morphPlan(), this.incomingSlide()),
	);

	/**
	 * The cross-dissolving pairs this overlay paints both halves of, each in its
	 * own isolated group so the halves are summed rather than stacked.
	 */
	protected readonly crossfadeGroups = computed<MorphCrossfadeGroupSlides[]>(() =>
		morphCrossfadeGroupSlides(this.morphPlan(), this.outgoingSlide(), this.incomingSlide()),
	);

	/** Both halves of a grouped pair blend additively, and only with each other. */
	protected readonly crossfadeHalfStyle: StyleMap = {
		'mix-blend-mode': MORPH_CROSSFADE_HALF_BLEND_MODE,
	};

	/** Layer container style: animation + stacking relative to the stage. */
	protected readonly layerStyle = computed<StyleMap>(() => {
		const anims = this.animations();
		const plan = this.morphPlan();
		const style: StyleMap = {
			'z-index': plan ? '40' : anims.outgoingOnTop ? '40' : '20',
		};
		// A layer-wide animation would drag every shape as one block and cancel
		// the morph, so during a morph the layer itself stays still.
		if (!plan && anims.outgoing !== 'none') {
			style['animation'] = anims.outgoing;
		}
		return style;
	});

	/**
	 * Slide box sized to the ZOOMED slide footprint, matching the stage's own
	 * `pptx-slide-canvas`. The inner canvas renders at the same `zoom` with
	 * `autoFit` off, so the outgoing slide is pixel-for-pixel the size of the
	 * incoming one for the whole animation.
	 */
	protected readonly slideBoxStyle = computed<StyleMap>(() => {
		const box = transitionSlideBoxSize(this.canvasSize(), this.zoom());
		return {
			width: `${box.width}px`,
			height: `${box.height}px`,
			'transform-origin': 'center',
		};
	});

	// ------------------------------------------------------------------
	// Completion timing + sound
	// ------------------------------------------------------------------

	private armCompletion(durationMs: number): void {
		this.clearTimer();
		this.fired = false;
		if (typeof setTimeout === 'undefined') {
			return;
		}
		this.completeTimer = setTimeout(() => {
			this.completeTimer = null;
			if (this.fired) {
				return;
			}
			this.fired = true;
			this.complete.emit();
		}, durationMs + COMPLETE_MARGIN_MS);
	}

	private clearTimer(): void {
		if (this.completeTimer !== null) {
			clearTimeout(this.completeTimer);
			this.completeTimer = null;
		}
	}

	private playSound(soundPath: string | undefined): void {
		this.stopSound();
		if (!soundPath || typeof Audio === 'undefined') {
			return;
		}
		const audio = new Audio(soundPath);
		this.audio = audio;
		// Browser autoplay policy may reject; ignore silently.
		void audio.play().catch(() => {});
	}

	private stopSound(): void {
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.audio = null;
		}
	}
}
