/**
 * AiChangeOverlayComponent: plays the "watch the AI edit land" animation. For
 * each element the assistant just changed on the visible slide it draws a ghost
 * rect that, on the next frame, flips from its `start` to `end` state so the
 * browser transitions between them: added elements fade+scale in, removed
 * fade+scale out, moved/resized glide old->new, all under a glow-pulse. Rendered
 * INSIDE the (already-scaled) slide stage, so the change bounds (slide CSS
 * pixels) map 1:1.
 *
 * Purely presentational; the Angular port of React's `AiChangeOverlay`. The
 * batch (with per-element from/to bounds + resolved config) comes from the
 * shared {@link AiChangeAnimator} via {@link AiPanelStore}; the ghosts carry
 * their own geometry, so no element lookup is needed. Uses
 * `ViewEncapsulation.None` and injects the config-parameterised keyframes/glow
 * CSS as a global `<style>` (the React version renders a `<style>` tag), so the
 * glow rule can also reach real slide element nodes if a binding stamps them.
 */
import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	input,
	Renderer2,
	signal,
	ViewEncapsulation,
} from '@angular/core';

import { aiChangeAnimationCss, changeGhostStyle } from '../../internal/shared-ai';
import type { AiChangeBatch, AiElementChange } from '../../internal/shared-ai';
import type { StyleMap } from '../element-style';

@Component({
	selector: 'pptx-ai-change-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None,
	imports: [NgStyle],
	template: `
		@for (change of activeChanges(); track change.elementId + '-' + nonce()) {
			<div
				[attr.data-testid]="'ai-change-' + change.elementId"
				[attr.data-ai-change]="change.kind"
				data-export-ignore="true"
				[ngStyle]="ghostStyle(change)"
			></div>
		}
	`,
})
export class AiChangeOverlayComponent {
	/** The batch of just-applied changes to animate (null when idle). */
	readonly batch = input<AiChangeBatch | null>(null);
	/** Zero-based active slide index, so the overlay draws only its own slide. */
	readonly activeSlideIndex = input<number>(0);

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly renderer = inject(Renderer2);
	private styleEl: HTMLStyleElement | null = null;

	/** `start` (pre-flip) then `end` (post-flip) so the CSS transition runs. */
	private readonly phase = signal<'start' | 'end'>('start');
	private outerFrame = 0;
	private innerFrame = 0;

	/** Monotonic batch id; keys the ghosts + restarts the phase flip per batch. */
	protected readonly nonce = computed(() => this.batch()?.nonce ?? 0);

	/** The changes on the currently visible slide (bounds map 1:1 to the stage). */
	protected readonly activeChanges = computed<AiElementChange[]>(() => {
		const current = this.batch();
		if (!current) {
			return [];
		}
		const active = this.activeSlideIndex();
		return current.changes.filter((c) => c.slideIndex === active);
	});

	constructor() {
		// Inject/refresh the config-parameterised keyframes + glow CSS once per
		// batch (colour + duration come from the resolved config).
		effect(() => {
			const current = this.batch();
			if (!current) {
				return;
			}
			if (!this.styleEl) {
				this.styleEl = this.renderer.createElement('style') as HTMLStyleElement;
				this.renderer.appendChild(this.host.nativeElement, this.styleEl);
			}
			this.renderer.setProperty(this.styleEl, 'textContent', aiChangeAnimationCss(current.config));
		});

		// Two frames: let the browser paint the `start` state before flipping to
		// `end`, so the CSS transition actually runs instead of snapping. Restarts
		// whenever a new batch arrives (its nonce changes).
		effect(() => {
			const current = this.batch();
			this.nonce();
			this.cancelFrames();
			this.phase.set('start');
			if (!current || typeof requestAnimationFrame !== 'function') {
				if (current) {
					this.phase.set('end');
				}
				return;
			}
			this.outerFrame = requestAnimationFrame(() => {
				this.innerFrame = requestAnimationFrame(() => this.phase.set('end'));
			});
		});

		inject(DestroyRef).onDestroy(() => this.cancelFrames());
	}

	/** Kebab-cased ghost-rect style for one change at the current phase. */
	protected ghostStyle(change: AiElementChange): StyleMap {
		const config = this.batch()?.config;
		if (!config) {
			return {};
		}
		const g = changeGhostStyle(change, this.phase(), config);
		return {
			position: g.position,
			left: `${g.left}px`,
			top: `${g.top}px`,
			width: `${g.width}px`,
			height: `${g.height}px`,
			opacity: g.opacity,
			transform: g.transform,
			transition: g.transition,
			'box-shadow': g.boxShadow,
			border: g.border,
			'border-radius': g.borderRadius,
			'pointer-events': g.pointerEvents,
			'z-index': g.zIndex,
		};
	}

	private cancelFrames(): void {
		if (typeof cancelAnimationFrame === 'function') {
			cancelAnimationFrame(this.outerFrame);
			cancelAnimationFrame(this.innerFrame);
		}
	}
}
