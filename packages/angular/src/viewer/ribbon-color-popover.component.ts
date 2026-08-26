/**
 * ribbon-color-popover.component.ts: the hover-reveal swatch popover used for the
 * Font-colour and Text-highlight pickers in {@link RibbonFontControlsComponent}.
 * The trigger icon is projected via `<ng-content>`; the swatch grid + custom
 * colour input are shared. Split out to keep the font controls under the 300-LOC
 * cap; behaviour and markup are unchanged.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AnchoredPopupDirective } from './anchored-popup.directive';

@Component({
	selector: 'pptx-ribbon-color-popover',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe, AnchoredPopupDirective],
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
				<div class="w-36 rounded-lg border border-border bg-card p-2 shadow-2xl">
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
								(click)="pick.emit(c)"
							></button>
						}
					</div>
					<label
						class="block w-full cursor-pointer py-1 text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground"
					>
						{{ 'pptx.ribbon.customColour' | translate }}
						<input
							type="color"
							class="sr-only"
							[value]="current()"
							(change)="pick.emit($any($event.target).value)"
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

	readonly pick = output<string>();
}
