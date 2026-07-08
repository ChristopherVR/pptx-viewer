/**
 * animation-author-panel.component.ts: Animation authoring inspector sub-panel.
 *
 * Selector: `pptx-animation-author-panel`
 *
 * Ported from / models the patterns in:
 *   packages/react/src/viewer/components/inspector/AnimationPanel.tsx
 *   packages/react/src/viewer/components/inspector/useAnimationHandlers.ts
 *   packages/angular/src/viewer/inspector-panel.component.ts
 *
 * Contract
 * ────────
 *   [element]           : the selected PptxElement (required)
 *   [slideIndex]        : zero-based index of the active slide (required)
 *   [animations]        : the active slide's PptxElementAnimation[] (required)
 *   [canEdit]           : whether editing is permitted (default: true)
 *   (animationsChange)  : emits the full updated PptxElementAnimation[] for the
 *                         orchestrator to commit via
 *                         EditorStateService.updateSlide(slideIndex, { animations })
 *
 * Animation data lives on the SLIDE, keyed by elementId, NOT on the element.
 * This component reads and emits the entire slide-level animations array.
 * All pure mutations are delegated to animation-author-helpers.ts.
 *
 * @module viewer/animation-author-panel
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideArrowDown, LucideArrowUp, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type {
	PptxAnimationDirection,
	PptxAnimationPreset,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';

import {
	DIRECTION_OPTIONS,
	EMPHASIS_PRESETS,
	ENTRANCE_PRESETS,
	EXIT_PRESETS,
	REPEAT_MODE_OPTIONS,
	SEQUENCE_OPTIONS,
	TIMING_CURVE_OPTIONS,
	TRIGGER_OPTIONS,
	animationFor,
	hasAnimation,
	removeAnimation,
	reorderAnimationDown,
	reorderAnimationUp,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
	setDelay,
	setDirection,
	setDuration,
	setRepeatCount,
	setRepeatMode,
	setSequence,
	setTimingCurve,
	setTrigger,
	setTriggerShapeId,
	showDirectionPicker,
} from './animation-author-helpers';

@Component({
	selector: 'pptx-animation-author-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideX, LucideArrowUp, LucideArrowDown],
	template: `
		<aside class="pptx-ng-anim" [attr.aria-label]="'pptx.animations.propertiesLabel' | translate">
			<!-- ── Header ───────────────────────────────────────────────────── -->
			<div class="pptx-ng-anim__header">
				<span class="pptx-ng-anim__title">{{ 'pptx.animations.animation' | translate }}</span>
				@if (currentHasAnimation()) {
					<button
						type="button"
						class="pptx-ng-anim__remove-btn inline-flex items-center gap-1"
						[title]="'pptx.animations.removeFromElement' | translate"
						(click)="onRemove()"
					>
						<svg lucideX class="h-3.5 w-3.5"></svg> {{ 'pptx.animations.remove' | translate }}
					</button>
				}
			</div>

			<!-- ── Entrance preset ──────────────────────────────────────────── -->
			<section class="pptx-ng-anim__section">
				<label class="pptx-ng-anim__label" for="anim-entrance">{{
					'pptx.animations.group.entrance' | translate
				}}</label>
				<select
					id="anim-entrance"
					class="pptx-ng-anim__select"
					[disabled]="!canEdit()"
					[value]="current()?.entrance ?? 'none'"
					(change)="onEntranceChange($event)"
				>
					<option value="none">{{ 'pptx.animations.noneOption' | translate }}</option>
					@for (opt of entrancePresets; track opt.value) {
						<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
					}
				</select>
			</section>

			<!-- ── Emphasis preset ──────────────────────────────────────────── -->
			<section class="pptx-ng-anim__section">
				<label class="pptx-ng-anim__label" for="anim-emphasis">{{
					'pptx.animations.group.emphasis' | translate
				}}</label>
				<select
					id="anim-emphasis"
					class="pptx-ng-anim__select"
					[disabled]="!canEdit()"
					[value]="current()?.emphasis ?? 'none'"
					(change)="onEmphasisChange($event)"
				>
					<option value="none">{{ 'pptx.animations.noneOption' | translate }}</option>
					@for (opt of emphasisPresets; track opt.value) {
						<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
					}
				</select>
			</section>

			<!-- ── Exit preset ──────────────────────────────────────────────── -->
			<section class="pptx-ng-anim__section">
				<label class="pptx-ng-anim__label" for="anim-exit">{{
					'pptx.animations.group.exit' | translate
				}}</label>
				<select
					id="anim-exit"
					class="pptx-ng-anim__select"
					[disabled]="!canEdit()"
					[value]="current()?.exit ?? 'none'"
					(change)="onExitChange($event)"
				>
					<option value="none">{{ 'pptx.animations.noneOption' | translate }}</option>
					@for (opt of exitPresets; track opt.value) {
						<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
					}
				</select>
			</section>

			<!-- ── Effect options: only shown when an animation is set ─────── -->
			@if (currentHasAnimation()) {
				<!-- ── Direction picker (directional presets only) ──────────── -->
				@if (currentShowDirection()) {
					<section class="pptx-ng-anim__section">
						<span class="pptx-ng-anim__label">{{ 'pptx.animations.direction' | translate }}</span>
						<div class="pptx-ng-anim__direction-grid">
							@for (opt of directionOptions; track opt.value) {
								<button
									type="button"
									class="pptx-ng-anim__dir-btn"
									[class.is-active]="current()?.direction === opt.value"
									[disabled]="!canEdit()"
									[title]="opt.labelKey | translate"
									(click)="onDirectionChange(opt.value)"
								>
									{{ opt.arrow }}
								</button>
							}
						</div>
					</section>
				}

				<!-- ── Sequence ─────────────────────────────────────────────── -->
				<section class="pptx-ng-anim__section">
					<label class="pptx-ng-anim__label" for="anim-sequence">{{
						'pptx.animations.sequence' | translate
					}}</label>
					<select
						id="anim-sequence"
						class="pptx-ng-anim__select"
						[disabled]="!canEdit()"
						[value]="current()?.sequence ?? 'asOne'"
						(change)="onSequenceChange($event)"
					>
						@for (opt of sequenceOptions; track opt.value) {
							<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
						}
					</select>
				</section>

				<!-- ── Timing heading ────────────────────────────────────────── -->
				<div class="pptx-ng-anim__subheading">{{ 'pptx.animations.timing' | translate }}</div>

				<!-- ── Trigger ──────────────────────────────────────────────── -->
				<section class="pptx-ng-anim__section">
					<label class="pptx-ng-anim__label" for="anim-trigger">{{
						'pptx.animations.trigger' | translate
					}}</label>
					<select
						id="anim-trigger"
						class="pptx-ng-anim__select"
						[disabled]="!canEdit()"
						[value]="current()?.trigger ?? 'onClick'"
						(change)="onTriggerChange($event)"
					>
						@for (opt of triggerOptions; track opt.value) {
							<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
						}
					</select>
				</section>

				<!-- ── Trigger shape (onShapeClick only) ─────────────────────── -->
				@if (current()?.trigger === 'onShapeClick') {
					<section class="pptx-ng-anim__section">
						<label class="pptx-ng-anim__label" for="anim-trigger-shape">{{
							'pptx.animations.triggerShape' | translate
						}}</label>
						<select
							id="anim-trigger-shape"
							class="pptx-ng-anim__select"
							[disabled]="!canEdit()"
							[value]="current()?.triggerShapeId ?? ''"
							(change)="onTriggerShapeChange($event)"
						>
							<option value="">{{ 'pptx.animations.selectShapeOption' | translate }}</option>
							@for (el of otherElements(); track el.id) {
								<option [value]="el.id">{{ el.id }}</option>
							}
						</select>
					</section>
				}

				<!-- ── Duration ─────────────────────────────────────────────── -->
				<section class="pptx-ng-anim__section">
					@if (elementKey(); as key) {
						<div [attr.data-el-key]="key">
							<label class="pptx-ng-anim__label" for="anim-duration">{{
								'pptx.animations.durationMs' | translate
							}}</label>
							<input
								id="anim-duration"
								class="pptx-ng-anim__input"
								type="number"
								inputmode="numeric"
								min="100"
								max="10000"
								step="50"
								[disabled]="!canEdit()"
								[value]="seed().durationMs"
								(change)="onDurationChange($event)"
							/>
						</div>
					}
				</section>

				<!-- ── Delay ────────────────────────────────────────────────── -->
				<section class="pptx-ng-anim__section">
					@if (elementKey(); as key) {
						<div [attr.data-el-key]="key">
							<label class="pptx-ng-anim__label" for="anim-delay">{{
								'pptx.animations.delayMs' | translate
							}}</label>
							<input
								id="anim-delay"
								class="pptx-ng-anim__input"
								type="number"
								inputmode="numeric"
								min="0"
								max="10000"
								step="50"
								[disabled]="!canEdit()"
								[value]="seed().delayMs"
								(change)="onDelayChange($event)"
							/>
						</div>
					}
				</section>

				<!-- ── Timing curve ──────────────────────────────────────────── -->
				<section class="pptx-ng-anim__section">
					<label class="pptx-ng-anim__label" for="anim-timing-curve">{{
						'pptx.animations.timingCurve' | translate
					}}</label>
					<select
						id="anim-timing-curve"
						class="pptx-ng-anim__select"
						[disabled]="!canEdit()"
						[value]="current()?.timingCurve ?? 'ease'"
						(change)="onTimingCurveChange($event)"
					>
						@for (opt of timingCurveOptions; track opt.value) {
							<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
						}
					</select>
				</section>

				<!-- ── Repeat count ──────────────────────────────────────────── -->
				<section class="pptx-ng-anim__section">
					@if (elementKey(); as key) {
						<div [attr.data-el-key]="key">
							<label class="pptx-ng-anim__label" for="anim-repeat-count">{{
								'pptx.animations.repeat' | translate
							}}</label>
							<input
								id="anim-repeat-count"
								class="pptx-ng-anim__input"
								type="number"
								inputmode="numeric"
								min="1"
								max="100"
								step="1"
								[disabled]="!canEdit()"
								[value]="seed().repeatCount"
								(change)="onRepeatCountChange($event)"
							/>
						</div>
					}
				</section>

				<!-- ── Repeat mode ───────────────────────────────────────────── -->
				<section class="pptx-ng-anim__section">
					<label class="pptx-ng-anim__label" for="anim-repeat-mode">{{
						'pptx.animations.repeatUntil' | translate
					}}</label>
					<select
						id="anim-repeat-mode"
						class="pptx-ng-anim__select"
						[disabled]="!canEdit()"
						[value]="current()?.repeatMode ?? 'none'"
						(change)="onRepeatModeChange($event)"
					>
						@for (opt of repeatModeOptions; track opt.value) {
							<option [value]="opt.value">{{ opt.labelKey | translate }}</option>
						}
					</select>
				</section>

				<!-- ── Order controls ────────────────────────────────────────── -->
				<section class="pptx-ng-anim__section">
					<span class="pptx-ng-anim__label">{{
						'pptx.animations.order' | translate: { value: orderLabel() }
					}}</span>
					<div class="pptx-ng-anim__row">
						<button
							type="button"
							class="pptx-ng-anim__order-btn inline-flex items-center gap-1"
							[disabled]="!canEdit()"
							[title]="'pptx.animations.moveEarlier' | translate"
							(click)="onMoveUp()"
						>
							<svg lucideArrowUp class="h-3.5 w-3.5"></svg>
							{{ 'pptx.animations.earlier' | translate }}
						</button>
						<button
							type="button"
							class="pptx-ng-anim__order-btn inline-flex items-center gap-1"
							[disabled]="!canEdit()"
							[title]="'pptx.animations.moveLater' | translate"
							(click)="onMoveDown()"
						>
							<svg lucideArrowDown class="h-3.5 w-3.5"></svg>
							{{ 'pptx.animations.later' | translate }}
						</button>
					</div>
				</section>
			}
			<!-- end @if (currentHasAnimation()) -->
		</aside>
	`,
	styles: `
		.pptx-ng-anim {
			display: flex;
			flex-direction: column;
			gap: 0;
			padding: 0.5rem;
			background: var(--pptx-inspector-bg, #1e1e1e);
			color: var(--pptx-inspector-fg, #e0e0e0);
			font-size: 12px;
			min-width: 220px;
			overflow-y: auto;
		}

		.pptx-ng-anim__header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding-bottom: 0.4rem;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
			margin-bottom: 0.35rem;
		}

		.pptx-ng-anim__title {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
		}

		.pptx-ng-anim__subheading {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			padding: 0.4rem 0 0.2rem;
			border-top: 1px solid var(--pptx-inspector-border, #333);
			margin-top: 0.2rem;
		}

		.pptx-ng-anim__section {
			padding: 0.25rem 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #2a2a2a);
		}

		.pptx-ng-anim__section:last-child {
			border-bottom: none;
		}

		.pptx-ng-anim__label {
			display: block;
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
			margin-bottom: 0.2rem;
		}

		.pptx-ng-anim__select,
		.pptx-ng-anim__input {
			width: 100%;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 3px 6px;
			font-size: 12px;
			box-sizing: border-box;
		}

		.pptx-ng-anim__select:disabled,
		.pptx-ng-anim__input:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.pptx-ng-anim__direction-grid {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		.pptx-ng-anim__dir-btn {
			width: 30px;
			height: 30px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			font-size: 14px;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.pptx-ng-anim__dir-btn.is-active {
			background: var(--pptx-inspector-active, #0078d4);
			border-color: var(--pptx-inspector-active, #0078d4);
			color: #fff;
		}

		.pptx-ng-anim__dir-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.pptx-ng-anim__row {
			display: flex;
			gap: 0.35rem;
		}

		.pptx-ng-anim__order-btn {
			flex: 1;
			padding: 3px 6px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			font-size: 11px;
			white-space: nowrap;
		}

		.pptx-ng-anim__order-btn:hover:not(:disabled) {
			background: var(--pptx-inspector-hover, #3a3a3a);
		}

		.pptx-ng-anim__order-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.pptx-ng-anim__remove-btn {
			padding: 2px 6px;
			background: transparent;
			border: 1px solid var(--pptx-inspector-danger-border, #6b2a2a);
			color: var(--pptx-inspector-danger, #f47c7c);
			border-radius: 3px;
			cursor: pointer;
			font-size: 10px;
		}

		.pptx-ng-anim__remove-btn:hover {
			background: var(--pptx-inspector-danger-hover, #4a1a1a);
		}

		/* ── Touch / mobile ──────────────────────────────────────────────────── */
		@media (pointer: coarse), (max-width: 640px) {
			.pptx-ng-anim {
				width: 100%;
				min-width: 0;
				box-sizing: border-box;
				font-size: 14px;
			}

			.pptx-ng-anim__select,
			.pptx-ng-anim__input {
				min-height: 40px;
				font-size: 16px; /* prevents iOS auto-zoom */
				padding: 6px 8px;
			}

			.pptx-ng-anim__dir-btn {
				width: 40px;
				height: 40px;
			}

			.pptx-ng-anim__order-btn {
				min-height: 40px;
				font-size: 13px;
			}
		}
	`,
})
export class AnimationAuthorPanelComponent {
	/** The selected element whose animation settings are being authored. */
	readonly element = input.required<PptxElement>();

	/** Zero-based index of the active slide (used by the orchestrator to commit). */
	readonly slideIndex = input.required<number>();

	/**
	 * The active slide's full `PptxElementAnimation[]` array. Animations are
	 * stored on the slide, NOT on the element; this component reads and
	 * emits the entire array.
	 */
	readonly animations = input.required<readonly PptxElementAnimation[]>();

	/**
	 * Whether editing controls are enabled. When `false` all selects/inputs are
	 * disabled. Defaults to `true`.
	 */
	readonly canEdit = input<boolean>(true);

	/**
	 * Emits the full updated `PptxElementAnimation[]` whenever a change is made.
	 * The orchestrator should apply this via:
	 *   `EditorStateService.updateSlide(slideIndex(), { animations: $event })`
	 */
	readonly animationsChange = output<PptxElementAnimation[]>();

	// ── Option catalog references (template-accessible) ──────────────────────

	protected readonly entrancePresets = ENTRANCE_PRESETS;
	protected readonly exitPresets = EXIT_PRESETS;
	protected readonly emphasisPresets = EMPHASIS_PRESETS;
	protected readonly triggerOptions = TRIGGER_OPTIONS;
	protected readonly timingCurveOptions = TIMING_CURVE_OPTIONS;
	protected readonly repeatModeOptions = REPEAT_MODE_OPTIONS;
	protected readonly directionOptions = DIRECTION_OPTIONS;
	protected readonly sequenceOptions = SEQUENCE_OPTIONS;

	// ── Stable identity key (caret-reset guard for number inputs) ────────────

	/**
	 * Changes only when a *different* element is selected. Used as the
	 * `data-el-key` attribute to key number inputs so Angular's [value]
	 * binding is never rewritten mid-edit.
	 */
	protected readonly elementKey = computed(() => this.element().id);

	// ── Derived animation state ───────────────────────────────────────────────

	/** The animation entry for the currently selected element, if any. */
	protected readonly current = computed(() => animationFor(this.animations(), this.element().id));

	/** True when the element has at least one effect (entrance/exit/emphasis). */
	protected readonly currentHasAnimation = computed(() =>
		hasAnimation(this.animations(), this.element().id),
	);

	/** True when the active preset exposes a direction picker. */
	protected readonly currentShowDirection = computed(() =>
		showDirectionPicker(this.animations(), this.element().id),
	);

	/**
	 * Stable seed for number inputs, recomputed only on element change so
	 * live typing does not reset the input value while the user is mid-edit.
	 */
	protected readonly seed = computed(() => {
		// Depend on elementKey so this signal re-fires only on element switch.
		this.elementKey();
		const cur = this.current();
		return {
			durationMs: cur?.durationMs ?? 500,
			delayMs: cur?.delayMs ?? 0,
			repeatCount: cur?.repeatCount ?? 1,
		};
	});

	/** Human-readable order label (1-based, e.g. "2 of 4"). */
	protected readonly orderLabel = computed(() => {
		const sorted = [...this.animations()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		const idx = sorted.findIndex((a) => a.elementId === this.element().id);
		if (idx < 0) {
			return '—';
		}
		return `${idx + 1} of ${sorted.length}`;
	});

	/**
	 * Elements on the slide excluding the selected element, used to populate
	 * the trigger-shape selector. The slide's elements are not available in this
	 * component's inputs, so the orchestrator must pass them in via
	 * `[animations]` indirectly; here we surface only what we have access to.
	 *
	 * NOTE: The trigger-shape dropdown is limited to element ids because this
	 * panel does not receive the full slide element list. The orchestrator can
	 * replace this with a richer element label by wrapping the component or
	 * projecting content. This matches the React implementation which used
	 * `activeSlide.elements`.
	 */
	protected readonly otherElements = computed((): Array<{ id: string }> => {
		// Since we only have `animations`, return the element ids from the
		// animation list as a fallback. A richer label can be provided by
		// the orchestrator via a dedicated `[slideElements]` input if needed.
		return this.animations()
			.filter((a) => a.elementId !== this.element().id)
			.map((a) => ({ id: a.elementId }));
	});

	// ── Emit helper ──────────────────────────────────────────────────────────

	private emit(updated: PptxElementAnimation[]): void {
		this.animationsChange.emit(updated);
	}

	// ── Preset handlers ───────────────────────────────────────────────────────

	protected onEntranceChange(event: Event): void {
		const value = stringFromSelect(event) as PptxAnimationPreset | 'none' | undefined;
		if (value === undefined) {
			return;
		}
		this.emit(setAnimationEntrance(this.animations(), this.element().id, value));
	}

	protected onExitChange(event: Event): void {
		const value = stringFromSelect(event) as PptxAnimationPreset | 'none' | undefined;
		if (value === undefined) {
			return;
		}
		this.emit(setAnimationExit(this.animations(), this.element().id, value));
	}

	protected onEmphasisChange(event: Event): void {
		const value = stringFromSelect(event) as PptxAnimationPreset | 'none' | undefined;
		if (value === undefined) {
			return;
		}
		this.emit(setAnimationEmphasis(this.animations(), this.element().id, value));
	}

	// ── Trigger handlers ─────────────────────────────────────────────────────

	protected onTriggerChange(event: Event): void {
		const value = stringFromSelect(event) as PptxAnimationTrigger | undefined;
		if (!value) {
			return;
		}
		this.emit(setTrigger(this.animations(), this.element().id, value));
	}

	protected onTriggerShapeChange(event: Event): void {
		const value = stringFromSelect(event);
		this.emit(
			setTriggerShapeId(
				this.animations(),
				this.element().id,
				value && value.length > 0 ? value : undefined,
			),
		);
	}

	// ── Timing handlers ───────────────────────────────────────────────────────

	protected onDurationChange(event: Event): void {
		const val = numberFromInput(event);
		if (val === null) {
			return;
		}
		this.emit(setDuration(this.animations(), this.element().id, val));
	}

	protected onDelayChange(event: Event): void {
		const val = numberFromInput(event);
		if (val === null) {
			return;
		}
		this.emit(setDelay(this.animations(), this.element().id, val));
	}

	protected onTimingCurveChange(event: Event): void {
		const value = stringFromSelect(event) as PptxAnimationTimingCurve | undefined;
		if (!value) {
			return;
		}
		this.emit(setTimingCurve(this.animations(), this.element().id, value));
	}

	protected onRepeatCountChange(event: Event): void {
		const val = numberFromInput(event);
		if (val === null) {
			return;
		}
		this.emit(setRepeatCount(this.animations(), this.element().id, val));
	}

	protected onRepeatModeChange(event: Event): void {
		const value = stringFromSelect(event) as PptxAnimationRepeatMode | 'none' | undefined;
		if (value === undefined) {
			return;
		}
		this.emit(setRepeatMode(this.animations(), this.element().id, value));
	}

	// ── Direction / sequence ─────────────────────────────────────────────────

	protected onDirectionChange(dir: PptxAnimationDirection): void {
		this.emit(setDirection(this.animations(), this.element().id, dir));
	}

	protected onSequenceChange(event: Event): void {
		const value = stringFromSelect(event) as PptxAnimationSequence | undefined;
		if (!value) {
			return;
		}
		this.emit(setSequence(this.animations(), this.element().id, value));
	}

	// ── Order controls ────────────────────────────────────────────────────────

	protected onMoveUp(): void {
		this.emit(reorderAnimationUp(this.animations(), this.element().id));
	}

	protected onMoveDown(): void {
		this.emit(reorderAnimationDown(this.animations(), this.element().id));
	}

	// ── Remove ────────────────────────────────────────────────────────────────

	protected onRemove(): void {
		this.emit(removeAnimation(this.animations(), this.element().id));
	}
}

// ==========================================================================
// Module-private DOM helpers
// ==========================================================================

/** Extract the string value from a <select> change event, or undefined. */
function stringFromSelect(event: Event): string | undefined {
	const target = event.target;
	if (!(target instanceof HTMLSelectElement)) {
		return undefined;
	}
	return target.value;
}

/** Extract a finite number from an <input> change event, or null. */
function numberFromInput(event: Event): number | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
		return null;
	}
	const parsed = parseFloat(target.value);
	return Number.isFinite(parsed) ? parsed : null;
}
