/**
 * master-view-crud-row.component.ts: the Slide Master view sidebar's
 * Insert/Duplicate/Delete/Rename Layout+Master button row, split out of
 * `MasterViewSidebarComponent` to keep that file under the repo's 300-LOC cap.
 *
 * Selector: `pptx-master-view-crud-row`
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { MasterViewCrudAction, MasterViewCrudActionId } from '../internal/shared';

@Component({
	selector: 'pptx-master-view-crud-row',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div
			class="crud-row"
			role="group"
			[attr.aria-label]="'pptx.masterView.slideMastersTitle' | translate"
		>
			@for (action of actions(); track action.id) {
				<button
					type="button"
					class="crud-btn"
					[attr.data-testid]="'pptx-master-crud-' + action.id"
					[disabled]="!action.enabled"
					[title]="action.disabledReasonKey ? (action.disabledReasonKey | translate) : null"
					(click)="pick.emit(action.id)"
				>
					{{ action.labelKey | translate }}
				</button>
			}
		</div>
	`,
	styles: `
		.crud-row {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 4px;
			margin-bottom: 10px;
		}
		.crud-btn {
			padding: 6px 4px;
			border: 1px solid var(--pptx-border, #33334d);
			border-radius: 5px;
			background: transparent;
			color: inherit;
			font-size: 10px;
			cursor: pointer;
		}
		.crud-btn:hover:not(:disabled) {
			background: var(--pptx-accent, #33334d);
		}
		.crud-btn:disabled {
			opacity: 0.45;
			cursor: not-allowed;
		}
	`,
})
export class MasterViewCrudRowComponent {
	readonly actions = input<readonly MasterViewCrudAction[]>([]);
	readonly pick = output<MasterViewCrudActionId>();
}
