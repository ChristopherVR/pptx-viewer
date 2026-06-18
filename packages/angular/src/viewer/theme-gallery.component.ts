/**
 * theme-gallery.component.ts — Angular port of React's `ThemeGallery.tsx` /
 * Vue's `ThemeGallery.vue`.
 *
 * Shows a grid of built-in deck-theme presets (`THEME_PRESETS` from
 * `pptx-viewer-core`).  Selecting one emits `applyTheme` with the chosen
 * `PptxThemePreset`; the parent (`PowerPointViewerComponent`) applies it to
 * the live deck via `applyThemeToData`.
 *
 * Rendered as a fixed overlay (like Vue's `<Teleport to="body">`).  The
 * component is `OnPush` and purely presentational — all state lives in signals.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { THEME_PRESETS } from 'pptx-viewer-core';
import type { PptxThemePreset } from 'pptx-viewer-core';

/** Six representative swatch colours for a preset thumbnail (dk2 + accents 1–5). */
function accentSwatches(p: PptxThemePreset): readonly string[] {
	const c = p.colorScheme;
	return [c.dk2, c.accent1, c.accent2, c.accent3, c.accent4, c.accent5];
}

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
					<!-- Header -->
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-sm font-semibold text-foreground">Themes</h2>
						<button
							type="button"
							class="text-xs text-muted-foreground hover:text-foreground transition-colors"
							(click)="close.emit()"
							aria-label="Close theme gallery"
						>
							Close
						</button>
					</div>

					<!-- Swatch grid -->
					<div class="grid grid-cols-4 gap-2">
						@for (preset of presets; track preset.id) {
							<button
								type="button"
								class="group relative flex flex-col rounded border border-border bg-card hover:border-primary transition-colors overflow-hidden"
								[ngClass]="selected()?.id === preset.id ? 'ring-2 ring-primary border-primary' : ''"
								[title]="preset.name"
								(click)="selectPreset(preset)"
							>
								<!-- Colour swatch strip -->
								<div class="h-12 flex" [style.background-color]="preset.colorScheme.lt1">
									@for (swatch of swatchesFor(preset.id); track $index) {
										<span class="flex-1" [style.background-color]="swatch"></span>
									}
								</div>

								<!-- Label -->
								<span class="px-1.5 py-1 text-[11px] text-foreground truncate text-left">
									{{ preset.name }}
								</span>

								<!-- Active check mark -->
								@if (activeName() === preset.name) {
									<span
										class="absolute top-1 right-1 w-3.5 h-3.5 text-primary flex items-center justify-center text-[10px] font-bold"
										aria-label="Active theme"
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

	protected readonly presets: readonly PptxThemePreset[] = THEME_PRESETS;

	/** The currently highlighted (not yet applied) preset, or null. */
	protected readonly selected = signal<PptxThemePreset | null>(null);

	/** Pre-computed swatch arrays keyed by preset id (avoids re-computing in template). */
	private readonly swatchMap = computed<Map<string, readonly string[]>>(() => {
		const m = new Map<string, readonly string[]>();
		for (const p of THEME_PRESETS) {
			m.set(p.id, accentSwatches(p));
		}
		return m;
	});

	protected swatchesFor(id: string): readonly string[] {
		return this.swatchMap().get(id) ?? [];
	}

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
