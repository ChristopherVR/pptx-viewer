/**
 * action-target-fields.component.ts: the target input for one Action Settings
 * trigger, split out of `ActionSettingsPanelComponent` to keep that file under
 * the repo's 300-LOC cap.
 *
 * Selector: `pptx-action-target-fields`
 *
 * Renders whichever target control `type` needs (URL / slide number /
 * custom-show select + return-after checkbox / file-or-presentation text
 * target), or nothing for a target-less type. Purely presentational: the
 * parent owns `pending`/`typeFor` and commits through its own `update`.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ElementAction, ElementActionType, PptxCustomShow } from 'pptx-viewer-core';

@Component({
	selector: 'pptx-action-target-fields',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (type() === 'url') {
			<input
				type="url"
				class="pptx-ng-action__input"
				[value]="action()?.url ?? ''"
				placeholder="https://..."
				(input)="urlChange.emit(inputValue($event))"
			/>
		}
		@if (type() === 'slide') {
			<input
				type="number"
				class="pptx-ng-action__input"
				min="1"
				[max]="slideCount()"
				[value]="(action()?.slideIndex ?? 0) + 1"
				(change)="slideChange.emit(numberValue($event))"
			/>
		}
		@if (type() === 'customShow') {
			<label class="pptx-ng-action__label" [for]="idPrefix() + '-customshow'">
				{{ 'pptx.hyperlink.customShowLabel' | translate }}
			</label>
			<select
				[id]="idPrefix() + '-customshow'"
				data-testid="pptx-action-custom-show"
				class="pptx-ng-action__input"
				[value]="action()?.customShowId ?? ''"
				(change)="customShowChange.emit(inputValue($event))"
			>
				@for (show of customShows(); track show.id) {
					<option [value]="show.id" [selected]="show.id === (action()?.customShowId ?? '')">
						{{ show.name }}
					</option>
				}
			</select>
			<label class="pptx-ng-action__check">
				<input
					type="checkbox"
					data-testid="pptx-action-custom-show-return"
					[checked]="action()?.returnAfter ?? false"
					(change)="returnAfterChange.emit(checkedValue($event))"
				/>
				{{ 'pptx.hyperlink.customShowReturn' | translate }}
			</label>
		}
		@if (type() === 'openFile' || type() === 'openPresentation') {
			<input
				type="text"
				class="pptx-ng-action__input"
				[value]="action()?.url ?? ''"
				[placeholder]="'pptx.hyperlink.fileLabel' | translate"
				(input)="urlChange.emit(inputValue($event))"
			/>
		}
	`,
	styles: `
		/* Shared with ActionSettingsPanelComponent's own <select>: duplicated
		   rather than inherited, because Angular's per-component style
		   encapsulation means the PARENT's stylesheet can never reach an
		   element rendered inside THIS component's own template (see
		   CommentMentionTextareaComponent for the same note in depth). */
		.pptx-ng-action__input {
			box-sizing: border-box;
			width: 100%;
			padding: 4px 6px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			font-size: 11px;
		}
		.pptx-ng-action__check {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 11px;
			color: var(--pptx-inspector-muted, #aaa);
		}
	`,
})
export class ActionTargetFieldsComponent {
	readonly type = input.required<ElementActionType>();
	readonly action = input<ElementAction | undefined>(undefined);
	readonly slideCount = input(0);
	readonly customShows = input<readonly PptxCustomShow[]>([]);
	/** Unique id prefix for this trigger's controls (e.g. `action-click`). */
	readonly idPrefix = input.required<string>();

	readonly urlChange = output<string>();
	readonly slideChange = output<number>();
	readonly customShowChange = output<string>();
	readonly returnAfterChange = output<boolean>();

	protected inputValue(event: Event): string {
		return (event.target as HTMLInputElement | HTMLSelectElement).value;
	}

	protected numberValue(event: Event): number {
		return Number(this.inputValue(event));
	}

	protected checkedValue(event: Event): boolean {
		return (event.target as HTMLInputElement).checked;
	}
}
