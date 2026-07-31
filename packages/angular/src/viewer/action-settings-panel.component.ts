import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ElementAction, ElementActionType, PptxElement } from 'pptx-viewer-core';
import { elementActionToPptxAction, pptxActionToElementAction } from 'pptx-viewer-core';

import {
	canCommitActionType,
	ELEMENT_ACTION_TYPE_OPTIONS,
	resolveActionType,
	toSlideIndex,
} from '../internal/shared';

type Trigger = 'click' | 'hover';

/** A type the user picked, remembered against the element it was picked on. */
export interface PendingActionType {
	elementId: string;
	types: Partial<Record<Trigger, ElementActionType>>;
}

/** Nothing picked yet. */
export const NO_PENDING_ACTION_TYPE: PendingActionType = { elementId: '', types: {} };

/**
 * Record the type the user just picked for one trigger.
 *
 * A pick belongs to the element it was made on, so a pick for a different
 * element replaces the whole record instead of merging: otherwise selecting
 * another shape would show it a half-made choice it never had.
 */
export function withPendingActionType(
	previous: PendingActionType,
	elementId: string,
	trigger: Trigger,
	type: ElementActionType,
): PendingActionType {
	const types = previous.elementId === elementId ? previous.types : {};
	return { elementId, types: { ...types, [trigger]: type } };
}

/**
 * The action type a trigger's controls should render, which is also the
 * predicate deciding whether the URL / slide input exists.
 *
 * Exported (and pure) so it can be unit-tested without a TestBed, matching the
 * rest of this package; see `inspector-panel.component.ts` for the convention.
 */
export function displayedActionType(
	pending: PendingActionType,
	elementId: string,
	trigger: Trigger,
	committedType: ElementActionType | undefined,
): ElementActionType {
	const picked = pending.elementId === elementId ? pending.types[trigger] : undefined;
	return resolveActionType(picked, committedType);
}

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
						[value]="typeFor(trigger)"
						(change)="onType($event, trigger)"
					>
						@for (option of actionTypes; track option.value) {
							<option [value]="option.value">{{ option.labelKey | translate }}</option>
						}
					</select>
					@if (typeFor(trigger) === 'url') {
						<input
							type="url"
							class="pptx-ng-action__input"
							[value]="actionFor(trigger)?.url ?? ''"
							placeholder="https://..."
							(input)="onUrl($event, trigger)"
						/>
					}
					@if (typeFor(trigger) === 'slide') {
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
	protected readonly actionTypes = ELEMENT_ACTION_TYPE_OPTIONS;
	/**
	 * The type the user just picked, per trigger.
	 *
	 * WHY it exists: "Go to URL" / "Go to Slide" only become a stored action once
	 * they carry a target, so controls driven purely by the committed element
	 * never revealed the input needed to supply that target, leaving both kinds
	 * unreachable. The pick is tagged with its element id so moving the inspector
	 * to another shape does not carry a half-made choice across.
	 */
	private readonly pending = signal<PendingActionType>(NO_PENDING_ACTION_TYPE);
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

	protected actionFor(trigger: Trigger): ElementAction | undefined {
		return trigger === 'click' ? this.clickAction() : this.hoverAction();
	}

	/** The action type this trigger's controls should render right now. */
	protected typeFor(trigger: Trigger): ElementActionType {
		return displayedActionType(
			this.pending(),
			this.element().id,
			trigger,
			this.actionFor(trigger)?.type,
		);
	}

	private update(
		trigger: Trigger,
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

	protected onType(event: Event, trigger: Trigger): void {
		const type = (event.target as HTMLSelectElement).value as ElementActionType;
		const elementId = this.element().id;
		this.pending.update((previous) => withPendingActionType(previous, elementId, trigger, type));
		const current = this.actionFor(trigger);
		const target = { url: current?.url, slideIndex: current?.slideIndex };
		if (canCommitActionType(type, target)) {
			this.update(trigger, type, target.url, target.slideIndex);
		}
	}

	protected onUrl(event: Event, trigger: Trigger): void {
		this.update(trigger, 'url', (event.target as HTMLInputElement).value);
	}

	protected onSlide(event: Event, trigger: Trigger): void {
		const index = toSlideIndex(Number((event.target as HTMLInputElement).value), this.slideCount());
		if (index !== undefined) {
			this.update(trigger, 'slide', undefined, index);
		}
	}
}
