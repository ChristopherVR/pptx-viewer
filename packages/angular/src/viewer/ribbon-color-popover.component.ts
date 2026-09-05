/**
 * ribbon-color-popover.component.ts: the hover-reveal swatch popover used for the
 * Font-colour and Text-highlight pickers in {@link RibbonFontControlsComponent}.
 * The trigger icon is projected via `<ng-content>`; the swatch grid + custom
 * colour input are shared. Split out to keep the font controls under the 300-LOC
 * cap; behaviour and markup are unchanged.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxThemeColorRef } from 'pptx-viewer-core';

import type { ThemeColorPickerCommit } from '../internal/shared';
import { AnchoredPopupDirective } from './anchored-popup.directive';
import { RecentColorsRowComponent } from './recent-colors-row.component';
import { RecentColorsService } from './recent-colors.service';
import { ThemeColorSwatchGridComponent } from './theme-color-swatch-grid.component';

@Component({
	selector: 'pptx-ribbon-color-popover',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgClass,
		TranslatePipe,
		AnchoredPopupDirective,
		RecentColorsRowComponent,
		ThemeColorSwatchGridComponent,
	],
	template: `
		<div class="group relative">
			<button
				#colorTrigger
				type="button"
				class="pptx-rb-pill"
				[disabled]="disabled()"
				[title]="titleKey() | translate"
				(mousedown)="$event.preventDefault()"
			>
				<ng-content />
				<span class="-mt-0.5 block h-1 w-4 rounded-sm" [style.background]="current()"></span>
			</button>
			<div class="z-50 hidden pt-1 group-hover:block" [pptxAnchoredPopup]="colorTrigger">
				<div
					class="rounded-lg border border-border bg-card p-2 shadow-2xl"
					[class.w-48]="showThemeColors()"
					[class.w-36]="!showThemeColors()"
				>
					@if (showThemeColors()) {
						<pptx-theme-color-swatch-grid
							[disabled]="disabled()"
							[selectedRef]="currentRef()"
							[selectedHex]="current()"
							(pick)="onThemePick($event)"
						/>
						<div class="mb-1 mt-1 text-[10px] text-muted-foreground">
							{{ 'pptx.colorPicker.standardColors' | translate }}
						</div>
					}
					<div class="mb-2 grid grid-cols-5 gap-1.5">
						@for (c of presets(); track c) {
							<button
								type="button"
								data-pptx-compact
								class="h-5 w-5 rounded-full border transition-transform hover:scale-125"
								[ngClass]="
									current().toLowerCase() === c
										? 'border-primary ring-1 ring-primary'
										: 'border-border'
								"
								[style.background]="c"
								[attr.aria-label]="swatchAriaKey() | translate: { color: c }"
								(mousedown)="$event.preventDefault()"
								(click)="onPick(c)"
							></button>
						}
					</div>
					<pptx-recent-colors-row
						class="mb-2 block"
						[colors]="recentColors.recent()"
						[disabled]="disabled()"
						(pick)="onPick($event)"
					/>
					<label
						class="block w-full cursor-pointer py-1 text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground"
					>
						{{ 'pptx.ribbon.customColour' | translate }}
						<input
							type="color"
							class="sr-only"
							[value]="current()"
							(change)="onPick($any($event.target).value)"
						/>
					</label>
				</div>
			</div>
		</div>
	`,
})
export class RibbonColorPopoverComponent {
	readonly current = input<string>('#000000');
	readonly presets = input<readonly string[]>([]);
	readonly disabled = input<boolean>(false);
	readonly titleKey = input<string>('');
	readonly swatchAriaKey = input<string>('');
	/** Show the deck's "Theme Colors" grid above the presets (font colour only: highlight
	 * colour has no theme-ref concept on the model). */
	readonly showThemeColors = input<boolean>(false);
	/** The element's current theme ref, if any (only meaningful with `showThemeColors`). */
	readonly currentRef = input<PptxThemeColorRef | undefined>(undefined);

	/** Fired by a preset, recent, or custom-input pick (never by a theme swatch: see `pickThemeColor`). */
	readonly pick = output<string>();
	/**
	 * Fired ONLY by a theme-swatch click, carrying both the hex and the ref.
	 * Kept SEPARATE from `pick` (rather than also firing `pick` for the same
	 * click) so a caller that handles both never commits the hex-only patch
	 * and the ref-bearing patch as two separate edits/undo-steps for one click;
	 * a caller that only binds `(pick)` (the Home ribbon's Shape Fill/Outline
	 * dropdowns, which never set `showThemeColors`) is unaffected either way,
	 * since it never renders the theme grid this fires from.
	 */
	readonly pickThemeColor = output<ThemeColorPickerCommit>();

	protected readonly recentColors = inject(RecentColorsService);

	/** Every commit through this popover both fires `pick` and records the colour as recently used. */
	protected onPick(color: string): void {
		this.pick.emit(color);
		this.recentColors.push(color);
	}

	protected onThemePick(commit: ThemeColorPickerCommit): void {
		this.pickThemeColor.emit(commit);
		this.recentColors.push(commit.hex);
	}
}
