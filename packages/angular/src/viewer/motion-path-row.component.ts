/**
 * motion-path-row.component.ts: the animation panel's motion-path row.
 *
 * Selector: `pptx-motion-path-row`
 *
 * Its own component rather than more markup inside
 * {@link AnimationAuthorPanelComponent} because that file already sits just
 * under this repo's 300-LOC cap, and the row carries a catalogue-sized
 * `<select>` of its own.
 *
 * WHY a "Custom Path" option exists: dragging the end handle on the canvas
 * produces a path that no longer matches any catalogue entry. Without a slot
 * to show that in, the select would snap back to the preset the user started
 * from and misreport what will actually play. The option is therefore rendered
 * only while the applied path is unrecognised, and re-picking it is a no-op
 * (the panel refuses to translate "custom" back into some catalogue geometry).
 *
 * Reference binding: packages/react/src/viewer/components/inspector/MotionPathRow.tsx
 *
 * @module viewer/motion-path-row
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { motionPathPresetIdForPath } from '../internal/shared';
import { MOTION_PATH_COLUMNS } from './ribbon-motion-path-gallery.component';

/** The select value standing for "this path was hand-dragged". */
export const CUSTOM_MOTION_PATH_VALUE = 'custom';

/** The select value standing for "no path at all". */
export const NO_MOTION_PATH_VALUE = 'none';

/**
 * Which option the select should show for an applied path.
 *
 * Pure so the branch that used to be a template ternary can be asserted
 * directly: `none` when nothing is applied, the catalogue id when the geometry
 * is recognised, `custom` when it is not.
 */
export function motionPathSelectValue(motionPath: string | undefined): string {
	if (!motionPath) {
		return NO_MOTION_PATH_VALUE;
	}
	return motionPathPresetIdForPath(motionPath) ?? CUSTOM_MOTION_PATH_VALUE;
}

@Component({
	selector: 'pptx-motion-path-row',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<label class="pptx-ng-anim__section pptx-ng-motion-path">
			<span class="pptx-ng-anim__label">
				{{ 'pptx.animation.motionPath.label' | translate }}
			</span>
			<!--
				Selection is expressed with [selected] on each option rather than
				[value] on the select: Angular applies an element's own property
				bindings before the @for blocks below it have produced any options, so
				a [value] naming a catalogue id would be assigned to an empty select
				and silently drop back to the first entry on first render.
			-->
			<select class="pptx-ng-anim__select" [disabled]="!canEdit()" (change)="onSelect($event)">
				<option value="none" [selected]="selectedValue() === 'none'">
					{{ 'pptx.animation.motionPath.none' | translate }}
				</option>
				@if (isCustom()) {
					<option value="custom" selected>
						{{ 'pptx.animation.motionPath.custom' | translate }}
					</option>
				}
				@for (column of columns; track column.family) {
					<optgroup [label]="column.labelKey | translate">
						@for (preset of column.presets; track preset.id) {
							<option [value]="preset.id" [selected]="selectedValue() === preset.id">
								{{ preset.labelKey | translate }}
							</option>
						}
					</optgroup>
				}
			</select>
			@if (motionPath()) {
				<span class="pptx-ng-motion-path__hint">
					{{ 'pptx.animation.motionPath.editHint' | translate }}
				</span>
			}
		</label>
	`,
	styles: `
		.pptx-ng-motion-path {
			display: block;
		}

		.pptx-ng-motion-path__hint {
			display: block;
			margin-top: 0.2rem;
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}
	`,
})
export class MotionPathRowComponent {
	/** The path currently applied to the selected element, if any. */
	readonly motionPath = input<string | undefined>(undefined);

	/** Whether the select is live. */
	readonly canEdit = input<boolean>(true);

	/**
	 * Emits a catalogue preset id, or `'none'` to clear the path. `'custom'` is
	 * never emitted: re-picking the marker changes nothing.
	 */
	readonly presetChange = output<string>();

	protected readonly columns = MOTION_PATH_COLUMNS;

	/** The option the select shows: `none`, a catalogue id, or `custom`. */
	protected readonly selectedValue = computed(() => motionPathSelectValue(this.motionPath()));

	/** True while the applied path matches no catalogue entry. */
	protected readonly isCustom = computed(() => this.selectedValue() === CUSTOM_MOTION_PATH_VALUE);

	protected onSelect(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) {
			return;
		}
		// The custom marker is read-only: it describes a dragged path, and there is
		// no catalogue geometry to restore it to.
		if (target.value === CUSTOM_MOTION_PATH_VALUE) {
			return;
		}
		this.presetChange.emit(target.value);
	}
}
