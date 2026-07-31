/**
 * animation-panel.component.ts: presentational animation **playback** panel.
 *
 * Selector: `pptx-animation-panel`
 *
 * Lists the current slide's animation click groups (the discrete playback steps)
 * and exposes play / pause / step / reset controls. It is purely presentational:
 * all step derivation lives in `animation-playback-helpers.ts` and the actual
 * playback state lives in {@link AnimationPlaybackService}; this component only
 * renders and emits intents.
 *
 * Mirrors the Vue `AnimationPanel.vue` label resolution (preset + trigger
 * labels via the core catalog) but, per the Angular port's separation of
 * concerns, drives playback rather than editing.
 *
 * Inputs:
 *   - `groups`     (required): the slide's click groups (one per step)
 *   - `step`       : the current step (groups revealed so far); default 0
 *   - `isPlaying`  : whether auto-playback is running; default false
 *
 * Outputs:
 *   - `playRequested`   : user pressed Play (reveal/auto-advance)
 *   - `pauseRequested`  : user pressed Pause
 *   - `stepRequested`   : user pressed Step (advance one group)
 *   - `resetRequested`  : user pressed Reset (back to before the first group)
 *   - `seek`            : user clicked a step row (jump to that step index)
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxAnimationTrigger, PptxElementAnimation } from 'pptx-viewer-core';

import { animationEffectLabelKey } from '../internal/shared';
import type { AnimationClickGroup } from './animation-playback-helpers';

/** A single rendered playback step (one click group). */
interface AnimationStepView {
	/** 1-based step number for display. */
	readonly index: number;
	/** Human label for the step (first animation's preset, "+N more"). */
	readonly label: string;
	/** Human label for the step's start trigger. */
	readonly trigger: string;
	/** True when this step has been revealed at the current playback position. */
	readonly revealed: boolean;
}

const TRIGGER_LABEL_KEYS: ReadonlyArray<{ value: PptxAnimationTrigger; key: string }> = [
	{ value: 'onClick', key: 'pptx.animation.trigger.onClick' },
	{ value: 'onShapeClick', key: 'pptx.animation.trigger.onClick' },
	{ value: 'onHover', key: 'pptx.animation.trigger.onHover' },
	{ value: 'withPrevious', key: 'pptx.animation.trigger.withPrevious' },
	{ value: 'afterPrevious', key: 'pptx.animation.trigger.afterPrevious' },
	{ value: 'afterDelay', key: 'pptx.animation.trigger.afterDelay' },
];

/**
 * The step's effect name.
 *
 * This used to look the element's preset token up in core's OOXML catalogue,
 * which is keyed by wire ids (`entr.1`) and so never matched an editor token
 * (`fadeIn`); the fallback then printed that token straight into the step row.
 * The shared resolver understands both vocabularies and answers with an i18n
 * key, so the step reads "Fade In" in every language.
 */
function presetLabel(anim: PptxElementAnimation, translate: TranslateService): string {
	return translate.instant(animationEffectLabelKey(anim));
}

function triggerLabel(
	trigger: PptxAnimationTrigger | undefined,
	translate: TranslateService,
): string {
	const key =
		TRIGGER_LABEL_KEYS.find((o) => o.value === trigger)?.key ?? 'pptx.animation.trigger.onClick';
	return translate.instant(key);
}

@Component({
	selector: 'pptx-animation-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	styles: `
		.pptx-ng-anim-panel {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			padding: 0.5rem;
			border: 1px solid var(--pptx-ng-border, #d4d4d8);
			border-radius: 0.375rem;
			background: var(--pptx-ng-card, #fff);
			font-size: 0.75rem;
		}

		.pptx-ng-anim-heading {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			font-size: 0.6875rem;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-ng-muted, #71717a);
		}

		.pptx-ng-anim-progress {
			font-variant-numeric: tabular-nums;
		}

		.pptx-ng-anim-controls {
			display: flex;
			gap: 0.25rem;
		}

		.pptx-ng-anim-btn {
			flex: 1;
			padding: 0.375rem 0.5rem;
			border: 1px solid var(--pptx-ng-border, #d4d4d8);
			border-radius: 0.25rem;
			background: var(--pptx-ng-muted-bg, #f4f4f5);
			color: inherit;
			font-size: 0.75rem;
			cursor: pointer;
		}

		.pptx-ng-anim-btn--primary {
			background: var(--pptx-ng-primary, #2563eb);
			border-color: var(--pptx-ng-primary, #2563eb);
			color: #fff;
		}

		.pptx-ng-anim-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.pptx-ng-anim-list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		.pptx-ng-anim-row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			padding: 0.25rem 0.375rem;
			border: 1px solid var(--pptx-ng-border, #d4d4d8);
			border-radius: 0.25rem;
			background: var(--pptx-ng-muted-bg, #f4f4f5);
			color: inherit;
			font: inherit;
			text-align: left;
			cursor: pointer;
		}

		.pptx-ng-anim-row--revealed {
			background: var(--pptx-ng-accent-bg, #dbeafe);
			border-color: var(--pptx-ng-primary, #2563eb);
		}

		.pptx-ng-anim-step-no {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.25rem;
			height: 1.25rem;
			border-radius: 50%;
			background: var(--pptx-ng-border, #d4d4d8);
			font-size: 0.6875rem;
			line-height: 1;
		}

		.pptx-ng-anim-name {
			flex: 1;
			font-weight: 500;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.pptx-ng-anim-trigger {
			color: var(--pptx-ng-muted, #71717a);
		}

		.pptx-ng-anim-empty {
			margin: 0;
			color: var(--pptx-ng-muted, #71717a);
		}
	`,
	template: `
		<div class="pptx-ng-anim-panel">
			<div class="pptx-ng-anim-heading">
				<span>{{ 'pptx.animations.animations' | translate }}</span>
				<span class="pptx-ng-anim-progress">{{ step() }} / {{ stepCount() }}</span>
			</div>

			<div class="pptx-ng-anim-controls">
				@if (isPlaying()) {
					<button
						type="button"
						class="pptx-ng-anim-btn pptx-ng-anim-btn--primary"
						(click)="pauseRequested.emit()"
					>
						{{ 'pptx.animations.pause' | translate }}
					</button>
				} @else {
					<button
						type="button"
						class="pptx-ng-anim-btn pptx-ng-anim-btn--primary"
						[disabled]="isComplete()"
						(click)="playRequested.emit()"
					>
						{{ 'pptx.animations.play' | translate }}
					</button>
				}
				<button
					type="button"
					class="pptx-ng-anim-btn"
					[disabled]="isComplete()"
					(click)="stepRequested.emit()"
				>
					{{ 'pptx.animations.step' | translate }}
				</button>
				<button
					type="button"
					class="pptx-ng-anim-btn"
					[disabled]="step() === 0"
					(click)="resetRequested.emit()"
				>
					{{ 'pptx.animations.reset' | translate }}
				</button>
			</div>

			@if (steps().length > 0) {
				<ul class="pptx-ng-anim-list">
					@for (s of steps(); track s.index) {
						<li>
							<button
								type="button"
								class="pptx-ng-anim-row"
								[class.pptx-ng-anim-row--revealed]="s.revealed"
								[attr.aria-pressed]="s.revealed"
								(click)="seek.emit(s.index)"
							>
								<span class="pptx-ng-anim-step-no">{{ s.index }}</span>
								<span class="pptx-ng-anim-name">{{ s.label }}</span>
								<span class="pptx-ng-anim-trigger">{{ s.trigger }}</span>
							</button>
						</li>
					}
				</ul>
			} @else {
				<p class="pptx-ng-anim-empty">{{ 'pptx.animations.noAnimations' | translate }}</p>
			}
		</div>
	`,
})
export class AnimationPanelComponent {
	private readonly translate = inject(TranslateService);

	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	readonly groups = input.required<AnimationClickGroup[]>();
	readonly step = input<number>(0);
	readonly isPlaying = input<boolean>(false);

	// ------------------------------------------------------------------
	// Outputs (intents: the host drives AnimationPlaybackService)
	// ------------------------------------------------------------------

	readonly playRequested = output<void>();
	readonly pauseRequested = output<void>();
	readonly stepRequested = output<void>();
	readonly resetRequested = output<void>();
	/** Jump to a 1-based step index (the number of groups to reveal). */
	readonly seek = output<number>();

	// ------------------------------------------------------------------
	// Derived view state
	// ------------------------------------------------------------------

	protected readonly stepCount = computed<number>(() => this.groups().length);

	protected readonly isComplete = computed<boolean>(() => this.step() >= this.stepCount());

	protected readonly steps = computed<AnimationStepView[]>(() => {
		const current = this.step();
		return this.groups().map((group, i) => {
			const index = i + 1;
			const first = group.animations[0];
			const extra = group.animations.length - 1;
			const base = first
				? presetLabel(first, this.translate)
				: this.translate.instant('pptx.animation.animation');
			const label =
				extra > 0 ? this.translate.instant('pptx.animationPanel.stepsMore', { base, extra }) : base;
			return {
				index,
				label,
				trigger: triggerLabel(first?.trigger, this.translate),
				revealed: index <= current,
			};
		});
	});
}
