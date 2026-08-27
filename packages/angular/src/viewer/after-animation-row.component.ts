/**
 * after-animation-row.component.ts: the animation panel's "after animation"
 * row (dim to colour / hide after animation / hide on next click / don't dim).
 *
 * Selector: `pptx-after-animation-row`
 *
 * Its own component for the same reason as {@link MotionPathRowComponent}:
 * keeps {@link AnimationAuthorPanelComponent} under this repo's 300-LOC cap.
 *
 * Reference binding: packages/react/src/viewer/components/inspector/AfterAnimationRow.tsx
 *
 * @module viewer/after-animation-row
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxAfterAnimationAction } from 'pptx-viewer-core';

import { AFTER_ANIMATION_VALUES } from '../internal/shared';

@Component({
	selector: 'pptx-after-animation-row',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="pptx-ng-anim__section pptx-ng-after-animation">
			<label>
				<span class="pptx-ng-anim__label">{{ 'pptx.animation.afterAnimation' | translate }}</span>
				<select
					[attr.aria-label]="'pptx.animation.afterAnimation' | translate"
					class="pptx-ng-anim__select"
					[disabled]="!canEdit()"
					(change)="onActionChange($event)"
				>
					@for (value of values; track value) {
						<option [value]="value" [selected]="action() === value">
							{{ 'pptx.animation.afterAnimation.' + value | translate }}
						</option>
					}
				</select>
			</label>
			@if (action() === 'dimToColor') {
				<label class="pptx-ng-after-animation__color">
					<span class="pptx-ng-anim__label">{{
						'pptx.animation.afterAnimation.color' | translate
					}}</span>
					<input
						type="color"
						[attr.aria-label]="'pptx.animation.afterAnimation.color' | translate"
						[disabled]="!canEdit()"
						[value]="color() ?? '#808080'"
						(change)="onColorChange($event)"
					/>
				</label>
			}
		</div>
	`,
	styles: `
		.pptx-ng-after-animation {
			display: grid;
			gap: 6px;
		}
		.pptx-ng-after-animation__color {
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.pptx-ng-after-animation__color input[type='color'] {
			width: 40px;
			height: 24px;
			padding: 0;
		}
	`,
})
export class AfterAnimationRowComponent {
	readonly action = input.required<PptxAfterAnimationAction>();
	readonly color = input<string | undefined>(undefined);
	readonly canEdit = input<boolean>(true);
	readonly actionChange = output<PptxAfterAnimationAction>();
	readonly colorChange = output<string>();

	protected readonly values = AFTER_ANIMATION_VALUES;

	protected onActionChange(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) {
			return;
		}
		this.actionChange.emit(target.value as PptxAfterAnimationAction);
	}

	protected onColorChange(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) {
			return;
		}
		this.colorChange.emit(target.value);
	}
}
