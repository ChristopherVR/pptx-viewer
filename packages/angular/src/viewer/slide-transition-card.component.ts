/**
 * slide-transition-card.component.ts: the SLIDE TRANSITION card of the default
 * (no-selection) inspector, mirroring React's
 * `inspector/SlideTransitionSection.tsx` (reached there through
 * `SlideProperties`, here through the Properties tab beside SLIDE SIZE).
 *
 * Selector: `pptx-slide-transition-card`
 *
 * WHY the conditional controls: OOXML overloads a transition's `dir` attribute.
 * Most types take a compass token, the blinds/checker/comb/randomBar family
 * takes `horz`/`vert`, and `wheel` takes a spoke count instead.
 * `TRANSITION_VALID_DIRECTIONS` (core) and `TRANSITION_ORIENTATION_TYPES`
 * (shared) decide which control applies, so the card never offers a direction
 * PowerPoint would drop on save.
 *
 * Every edit is a partial MERGE onto the slide's existing transition, so
 * changing the duration cannot silently discard an authored sound or direction
 * the deck already carried. Commits go through `EditorStateService.updateSlide`
 * and are therefore undoable and picked up by the presentation playback.
 *
 * @module viewer/slide-transition-card
 */
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide, PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import { TRANSITION_VALID_DIRECTIONS } from 'pptx-viewer-core';

import {
	SLIDE_TRANSITION_OPTIONS,
	TRANSITION_ORIENTATION_TYPES,
	clampTransitionNumber,
	mergeSlideTransition,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { TransitionDirectionPickerComponent } from './transition-direction-picker.component';
import { TransitionPreviewComponent } from './transition-preview.component';

/** Default duration (ms) shown when the slide declares no transition timing. */
const DEFAULT_DURATION_MS = 320;

/** Bounds mirrored from React's inputs, so both bindings clamp identically. */
const MAX_DURATION_MS = 10000;
const MIN_SPOKES = 1;
const MAX_SPOKES = 8;

@Component({
	selector: 'pptx-slide-transition-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, TransitionDirectionPickerComponent, TransitionPreviewComponent],
	template: `
		@if (activeSlide()) {
			<section class="icard">
				<h3 class="icard__heading">{{ 'pptx.slideInspector.slideTransition' | translate }}</h3>

				<label class="icard__col">
					<span class="icard__label">{{ 'pptx.transition.type' | translate }}</span>
					<select
						class="icard__select"
						[disabled]="!canEdit()"
						[value]="transitionType()"
						[attr.aria-label]="'pptx.transition.type' | translate"
						(change)="onTypeChange($event)"
					>
						@for (option of transitionOptions; track option.value) {
							<option [value]="option.value">{{ option.i18nKey | translate }}</option>
						}
					</select>
				</label>

				@if (directionTokens(); as tokens) {
					<div class="icard__col">
						<span class="icard__label">{{ 'pptx.transition.direction' | translate }}</span>
						<pptx-transition-direction-picker
							[directions]="tokens"
							[value]="transition()?.direction"
							[disabled]="!canEdit()"
							(pick)="onDirection($event)"
						/>
					</div>
				}

				@if (usesOrientation()) {
					<div class="icard__col">
						<span class="icard__label">{{ 'pptx.transition.orientation' | translate }}</span>
						<div class="orient">
							@for (option of orientOptions; track option.value) {
								<button
									type="button"
									class="orient__btn"
									[class.is-active]="orientation() === option.value"
									[disabled]="!canEdit()"
									[attr.aria-pressed]="orientation() === option.value"
									(click)="onOrientation(option.value)"
								>
									{{ option.i18nKey | translate }}
								</button>
							}
						</div>
					</div>
				}

				@if (isWheel()) {
					<label class="icard__row">
						<span class="icard__label">{{ 'pptx.transition.spokes' | translate }}</span>
						<input
							type="number"
							class="icard__input icard__input--number"
							[min]="minSpokes"
							[max]="maxSpokes"
							[disabled]="!canEdit()"
							[value]="spokes()"
							[attr.aria-label]="'pptx.transition.spokes' | translate"
							(change)="onSpokes($event)"
						/>
					</label>
				}

				<label class="icard__row">
					<span class="icard__label">{{ 'pptx.transition.duration' | translate }}</span>
					<input
						type="number"
						class="icard__input icard__input--number"
						min="0"
						[max]="maxDurationMs"
						[disabled]="!canEdit()"
						[value]="durationMs()"
						[attr.aria-label]="'pptx.transition.duration' | translate"
						(change)="onDuration($event)"
					/>
				</label>

				<label class="check">
					<input
						type="checkbox"
						[disabled]="!canEdit()"
						[checked]="advanceOnClick()"
						[attr.aria-label]="'pptx.transition.advanceOnClick' | translate"
						(change)="onAdvanceOnClick($event)"
					/>
					<span>{{ 'pptx.transition.advanceOnClick' | translate }}</span>
				</label>

				@if (transition()?.soundFileName; as sound) {
					<p class="sound">
						<span class="icard__label">{{ 'pptx.transition.sound' | translate }}:</span>
						<b [title]="sound">{{ sound }}</b>
					</p>
				}

				@if (transition(); as current) {
					<pptx-transition-preview [transition]="current" />
				}
			</section>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.orient {
				display: flex;
				gap: 4px;
			}
			.orient__btn {
				padding: 3px 8px;
				background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
				border: 1px solid var(--pptx-inspector-border, #444);
				border-radius: 3px;
				color: inherit;
				font: inherit;
				font-size: 11px;
				cursor: pointer;
			}
			.orient__btn:disabled {
				opacity: 0.5;
				cursor: default;
			}
			.orient__btn.is-active {
				background: var(--pptx-inspector-active, #0078d4);
				border-color: var(--pptx-inspector-active, #0078d4);
				color: #fff;
			}
			.check {
				display: flex;
				align-items: center;
				gap: 6px;
			}
			.sound {
				margin: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		`,
		INSPECTOR_CARD_STYLES,
	],
})
export class SlideTransitionCardComponent {
	/** Zero-based index of the slide whose transition is being edited. */
	readonly slideIndex = input.required<number>();
	/** Whether mutation controls are enabled. */
	readonly canEdit = input<boolean>(true);

	private readonly editor = inject(EditorStateService);

	protected readonly transitionOptions = SLIDE_TRANSITION_OPTIONS;
	protected readonly orientOptions = [
		{ value: 'horz' as const, i18nKey: 'pptx.slideInspector.horizontal' },
		{ value: 'vert' as const, i18nKey: 'pptx.slideInspector.vertical' },
	];
	protected readonly maxDurationMs = MAX_DURATION_MS;
	protected readonly minSpokes = MIN_SPOKES;
	protected readonly maxSpokes = MAX_SPOKES;

	protected readonly activeSlide = computed<PptxSlide | undefined>(
		() => this.editor.slides()[this.slideIndex()],
	);
	protected readonly transition = computed<PptxSlideTransition | undefined>(
		() => this.activeSlide()?.transition,
	);
	protected readonly transitionType = computed<PptxTransitionType>(
		() => this.transition()?.type ?? 'none',
	);
	protected readonly usesOrientation = computed(() =>
		TRANSITION_ORIENTATION_TYPES.has(this.transitionType()),
	);
	protected readonly isWheel = computed(() => this.transitionType() === 'wheel');

	/** Compass tokens for the current type, or undefined when it takes none. */
	protected readonly directionTokens = computed<readonly string[] | undefined>(() => {
		if (this.usesOrientation()) {
			return undefined;
		}
		const valid = TRANSITION_VALID_DIRECTIONS[this.transitionType()];
		return valid && valid.length > 0 ? valid : undefined;
	});

	protected readonly orientation = computed(() => this.transition()?.orient ?? 'horz');
	protected readonly spokes = computed(() => this.transition()?.spokes ?? 4);
	protected readonly durationMs = computed(() =>
		Math.round(this.transition()?.durationMs || DEFAULT_DURATION_MS),
	);
	protected readonly advanceOnClick = computed(() => this.transition()?.advanceOnClick !== false);

	protected onTypeChange(event: Event): void {
		const type = (event.target as HTMLSelectElement).value as PptxTransitionType;
		this.patch({ type });
	}

	protected onDirection(direction: string): void {
		this.patch({ direction });
	}

	protected onOrientation(orient: 'horz' | 'vert'): void {
		this.patch({ orient });
	}

	protected onSpokes(event: Event): void {
		const spokes = clampTransitionNumber(
			Number((event.target as HTMLInputElement).value),
			MIN_SPOKES,
			MAX_SPOKES,
		);
		if (spokes !== null) {
			this.patch({ spokes });
		}
	}

	protected onDuration(event: Event): void {
		const durationMs = clampTransitionNumber(
			Number((event.target as HTMLInputElement).value),
			0,
			MAX_DURATION_MS,
		);
		if (durationMs !== null) {
			this.patch({ durationMs });
		}
	}

	protected onAdvanceOnClick(event: Event): void {
		this.patch({ advanceOnClick: (event.target as HTMLInputElement).checked });
	}

	/** Merge a partial transition change onto the slide as one history entry. */
	private patch(changes: Partial<PptxSlideTransition>): void {
		const transition = mergeSlideTransition(this.transition(), changes);
		this.editor.updateSlide(this.slideIndex(), { transition } as Partial<PptxSlide>);
	}
}
