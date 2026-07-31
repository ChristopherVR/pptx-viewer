/**
 * ribbon-animation-gallery.component.ts: the Animations tab's preset gallery.
 *
 * Its own component rather than more markup inside
 * {@link RibbonAnimationsSectionComponent} because the catalogue it renders is
 * twenty-seven buttons, which would push that file past this repo's 300-LOC cap
 * on its own.
 *
 * The whole shared catalogue, not a sample of it. The ribbon used to hard-code
 * six presets while `pptx-viewer-shared` already published twenty-seven, so
 * twenty-one effects the editor can actually apply were reachable only from the
 * animation panel. Sourcing the buttons from the shared arrays keeps every
 * binding's gallery identical by construction, and keeps a preset added to the
 * catalogue from needing five separate follow-ups.
 *
 * Every preset is a real <button> in the accessibility tree rather than an
 * entry behind a hover menu: a gallery a screen-reader user cannot enumerate is
 * a gallery they do not have. The three bucket captions are plain <span>s, so
 * they are never mistaken for commands. The column scrolls instead of growing
 * so the ribbon keeps the single-row height `e2e/ribbon-tab-parity.spec.ts`
 * guards.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideStar } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxAnimationPreset } from 'pptx-viewer-core';

import {
	animationPresetLabelKey,
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
} from '../internal/shared';
import type { AnimationGroup } from '../internal/shared';

/** One gallery button: the preset it applies plus the key naming it. */
export interface AnimationPresetEntry {
	value: PptxAnimationPreset;
	labelKey: string;
}

/** One gallery column: a bucket's caption plus the presets filed under it. */
export interface AnimationPresetCategory {
	group: AnimationGroup;
	labelKey: string;
	tone: string;
	presets: readonly AnimationPresetEntry[];
}

/**
 * The i18n key naming a preset, shared by every binding's gallery. Re-exported
 * from `pptx-viewer-shared` (where it now lives alongside the rest of the
 * animation naming layer) so this module's public surface is unchanged.
 */
export { animationPresetLabelKey };

function entries(presets: readonly PptxAnimationPreset[]): readonly AnimationPresetEntry[] {
	return presets.map((value) => ({ value, labelKey: animationPresetLabelKey(value) }));
}

/**
 * The gallery's columns, in the catalogue's own order.
 *
 * That order already leads each bucket with the effects PowerPoint puts first
 * (Appear / Fade In / Fly In, Spin / Pulse, Fade Out), so the six presets this
 * tab used to offer still read as the primary set without being rendered twice.
 */
export const ANIMATION_PRESET_CATEGORIES: readonly AnimationPresetCategory[] = [
	{
		group: 'entrance',
		labelKey: 'pptx.animation.entrance',
		tone: 'text-emerald-500',
		presets: entries(ENTRANCE_PRESET_VALUES),
	},
	{
		group: 'emphasis',
		labelKey: 'pptx.animation.emphasis',
		tone: 'text-amber-500',
		presets: entries(EMPHASIS_PRESET_VALUES),
	},
	{
		group: 'exit',
		labelKey: 'pptx.animation.exit',
		tone: 'text-red-500',
		presets: entries(EXIT_PRESET_VALUES),
	},
];

/** What the gallery emits when a preset button is pressed. */
export interface AnimationPresetPick {
	preset: PptxAnimationPreset;
	group: AnimationGroup;
}

@Component({
	selector: 'pptx-ribbon-animation-gallery',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe, LucideStar],
	template: `
		<div
			role="group"
			class="flex max-h-[62px] shrink-0 items-start gap-2 overflow-y-auto rounded-sm border border-border/60 bg-muted/30 px-1.5 py-1"
			[attr.aria-label]="'pptx.animations.galleryAria' | translate"
		>
			@for (category of categories; track category.group) {
				<div class="flex flex-col gap-0.5">
					<span class="text-[9px] font-semibold leading-3 text-muted-foreground">
						{{ category.labelKey | translate }}
					</span>
					<div class="flex max-w-[150px] flex-wrap gap-0.5">
						@for (preset of category.presets; track preset.value) {
							<button
								type="button"
								class="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9px] leading-3 text-foreground transition-colors hover:bg-accent disabled:opacity-35"
								[disabled]="disabled()"
								[title]="preset.labelKey | translate"
								(click)="addAnimation.emit({ preset: preset.value, group: category.group })"
							>
								<svg
									lucideStar
									aria-hidden="true"
									[class]="'h-2.5 w-2.5 fill-current ' + category.tone"
								></svg>
								<span class="whitespace-nowrap">{{ preset.labelKey | translate }}</span>
							</button>
						}
					</div>
				</div>
			}
		</div>
	`,
})
export class RibbonAnimationGalleryComponent {
	/** True when the deck is not editable or nothing is selected. */
	readonly disabled = input<boolean>(true);

	readonly addAnimation = output<AnimationPresetPick>();

	protected readonly categories = ANIMATION_PRESET_CATEGORIES;
}
