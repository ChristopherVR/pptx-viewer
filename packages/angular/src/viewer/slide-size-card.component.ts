/**
 * slide-size-card.component.ts: SLIDE SIZE card of the default (no-selection)
 * inspector: PowerPoint's "Slide Size" preset list and Portrait/Landscape
 * toggle over the raw width/height (px) inputs.
 *
 * Every decision here belongs to the shared `render/slide-size` module: which
 * presets exist, which one a size matches, what a preset means in a given
 * orientation, and which of the EMU size / the pixel canvas wins when the two
 * disagree. This component only maps that descriptor onto controls.
 *
 * The EMU size is the persisted one and is deliberately not derived from the
 * pixels: Ledger is 12179300 EMU = 1278.5px, and a round-trip through an
 * integer pixel would cost the deck its `ppSlideSizeLedgerPaper` identity.
 * `resolveSlideSizeSelection` encodes that rule, so both controls write the EMU
 * size AND the canvas size, and the raw W/H inputs write only the canvas (which
 * is exactly the "user typed a custom size" case the rule falls back for).
 *
 * Slide-size RESCALE prompt (shared `render/slide-size-rescale`,
 * `resolveSlideSizeRescaleTransform` / `scaleSlidesForSizeChange`): PowerPoint
 * asks Maximize-or-Ensure-Fit whenever a size change would resize existing
 * content and the deck has content to resize. A size change that leaves the
 * pending prompt unanswered does not commit until the user picks a mode (or
 * there is nothing to scale, in which case it commits immediately, as before).
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
	scaleSlidesForSizeChange,
	SLIDE_SIZE_PRESETS,
	slideSizeFromCanvasPx,
	slideSizeFromPreset,
	slideSizeToCanvasPx,
	withSlideSizeOrientation,
} from '../internal/shared';
import type {
	SlideSizeEmu,
	SlideSizeOrientation,
	SlideSizePreset,
	SlideSizeRescaleMode,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { LoadContentService } from './load-content.service';

/** Sentinel `<option>` value for a size that matches no preset. */
const CUSTOM_PRESET_VALUE = '';

@Component({
	selector: 'pptx-slide-size-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="icard">
			<h3 class="icard__heading">{{ 'pptx.slideSize.title' | translate }}</h3>
			<label class="icard__col">
				<span class="icard__label">{{ 'pptx.slideSize.presets' | translate }}</span>
				<!--
					Selection is marked per OPTION, not with a value binding on the select.
					Angular applies an element's own property bindings before the @for
					inside it has produced any options, so the value binding was assigned
					against an empty list and silently fell back to option 0: a 16:9 deck
					opened reading "On-screen Show (4:3)".
				-->
				<select
					[attr.aria-label]="'pptx.slideSize.presets' | translate"
					class="icard__select"
					data-pptx-slide-size-preset
					[disabled]="!canEdit()"
					(change)="onPresetChange($event)"
				>
					@if (!selection().preset) {
						<option [value]="CUSTOM_PRESET_VALUE" [selected]="true">
							{{ 'pptx.slideSize.customSize' | translate }}
						</option>
					}
					@for (preset of presets; track preset.labelKey) {
						<option
							[value]="preset.labelKey"
							[selected]="preset.labelKey === selectedPresetValue()"
						>
							{{ 'pptx.slideSize.preset.' + preset.labelKey | translate }}
						</option>
					}
				</select>
			</label>
			<div class="icard__col">
				<span class="icard__label">{{ 'pptx.slideSize.orientation' | translate }}</span>
				<div class="icard__row">
					@for (option of orientations; track option) {
						<button
							type="button"
							class="icard__btn"
							data-pptx-slide-size-orientation
							[attr.data-value]="option"
							[class.icard__btn--on]="selection().orientation === option"
							[attr.aria-pressed]="selection().orientation === option"
							[disabled]="!canEdit()"
							(click)="onOrientation(option)"
						>
							{{ 'pptx.slideSize.' + option | translate }}
						</button>
					}
				</div>
			</div>
			<div class="icard__grid2">
				<label class="icard__row">
					<!-- Compact "W"/"H" labels, matching React's SlideSizeCard. -->
					<span class="icard__label">W</span>
					<input
						type="number"
						class="icard__input icard__input--number"
						min="1"
						[disabled]="!canEdit()"
						[value]="size().width"
						(change)="onChange($event, 'width')"
					/>
				</label>
				<label class="icard__row">
					<span class="icard__label">H</span>
					<input
						type="number"
						class="icard__input icard__input--number"
						min="1"
						[disabled]="!canEdit()"
						[value]="size().height"
						(change)="onChange($event, 'height')"
					/>
				</label>
			</div>

			@if (pendingResize(); as pending) {
				<div class="icard__col" data-testid="pptx-slide-size-rescale-prompt">
					<span class="icard__label">{{ 'pptx.slideSize.rescaleTitle' | translate }}</span>
					<p class="icard__hint">{{ 'pptx.slideSize.rescaleDescription' | translate }}</p>
					<div class="icard__row">
						<button
							type="button"
							class="icard__btn"
							data-testid="pptx-slide-size-rescale-maximize"
							[title]="'pptx.slideSize.rescaleMaximizeHint' | translate"
							(click)="onRescaleChoice(pending, 'maximize')"
						>
							{{ 'pptx.slideSize.rescaleMaximize' | translate }}
						</button>
						<button
							type="button"
							class="icard__btn"
							data-testid="pptx-slide-size-rescale-ensure-fit"
							[title]="'pptx.slideSize.rescaleEnsureFitHint' | translate"
							(click)="onRescaleChoice(pending, 'ensureFit')"
						>
							{{ 'pptx.slideSize.rescaleEnsureFit' | translate }}
						</button>
					</div>
				</div>
			}
		</section>
	`,
	styles: [
		INSPECTOR_CARD_STYLES,
		`
			.icard__hint {
				font-size: 11px;
				color: var(--pptx-inspector-muted, #888);
				margin: 0 0 0.35rem;
			}
			.icard__btn--on {
				background: var(--pptx-inspector-accent, #2f6feb);
				border-color: var(--pptx-inspector-accent, #2f6feb);
				color: #fff;
			}
		`,
	],
})
export class SlideSizeCardComponent {
	/** Whether the inputs are enabled. */
	readonly canEdit = input<boolean>(true);

	private readonly loader = inject(LoadContentService);
	private readonly editor = inject(EditorStateService);
	private readonly translate = inject(TranslateService);

	protected readonly CUSTOM_PRESET_VALUE = CUSTOM_PRESET_VALUE;
	protected readonly presets = SLIDE_SIZE_PRESETS;
	protected readonly orientations: readonly SlideSizeOrientation[] = ['landscape', 'portrait'];

	protected readonly size = this.loader.canvasSize;
	protected readonly selection = this.loader.slideSizeSelection;
	protected readonly selectedPresetValue = computed(
		() => this.selection().preset?.labelKey ?? CUSTOM_PRESET_VALUE,
	);

	/**
	 * A confirmed size that differs from the current one and has at least one
	 * element to rescale, awaiting the user's Maximize/Ensure-Fit choice. `null`
	 * once answered (or when no prompt was needed) so the inline prompt hides.
	 */
	protected readonly pendingResize = signal<SlideSizeEmu | null>(null);

	protected onPresetChange(event: Event): void {
		const labelKey = (event.target as HTMLSelectElement).value;
		const preset: SlideSizePreset | undefined = SLIDE_SIZE_PRESETS.find(
			(candidate) => candidate.labelKey === labelKey,
		);
		if (!preset) {
			return;
		}
		this.apply(slideSizeFromPreset(preset, this.selection().orientation));
	}

	protected onOrientation(orientation: SlideSizeOrientation): void {
		const current = this.selection();
		if (current.orientation === orientation) {
			return;
		}
		this.apply(withSlideSizeOrientation(current.size, orientation));
	}

	protected onChange(event: Event, dim: 'width' | 'height'): void {
		const value = Number((event.target as HTMLInputElement).value);
		if (!Number.isFinite(value) || value < 1) {
			return;
		}
		this.apply(slideSizeFromCanvasPx({ ...this.loader.canvasSize(), [dim]: value }));
	}

	/**
	 * PowerPoint's Maximize/Ensure-Fit prompt: choosing a mode rescales every
	 * slide's elements (one undoable history entry via
	 * `EditorStateService.applyReplacement`) before the new size itself commits.
	 */
	protected onRescaleChoice(pending: SlideSizeEmu, mode: SlideSizeRescaleMode): void {
		const oldSize = this.selection().size;
		const rescaled = scaleSlidesForSizeChange(this.editor.slides(), oldSize, pending, mode);
		this.editor.applyReplacement(rescaled, this.translate.instant('pptx.slideSize.rescaleTitle'));
		this.commit(pending);
		this.pendingResize.set(null);
	}

	/**
	 * Commit a confirmed size, prompting first (PowerPoint's Maximize/Ensure
	 * Fit) when it differs from the current size AND the deck has at least one
	 * element anywhere to rescale; an empty deck commits directly, as before.
	 */
	private apply(next: SlideSizeEmu): void {
		const current = this.selection().size;
		const sizeChanged = current.widthEmu !== next.widthEmu || current.heightEmu !== next.heightEmu;
		const hasContent = this.editor.slides().some((slide) => slide.elements.length > 0);
		if (sizeChanged && hasContent) {
			this.pendingResize.set(next);
			return;
		}
		this.commit(next);
	}

	/** Commit an EMU size and the canvas size it implies, together. */
	private commit(next: SlideSizeEmu): void {
		this.loader.slideSizeEmu.set(next);
		this.loader.canvasSize.set(slideSizeToCanvasPx(next));
		this.editor.dirty.set(true);
	}
}
