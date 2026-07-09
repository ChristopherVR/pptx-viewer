/**
 * ribbon-animations-section.component.ts: the Animations ribbon tab (preview, the
 * Add Animation entrance/emphasis/exit gallery, Remove Animation, Animation
 * Panel). Split out of {@link RibbonComponent}; behaviour and markup are
 * unchanged. Animation edits go through the immutable helpers in
 * animation-author-helpers.ts and commit via {@link EditorStateService}.
 */
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import {
	LucideChevronDown,
	LucidePanelRight,
	LucidePlay,
	LucideSparkles,
	LucideTrash2,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxAnimationPreset, PptxElement, PptxSlide } from 'pptx-viewer-core';

import {
	EMPHASIS_PRESETS,
	ENTRANCE_PRESETS,
	EXIT_PRESETS,
	removeAnimation,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
} from './animation-author-helpers';
import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-animations-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		TranslatePipe,
		LucidePlay,
		LucideSparkles,
		LucideChevronDown,
		LucideTrash2,
		LucidePanelRight,
	],
	template: `
		<!-- Preview: plays presentation from this slide; no element-only preview API yet -->
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!hasSel()"
			[title]="'pptx.animations.previewTooltip' | translate"
			(click)="present.emit()"
		>
			<svg lucidePlay class="h-4 w-4"></svg> {{ 'pptx.animations.preview' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Add Animation dropdown (hover-reveal, mirrors React pattern) -->
		<div class="group relative">
			<button
				type="button"
				class="pptx-rb-pill"
				[disabled]="!hasSel()"
				[title]="'pptx.animations.addTooltip' | translate"
			>
				<svg lucideSparkles class="h-4 w-4"></svg>
				{{ 'pptx.animations.addAnimation' | translate }}
				<svg lucideChevronDown class="h-3 w-3"></svg>
			</button>
			<!-- Dropdown panel: shown on group hover -->
			<div class="absolute left-0 top-full z-50 hidden w-44 pt-1 group-hover:block">
				<div class="rounded-lg border border-border bg-card py-1 shadow-2xl">
					<!-- Entrance group -->
					<div
						class="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
					>
						{{ 'pptx.animations.group.entrance' | translate }}
					</div>
					@for (item of entrancePresets; track item.value) {
						<button
							type="button"
							[disabled]="!hasSel()"
							(click)="addAnimation(item.value, 'entrance')"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
							[title]="'Entrance: ' + item.label"
						>
							{{ item.label }}
						</button>
					}
					<!-- Emphasis group -->
					<div
						class="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
					>
						{{ 'pptx.animations.group.emphasis' | translate }}
					</div>
					@for (item of emphasisPresets; track item.value) {
						<button
							type="button"
							[disabled]="!hasSel()"
							(click)="addAnimation(item.value, 'emphasis')"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
							[title]="'Emphasis: ' + item.label"
						>
							{{ item.label }}
						</button>
					}
					<!-- Exit group -->
					<div
						class="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
					>
						{{ 'pptx.animations.group.exit' | translate }}
					</div>
					@for (item of exitPresets; track item.value) {
						<button
							type="button"
							[disabled]="!hasSel()"
							(click)="addAnimation(item.value, 'exit')"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
							[title]="'Exit: ' + item.label"
						>
							{{ item.label }}
						</button>
					}
				</div>
			</div>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Remove Animation -->
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!hasSel()"
			[title]="'pptx.animations.removeTooltip' | translate"
			(click)="removeAnim()"
		>
			<svg lucideTrash2 class="h-4 w-4"></svg> {{ 'pptx.ribbon.removeAnimation' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Animation Panel -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.animations.openPanelTooltip' | translate"
			(click)="toggleInspector.emit()"
		>
			<svg lucidePanelRight class="h-4 w-4"></svg>
			{{ 'pptx.animations.animationPanel' | translate }}
		</button>
	`,
})
export class RibbonAnimationsSectionComponent {
	private readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);

	readonly present = output<void>();
	readonly toggleInspector = output<void>();

	protected readonly entrancePresets = ENTRANCE_PRESETS;
	protected readonly emphasisPresets = EMPHASIS_PRESETS;
	protected readonly exitPresets = EXIT_PRESETS;

	protected hasSel(): boolean {
		return this.editor.selectedIds().length > 0;
	}

	/**
	 * Add an animation preset to the selected element on the active slide.
	 * Delegates to the immutable helpers in animation-author-helpers.ts and
	 * commits the updated animations array via EditorStateService.updateSlide.
	 */
	protected addAnimation(
		preset: PptxAnimationPreset,
		group: 'entrance' | 'emphasis' | 'exit',
	): void {
		const el = this.selectedElement();
		if (!el) {
			return;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		if (!slide) {
			return;
		}
		const current = slide.animations ?? [];
		let updated: ReturnType<typeof setAnimationEntrance>;
		if (group === 'entrance') {
			updated = setAnimationEntrance(current, el.id, preset);
		} else if (group === 'emphasis') {
			updated = setAnimationEmphasis(current, el.id, preset);
		} else {
			updated = setAnimationExit(current, el.id, preset);
		}
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}

	/** Remove all animations from the selected element. */
	protected removeAnim(): void {
		const el = this.selectedElement();
		if (!el) {
			return;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		if (!slide) {
			return;
		}
		const updated = removeAnimation(slide.animations ?? [], el.id);
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}
}
