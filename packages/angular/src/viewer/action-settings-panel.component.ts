import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ElementAction, ElementActionType, PptxElement } from 'pptx-viewer-core';
import { elementActionToPptxAction, pptxActionToElementAction } from 'pptx-viewer-core';

const ACTION_TYPES: ReadonlyArray<{ value: ElementActionType; key: string }> = [
	{ value: 'none', key: 'pptx.hyperlink.actionNone' },
	{ value: 'url', key: 'pptx.action.gotoUrl' },
	{ value: 'slide', key: 'pptx.action.gotoSlide' },
	{ value: 'firstSlide', key: 'pptx.hyperlink.actionFirstSlide' },
	{ value: 'lastSlide', key: 'pptx.hyperlink.actionLastSlide' },
	{ value: 'prevSlide', key: 'pptx.hyperlink.actionPrevSlide' },
	{ value: 'nextSlide', key: 'pptx.hyperlink.actionNextSlide' },
	{ value: 'endShow', key: 'pptx.hyperlink.actionEndShow' },
];

@Component({
	selector: 'pptx-action-settings-panel',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="pptx-ng-action">
			<h3 class="pptx-ng-action__heading">{{ 'pptx.action.title' | translate }}</h3>
			@for (trigger of triggers; track trigger) {
				<div class="pptx-ng-action__trigger">
					<label class="pptx-ng-action__label" [for]="'action-' + trigger">
						{{ (trigger === 'click' ? 'pptx.action.onClick' : 'pptx.action.onHover') | translate }}
					</label>
					<select
						[id]="'action-' + trigger"
						class="pptx-ng-action__input"
						[value]="actionFor(trigger)?.type ?? 'none'"
						(change)="onType($event, trigger)"
					>
						@for (option of actionTypes; track option.value) {
							<option [value]="option.value">{{ option.key | translate }}</option>
						}
					</select>
					@if (actionFor(trigger)?.type === 'url') {
						<input
							type="url"
							class="pptx-ng-action__input"
							[value]="actionFor(trigger)?.url ?? ''"
							placeholder="https://..."
							(input)="onUrl($event, trigger)"
						/>
					}
					@if (actionFor(trigger)?.type === 'slide') {
						<input
							type="number"
							class="pptx-ng-action__input"
							min="1"
							[max]="slideCount()"
							[value]="(actionFor(trigger)?.slideIndex ?? 0) + 1"
							(change)="onSlide($event, trigger)"
						/>
					}
				</div>
			}
		</section>
	`,
	styles: `
		.pptx-ng-action {
			display: grid;
			gap: 8px;
		}
		.pptx-ng-action__heading {
			margin: 0;
			color: var(--pptx-inspector-muted, #aaa);
			font-size: 11px;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}
		.pptx-ng-action__trigger {
			display: grid;
			gap: 4px;
		}
		.pptx-ng-action__label {
			color: var(--pptx-inspector-muted, #aaa);
			font-size: 11px;
			font-weight: 600;
		}
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
	`,
})
export class ActionSettingsPanelComponent {
	readonly element = input.required<PptxElement>();
	readonly slideCount = input(0);
	readonly patch = output<Partial<PptxElement>>();

	protected readonly triggers = ['click', 'hover'] as const;
	protected readonly actionTypes = ACTION_TYPES;
	private readonly clickAction = computed(() =>
		this.element().actionClick
			? pptxActionToElementAction(this.element().actionClick!, 'click')
			: undefined,
	);
	private readonly hoverAction = computed(() =>
		this.element().actionHover
			? pptxActionToElementAction(this.element().actionHover!, 'hover')
			: undefined,
	);

	protected actionFor(trigger: 'click' | 'hover'): ElementAction | undefined {
		return trigger === 'click' ? this.clickAction() : this.hoverAction();
	}

	private update(
		trigger: 'click' | 'hover',
		type: ElementActionType,
		url?: string,
		slideIndex?: number,
	): void {
		const action = elementActionToPptxAction({ trigger, type, url, slideIndex });
		this.patch.emit(
			(trigger === 'click'
				? { actionClick: action }
				: { actionHover: action }) as Partial<PptxElement>,
		);
	}

	protected onType(event: Event, trigger: 'click' | 'hover'): void {
		const current = this.actionFor(trigger);
		this.update(
			trigger,
			(event.target as HTMLSelectElement).value as ElementActionType,
			current?.url,
			current?.slideIndex,
		);
	}

	protected onUrl(event: Event, trigger: 'click' | 'hover'): void {
		this.update(trigger, 'url', (event.target as HTMLInputElement).value);
	}

	protected onSlide(event: Event, trigger: 'click' | 'hover'): void {
		const value = Number((event.target as HTMLInputElement).value);
		if (Number.isFinite(value)) {
			this.update(trigger, 'slide', undefined, Math.max(0, value - 1));
		}
	}
}
