/**
 * transition-preview.component.ts: click-to-play thumbnail of the configured
 * slide transition, mirroring React's `inspector/TransitionPreview.tsx`.
 *
 * Selector: `pptx-transition-preview`
 *
 * The two stacked layers ("A" outgoing, "B" incoming) are driven by the SAME
 * shared `getSlideTransitionAnimations` resolver the real presentation overlay
 * uses, so what the author previews is what plays. `outgoingOnTop` decides the
 * stacking order; without it the push/cover family previews inverted relative
 * to the real transition.
 *
 * WHY the `@for` over a play counter: a CSS animation only restarts when the
 * node is recreated. Angular has no `{#key}` block, so both layers are rendered
 * inside a one-element `@for` tracked by a counter that the play button bumps;
 * clicking twice with unchanged settings therefore replays instead of doing
 * nothing.
 *
 * @module viewer/transition-preview
 */
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	computed,
	inject,
	input,
	signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlideTransition } from 'pptx-viewer-core';

import { getSlideTransitionAnimations } from './transition-helpers';
import { ensureTransitionKeyframes } from './transition-keyframes';

/** Fallback duration (ms) when the transition declares none. */
const PREVIEW_FALLBACK_MS = 500;

/** Extra time (ms) held after the animation before the layers reset. */
const PREVIEW_SETTLE_MS = 100;

@Component({
	selector: 'pptx-transition-preview',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (previewable()) {
			<div class="tprev">
				<span class="tprev__label">{{ 'pptx.transition.preview' | translate }}</span>
				<button
					type="button"
					class="tprev__stage"
					[title]="'pptx.transition.preview' | translate"
					[attr.aria-label]="'pptx.transition.preview' | translate"
					(click)="play()"
				>
					@for (key of playKeys(); track key) {
						<span class="tprev__layer tprev__layer--in" [style.animation]="incomingAnimation()"
							>B</span
						>
						<span
							class="tprev__layer tprev__layer--out"
							[style.zIndex]="outgoingZIndex()"
							[style.animation]="outgoingAnimation()"
							>A</span
						>
					}
				</button>
			</div>
		}
	`,
	styles: `
		:host {
			display: block;
		}
		.tprev {
			display: grid;
			gap: 3px;
		}
		.tprev__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
		.tprev__stage {
			position: relative;
			display: block;
			width: 100%;
			height: 64px;
			padding: 0;
			overflow: hidden;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 4px;
			background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
			cursor: pointer;
		}
		.tprev__layer {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 9px;
			color: var(--pptx-inspector-muted, #888);
		}
		/*
		 * A translucent BACKGROUND, not element opacity: the transition
		 * animations drive the opacity property themselves and would fight an
		 * inherited value.
		 */
		.tprev__layer--in {
			background: color-mix(in srgb, var(--pptx-inspector-active, #0078d4) 20%, transparent);
		}
		.tprev__layer--out {
			background: var(--pptx-inspector-card-bg, rgba(0, 0, 0, 0.12));
		}
	`,
})
export class TransitionPreviewComponent {
	/** The transition being previewed. */
	readonly transition = input.required<PptxSlideTransition>();

	/** Bumped on every click; recreates both layers so the animation restarts. */
	private readonly playKey = signal(0);
	private readonly playing = signal(false);
	private timer: ReturnType<typeof setTimeout> | undefined;

	constructor() {
		ensureTransitionKeyframes();
		inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
	}

	/** Single-element list so the template can key the layers on the counter. */
	protected readonly playKeys = computed<readonly number[]>(() => [this.playKey()]);

	protected readonly durationMs = computed(
		() => this.transition().durationMs ?? PREVIEW_FALLBACK_MS,
	);

	/** `none` and `cut` have nothing to show; React hides the preview entirely. */
	protected readonly previewable = computed(() => {
		const type = this.transition().type;
		return type !== 'none' && type !== 'cut';
	});

	private readonly animations = computed(() => {
		const transition = this.transition();
		return getSlideTransitionAnimations(
			transition.type,
			this.durationMs(),
			transition.direction,
			transition.orient,
			transition.spokes,
		);
	});

	protected readonly incomingAnimation = computed<string | null>(() => {
		const incoming = this.animations().incoming;
		return this.playing() && incoming !== 'none' ? incoming : null;
	});

	protected readonly outgoingAnimation = computed<string | null>(() => {
		if (!this.playing()) {
			return null;
		}
		const outgoing = this.animations().outgoing;
		return outgoing !== 'none'
			? outgoing
			: `pptx-tr-fade-out ${this.durationMs()}ms ease-in-out forwards`;
	});

	protected readonly outgoingZIndex = computed(() => (this.animations().outgoingOnTop ? 2 : 0));

	protected play(): void {
		this.playing.set(true);
		this.playKey.update((key) => key + 1);
		clearTimeout(this.timer);
		this.timer = setTimeout(() => this.playing.set(false), this.durationMs() + PREVIEW_SETTLE_MS);
	}
}
