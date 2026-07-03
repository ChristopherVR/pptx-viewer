/**
 * ribbon-transitions-section.component.ts: the Transitions ribbon tab (preview,
 * preset gallery, duration, Apply to all, Inspector). Split out of
 * {@link RibbonComponent}; behaviour and markup are unchanged.
 *
 * The selected transition + duration are owned by the parent ribbon (so they
 * persist across tab switches) and passed in via inputs; edits are applied
 * straight to the shared {@link EditorStateService} and the new value is emitted
 * back so the parent keeps its signals in sync.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide, PptxTransitionType } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';

/**
 * Transition presets shown in the Transitions ribbon tab (mirrors React
 * `TRANSITION_PRESETS` in `DesignTransitionsReviewSection.tsx`).
 */
const TRANSITION_PRESETS: ReadonlyArray<{ value: PptxTransitionType; labelKey: string }> = [
	{ value: 'none', labelKey: 'pptx.ribbon.transition.none' },
	{ value: 'fade', labelKey: 'pptx.ribbon.transition.fade' },
	{ value: 'push', labelKey: 'pptx.ribbon.transition.push' },
	{ value: 'wipe', labelKey: 'pptx.ribbon.transition.wipe' },
	{ value: 'split', labelKey: 'pptx.ribbon.transition.split' },
	{ value: 'reveal', labelKey: 'pptx.ribbon.transition.reveal' },
	{ value: 'cut', labelKey: 'pptx.ribbon.transition.cut' },
	{ value: 'cover', labelKey: 'pptx.ribbon.transition.cover' },
	{ value: 'uncover', labelKey: 'pptx.ribbon.transition.uncover' },
];

@Component({
	selector: 'pptx-ribbon-transitions-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe],
	template: `
		<!-- Preview (fires existing presentation present path; no separate preview API yet) -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.previewTransition' | translate"
			(click)="present.emit()"
		>
			▶ {{ 'pptx.ribbon.preview' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Preset gallery -->
		<div class="inline-flex max-w-[420px] items-center gap-0.5 overflow-x-auto">
			@for (t of transitionPresets; track t.value) {
				<button
					type="button"
					(click)="setTransition(t.value)"
					class="flex-shrink-0 rounded border px-2 py-1 text-[11px] leading-tight transition-colors"
					[ngClass]="
						selectedTransition() === t.value
							? 'border-primary bg-primary/10 font-medium text-primary'
							: 'border-border bg-muted text-foreground hover:bg-accent'
					"
					[title]="'pptx.ribbon.transitionTitle' | translate: { name: t.labelKey | translate }"
				>
					{{ t.labelKey | translate }}
				</button>
			}
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Duration -->
		<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
			<span class="whitespace-nowrap">{{ 'pptx.ribbon.duration' | translate }}</span>
			<input
				type="number"
				min="0"
				max="10"
				step="0.1"
				[value]="transitionDurationSec()"
				(change)="onDurationChange($event)"
				class="pptx-rb-select w-16 text-center"
				[title]="'pptx.ribbon.transitionDurationTitle' | translate"
			/>
			<span>s</span>
		</label>
		<span class="pptx-rb-sep"></span>
		<!-- Apply to all -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.applyTransitionToAll' | translate"
			(click)="applyToAll()"
		>
			⧉ {{ 'pptx.headerFooter.applyToAll' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Inspector -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.openInspectorTransitions' | translate"
			(click)="toggleInspector.emit()"
		>
			▤ {{ 'pptx.ribbon.inspector' | translate }}
		</button>
	`,
})
export class RibbonTransitionsSectionComponent {
	private readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly selectedTransition = input<PptxTransitionType>('none');
	readonly transitionDurationSec = input<number>(0.5);

	readonly present = output<void>();
	readonly toggleInspector = output<void>();
	readonly transitionChange = output<PptxTransitionType>();
	readonly durationChange = output<number>();

	protected readonly transitionPresets = TRANSITION_PRESETS;

	/** Apply the chosen transition to the active slide. */
	protected setTransition(type: PptxTransitionType): void {
		this.transitionChange.emit(type);
		const durationMs = Math.round(this.transitionDurationSec() * 1000);
		this.editor.updateSlide(this.slideIndex(), {
			transition: { type, durationMs, advanceOnClick: true },
		} as Partial<PptxSlide>);
	}

	protected onDurationChange(event: Event): void {
		const sec = Number((event.target as HTMLInputElement).value);
		if (Number.isFinite(sec) && sec >= 0) {
			this.durationChange.emit(sec);
			const durationMs = Math.round(sec * 1000);
			this.editor.updateSlide(this.slideIndex(), {
				transition: {
					type: this.selectedTransition(),
					durationMs,
					advanceOnClick: true,
				},
			} as Partial<PptxSlide>);
		}
	}

	/** Apply the current transition to every slide in the deck. */
	protected applyToAll(): void {
		const type = this.selectedTransition();
		const durationMs = Math.round(this.transitionDurationSec() * 1000);
		const count = this.editor.slides().length;
		for (let i = 0; i < count; i++) {
			this.editor.updateSlide(i, {
				transition: { type, durationMs, advanceOnClick: true },
			} as Partial<PptxSlide>);
		}
	}
}
