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

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LucideArrowDown, LucideArrowUp, LucideX } from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type {
	PptxAfterAnimationAction,
	PptxAnimationDirection,
	PptxAnimationTimelineAnchor,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';

import {
	applyMotionPathPreset,
	clearMotionPath,
	moveAnimationTimelineRowBy,
} from '../internal/shared';
import { AfterAnimationRowComponent } from './after-animation-row.component';
import {
	ANIMATION_NUMBER_SETTERS,
	ANIMATION_SELECT_SETTERS,
	numberFromInput,
	setTriggerShape,
	stringFromSelect,
} from './animation-author-fields';
import type { AnimationNumberField, AnimationSelectField } from './animation-author-fields';
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
	getEffectSoundState,
	hasAnimation,
	removeAnimation,
	setAfterAnimation,
	setAfterAnimationColor,
	setDirection,
	setEffectSound,
	showDirectionPicker,
} from './animation-author-helpers';
import { getAnimationElementLabel, getAnimationTriggerElements } from './animation-author-view';
import { previewAngularAnimation } from './animation-preview-player';
import { AnimationTimelineComponent } from './animation-timeline.component';
import type { EffectSoundPick } from './effect-sound-row.component';
import { EffectSoundRowComponent } from './effect-sound-row.component';
import { MotionPathRowComponent } from './motion-path-row.component';

@Component({
	selector: 'pptx-animation-author-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslatePipe,
		LucideX,
		LucideArrowUp,
		LucideArrowDown,
		AnimationTimelineComponent,
		MotionPathRowComponent,
		EffectSoundRowComponent,
		AfterAnimationRowComponent,
	],
	templateUrl: './animation-author-panel.component.html',
	styleUrl: './animation-author-panel.component.css',
})
export class AnimationAuthorPanelComponent {
	private readonly translate = inject(TranslateService);

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
	/** Every element on the active slide, including elements with no animation. */
	readonly slideElements = input<readonly PptxElement[]>([]);
	/** Read-only anchors for the deck's own effect groups; see {@link PptxAnimationTimelineAnchor}. */
	readonly animationTimelineAnchors = input<readonly PptxAnimationTimelineAnchor[]>([]);

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

	/** Effect sound picker state: whether a sound is set, and its display name. */
	protected readonly soundState = computed(() =>
		getEffectSoundState(this.animations(), this.element().id),
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
		return this.translate.instant('pptx.findReplace.matchCount', {
			current: idx + 1,
			total: sorted.length,
		});
	});

	/**
	 * Every other element on the active slide, including elements that do not
	 * yet have an animation entry. Used by the on-shape-click trigger picker.
	 */
	protected readonly otherElements = computed(() =>
		getAnimationTriggerElements(this.slideElements(), this.element().id),
	);
	protected elementLabel(element: PptxElement): string {
		return getAnimationElementLabel(element);
	}

	// ── Emit helper ──────────────────────────────────────────────────────────

	private emit(updated: PptxElementAnimation[]): void {
		if (!this.canEdit()) {
			return;
		}
		this.animationsChange.emit(updated);
	}

	protected onPreview(): void {
		const animation = this.current();
		if (animation) {
			previewAngularAnimation(animation);
		}
	}

	// ── Control handlers ─────────────────────────────────────────────────────

	/**
	 * Every `<select>` in the panel commits through here. The field name picks the
	 * shared patch builder out of {@link ANIMATION_SELECT_SETTERS}; see that
	 * module for why there is one handler rather than seven.
	 */
	protected onSelect(event: Event, field: AnimationSelectField): void {
		const value = stringFromSelect(event);
		if (value === undefined) {
			return;
		}
		const apply = ANIMATION_SELECT_SETTERS[field] as (
			animations: readonly PptxElementAnimation[],
			elementId: string,
			value: string,
		) => PptxElementAnimation[];
		this.emit(apply(this.animations(), this.element().id, value));
	}

	/** Every numeric `<input>` in the panel commits through here. */
	protected onNumber(event: Event, field: AnimationNumberField): void {
		const value = numberFromInput(event);
		if (value === null) {
			return;
		}
		this.emit(ANIMATION_NUMBER_SETTERS[field](this.animations(), this.element().id, value));
	}

	/**
	 * The trigger-shape picker is the exception to the table above: its empty
	 * option means "no trigger shape" and must reach the setter as `undefined`
	 * rather than being ignored.
	 */
	protected onTriggerShapeChange(event: Event): void {
		const value = stringFromSelect(event);
		this.emit(
			setTriggerShape(
				this.animations(),
				this.element().id,
				value && value.length > 0 ? value : undefined,
			),
		);
	}

	// ── Motion path ───────────────────────────────────────────────────────────

	/**
	 * Apply or clear the element's motion path.
	 *
	 * The path lives on the SAME animation entry as the preset buckets, so this
	 * deliberately does not go through the preset setters: applying a path must
	 * leave an existing entrance alone, and clearing one must drop the entry only
	 * when nothing else is left on it. Both rules live in the shared helpers.
	 */
	protected onMotionPathChange(presetId: string): void {
		const animations = this.animations();
		const elementId = this.element().id;
		this.emit(
			presetId === 'none'
				? clearMotionPath(animations, elementId)
				: applyMotionPathPreset(animations, elementId, presetId),
		);
	}

	// ── Direction (button group, not a select) ───────────────────────────────

	protected onDirectionChange(dir: PptxAnimationDirection): void {
		this.emit(setDirection(this.animations(), this.element().id, dir));
	}

	// ── Effect sound ──────────────────────────────────────────────────────────

	protected onEffectSoundPick(pick: EffectSoundPick | undefined): void {
		this.emit(setEffectSound(this.animations(), this.element().id, pick));
	}

	// ── After animation ───────────────────────────────────────────────────────
	// Its own row component emits already-parsed values (not raw DOM events,
	// unlike the generic `<select>`/`<input>` dispatch above), so both handlers
	// are dedicated, the same way `onDirectionChange` is for the button group.

	protected onAfterAnimationChange(action: PptxAfterAnimationAction): void {
		this.emit(setAfterAnimation(this.animations(), this.element().id, action));
	}

	protected onAfterAnimationColorChange(color: string): void {
		this.emit(setAfterAnimationColor(this.animations(), this.element().id, color));
	}

	// ── Order controls ────────────────────────────────────────────────────────

	/**
	 * Move the selected element's own animation one step within the FULL
	 * sequence (editor effects merged with the deck's read-only anchors), so
	 * these can place it ahead of or behind a native effect, not just among
	 * the effects this editor added.
	 */
	private moveOneStep(delta: -1 | 1): void {
		this.emit(
			moveAnimationTimelineRowBy(
				this.animations(),
				this.animationTimelineAnchors(),
				this.element().id,
				delta,
			),
		);
	}

	protected onMoveUp(): void {
		this.moveOneStep(-1);
	}

	protected onMoveDown(): void {
		this.moveOneStep(1);
	}

	// ── Remove ────────────────────────────────────────────────────────────────

	protected onRemove(): void {
		this.emit(removeAnimation(this.animations(), this.element().id));
	}
}
