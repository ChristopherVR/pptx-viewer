/**
 * theme-gallery.component.ts: Angular port of React's `ThemeGallery.tsx` /
 * Vue's `ThemeGallery.vue`.
 *
 * Shows a grid of built-in deck-theme presets (`THEME_PRESETS` from
 * `pptx-viewer-core`).  Selecting one emits `applyTheme` with the chosen
 * `PptxThemePreset`; the parent (`PowerPointViewerComponent`) applies it to
 * the live deck via `applyThemeToData`.
 *
 * Rendered as a fixed overlay (like Vue's `<Teleport to="body">`).  The
 * component is `OnPush` and purely presentational; all state lives in signals.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { PptxThemePreset } from 'pptx-viewer-core';

import { GALLERY_THEME_PRESETS } from './theme-gallery-presets';

@Component({
	selector: 'pptx-theme-gallery',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass],
	template: `
		@if (open()) {
			<!-- Backdrop -->
			<div
				class="fixed inset-0 z-[1100] flex items-start justify-center bg-black/40 pt-20"
				(click)="onBackdropClick($event)"
				aria-label="Close theme gallery"
			>
				<!-- Panel -->
				<div
					class="w-[640px] max-w-[90vw] rounded-lg border border-border bg-popover shadow-2xl p-4"
					role="dialog"
					aria-label="Theme gallery"
					aria-modal="true"
				>
					<!-- Header: title + description + close icon -->
					<div class="mb-3 flex items-start justify-between">
						<div>
							<h2 class="text-sm font-semibold text-foreground">Themes</h2>
							<p class="text-xs text-muted-foreground">Pick a built-in theme for the deck.</p>
						</div>
						<button
							type="button"
							class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
							(click)="close.emit()"
							aria-label="Close theme gallery"
						>
							✕
						</button>
					</div>

					<!-- Theme thumbnail grid (ThemeThumbnail parity) -->
					<div class="grid grid-cols-4 gap-2">
						@for (preset of presets; track preset.id) {
							<button
								type="button"
								class="group relative flex flex-col overflow-hidden rounded-lg border-2 transition-all"
								[ngClass]="
									selected()?.id === preset.id
										? 'scale-[1.02] border-primary shadow-lg'
										: 'border-border hover:border-primary/50 hover:shadow-md'
								"
								[title]="preset.name"
								(click)="selectPreset(preset)"
							>
								<!-- Colour preview: accent header bars + dk2/lt2 content area -->
								<div class="flex h-24 flex-col">
									<div class="flex h-10">
										<span
											class="flex-1"
											[style.background-color]="preset.colorScheme.accent1"
										></span>
										<span
											class="flex-1"
											[style.background-color]="preset.colorScheme.accent2"
										></span>
										<span
											class="flex-1"
											[style.background-color]="preset.colorScheme.accent3"
										></span>
									</div>
									<div class="flex flex-1">
										<span class="w-1/3" [style.background-color]="preset.colorScheme.dk2"></span>
										<span class="flex-1" [style.background-color]="preset.colorScheme.lt2"></span>
									</div>
								</div>

								<!-- Theme name footer -->
								<div class="border-t border-border bg-background px-2 py-1.5">
									<p class="text-center text-xs font-medium text-foreground">{{ preset.name }}</p>
								</div>

								<!-- Active / selected check mark -->
								@if (selected()?.id === preset.id || activeName() === preset.name) {
									<span
										class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white"
										aria-label="Selected theme"
										>✓</span
									>
								}
							</button>
						}
					</div>

					<!-- Footer -->
					<div class="flex items-center justify-end gap-2 mt-4">
						<button type="button" class="pptx-rb-pill" (click)="close.emit()">Cancel</button>
						<button
							type="button"
							class="pptx-rb-pill bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
							[disabled]="!selected()"
							(click)="applySelected()"
						>
							Apply
						</button>
					</div>
				</div>
			</div>
		}
	`,
})
export class ThemeGalleryComponent {
	/** Whether the gallery overlay is visible. */
	readonly open = input<boolean>(false);
	/**
	 * The `name` of the currently active deck theme (for check-mark display).
	 * Matches `PptxTheme.name`.
	 */
	readonly activeName = input<string | undefined>(undefined);

	/** Emitted when the user confirms a selection. */
	readonly applyTheme = output<PptxThemePreset>();
	/** Emitted when the user cancels (backdrop click, Close button, Cancel button). */
	readonly close = output<void>();

	protected readonly presets: readonly PptxThemePreset[] = GALLERY_THEME_PRESETS;

	/** The currently highlighted (not yet applied) preset, or null. */
	protected readonly selected = signal<PptxThemePreset | null>(null);

	protected selectPreset(preset: PptxThemePreset): void {
		this.selected.set(preset);
	}

	protected applySelected(): void {
		const preset = this.selected();
		if (preset) {
			this.applyTheme.emit(preset);
			this.selected.set(null);
		}
	}

	protected onBackdropClick(event: MouseEvent): void {
		// Only close when clicking the backdrop itself, not the inner panel.
		if (event.target === event.currentTarget) {
			this.close.emit();
		}
	}
}
