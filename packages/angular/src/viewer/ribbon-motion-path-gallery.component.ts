/**
 * ribbon-motion-path-gallery.component.ts: the Animations tab's motion-path
 * gallery (PowerPoint's Lines / Arcs / Turns / Shapes / Loops families).
 *
 * Its own component rather than more markup inside
 * {@link RibbonAnimationsSectionComponent} for the same reason
 * {@link RibbonAnimationGalleryComponent} is: the catalogue is thirty-odd
 * buttons, which would push that file past this repo's 300-LOC cap on its own.
 *
 * WHY it is a SIBLING of the entrance/emphasis/exit gallery and not a fourth
 * column of it: a motion path is not one of those three buckets. It is
 * geometry that coexists with them on the SAME animation entry, so folding it
 * into the preset columns would imply a mutually exclusive choice the model
 * does not make (an element can fade in AND travel a path).
 *
 * Every path is a real <button> carrying its translated name as both `title`
 * and visible text, because `e2e/ribbon-control-inventory.spec.ts` inventories
 * each tab by accessible name and diffs every binding against React: a gallery
 * hidden behind a hover menu, or one whose buttons are named by an icon only,
 * is a gallery a screen-reader user (and that spec) does not have. The columns
 * come from the shared catalogue rather than a hand-written list so a preset
 * added there needs no follow-up in five bindings.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideMoveRight } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import {
	MOTION_PATH_FAMILIES,
	motionPathFamilyLabelKey,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from '../internal/shared';
import type { MotionPathFamily } from '../internal/shared';

/** One gallery button: the catalogue path it applies plus the key naming it. */
export interface MotionPathEntry {
	id: string;
	labelKey: string;
}

/** One gallery column: a family caption plus the paths filed under it. */
export interface MotionPathColumn {
	family: MotionPathFamily;
	labelKey: string;
	presets: readonly MotionPathEntry[];
}

/**
 * The gallery's columns, in the shared catalogue's own (ribbon) order.
 *
 * Built once at module load: the catalogue is static, so recomputing it per
 * change-detection pass would allocate thirty view models for nothing.
 */
export const MOTION_PATH_COLUMNS: readonly MotionPathColumn[] = MOTION_PATH_FAMILIES.map(
	(family) => ({
		family,
		labelKey: motionPathFamilyLabelKey(family),
		presets: motionPathPresetsByFamily(family).map((preset) => ({
			id: preset.id,
			labelKey: motionPathPresetLabelKey(preset.id),
		})),
	}),
);

@Component({
	selector: 'pptx-ribbon-motion-path-gallery',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe, LucideMoveRight],
	template: `
		<div
			role="group"
			class="flex max-h-[62px] items-start gap-2 overflow-y-auto rounded-sm border border-border/60 bg-muted/30 px-1.5 py-1"
			[attr.aria-label]="'pptx.animations.motionPathGalleryAria' | translate"
		>
			@for (column of columns; track column.family) {
				<div class="flex flex-col gap-0.5">
					<span class="text-[9px] font-semibold leading-3 text-muted-foreground">
						{{ column.labelKey | translate }}
					</span>
					<div class="flex max-w-[150px] flex-wrap gap-0.5">
						@for (preset of column.presets; track preset.id) {
							<button
								type="button"
								class="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9px] leading-3 text-foreground transition-colors hover:bg-accent disabled:opacity-35"
								[disabled]="disabled()"
								[title]="preset.labelKey | translate"
								(click)="applyMotionPath.emit(preset.id)"
							>
								<svg lucideMoveRight aria-hidden="true" class="h-2.5 w-2.5 text-sky-500"></svg>
								<span class="whitespace-nowrap">{{ preset.labelKey | translate }}</span>
							</button>
						}
					</div>
				</div>
			}
		</div>
	`,
})
export class RibbonMotionPathGalleryComponent {
	/** True when the deck is not editable or nothing is selected. */
	readonly disabled = input<boolean>(true);

	/** Emits the catalogue preset id of the pressed path. */
	readonly applyMotionPath = output<string>();

	protected readonly columns = MOTION_PATH_COLUMNS;
}
